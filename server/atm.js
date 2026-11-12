import { randomBytes } from 'node:crypto';
import { getAddress, Interface } from 'ethers';
import { AMOUNTS, CHAIN_ID } from './config.js';

export class AtmError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const activeStates = ['scanning', 'authorized', 'submitted', 'verifying', 'dispensing'];

export class ATM {
  constructor({ provider, deployment, abi, journal, hardware, enrollment, now = Date.now }) {
    Object.assign(this, { provider, deployment, journal, hardware, enrollment, now });
    this.iface = new Interface(abi);
    this.processing = new Set();
  }
  async assertChain() {
    const [chainId, metadata, code] = await Promise.all([
      this.provider.send('eth_chainId', []),
      this.provider.send('hardhat_metadata', []),
      this.provider.getCode(this.deployment.address),
    ]);
    if (Number(chainId) !== CHAIN_ID || metadata.instanceId !== this.deployment.instanceId || code === '0x') {
      throw new AtmError('Local chain changed or contract is missing. Stop the ATM and run the reset procedure.', 503);
    }
  }
  expire() {
    let changed = false;
    for (const r of this.journal.requests) {
      if (r.status === 'authorized' && this.now() > r.expiresAt) {
        r.status = 'expired';
        r.message = 'Fingerprint session expired. Check MetaMask for any pending payment before starting again.';
        changed = true;
      }
    }
    if (changed) this.journal.save();
  }
  history() { this.expire(); return [...this.journal.requests].reverse(); }
  find(id) {
    const r = this.journal.requests.find(item => item.id === id);
    if (!r) throw new AtmError('Withdrawal not found.', 404);
    return r;
  }
  async create({ wallet, rupees, scanResult = 'match' }) {
    this.expire();
    if (!Object.hasOwn(AMOUNTS, rupees)) throw new AtmError('Select ₹100, ₹200, or ₹500.');
    try { wallet = getAddress(wallet); } catch { throw new AtmError('Connect a valid wallet first.'); }
    if (wallet !== getAddress(this.enrollment.wallet)) throw new AtmError('This wallet is not linked to the enrolled fingerprint.');
    if (this.hardware.mode === 'serial' && scanResult !== 'match') throw new AtmError('Simulation controls are unavailable in hardware mode.');
    if (!['match', 'unknown', 'error'].includes(scanResult)) throw new AtmError('Invalid simulator option.');
    if (this.journal.requests.some(r => activeStates.includes(r.status))) throw new AtmError('Another withdrawal is in progress.', 409);
    // Reserve the only ATM session synchronously, before any asynchronous checks.
    const r = { id: '0x' + randomBytes(32).toString('hex'), wallet, rupees: Number(rupees), valueWei: AMOUNTS[rupees],
      status: 'scanning', createdAt: this.now(), mode: this.hardware.mode, message: 'Place your enrolled finger on the sensor.' };
    this.journal.requests.push(r);
    this.journal.save();
    try {
      await this.assertChain();
      const match = await this.hardware.scan(scanResult);
      if (r.status !== 'scanning') return r;
      if (Number(match.slot) !== Number(this.enrollment.slot)) throw new AtmError('Fingerprint does not belong to the connected wallet.');
      Object.assign(r, { status: 'authorized', expiresAt: this.now() + 5 * 60_000, message: 'Fingerprint matched. Approve the payment in MetaMask.' });
      this.journal.save();
      return r;
    } catch (error) {
      Object.assign(r, { status: 'failed', message: error.message });
      this.journal.save();
      throw error;
    }
  }
  cancel(id) {
    const r = this.find(id);
    if (['scanning', 'authorized'].includes(r.status)) {
      r.status = 'cancelled';
      r.message = 'Session cancelled. Check MetaMask for any payment already submitted.';
      this.journal.save();
    }
    return r;
  }
  async submit(id, txHash) {
    const r = this.find(id);
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash || '')) throw new AtmError('Invalid transaction hash.');
    if (r.txHash) {
      if (r.txHash.toLowerCase() !== txHash.toLowerCase()) throw new AtmError('A different payment is already attached to this request.');
      return r;
    }
    this.expire();
    if (r.status !== 'authorized') throw new AtmError('This fingerprint session is no longer authorized. Check the wallet before paying again.', 409);
    // Claim before awaiting RPC, so simultaneous submissions cannot race.
    r.status = 'verifying';
    this.journal.save();
    try {
      await this.assertChain();
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) throw new AtmError('Transaction is not visible yet. Retry submitting the same hash.', 409);
      let call;
      try { call = this.iface.parseTransaction({ data: tx.data, value: tx.value }); } catch {}
      if (tx.to?.toLowerCase() !== this.deployment.address.toLowerCase() ||
          tx.from.toLowerCase() !== r.wallet.toLowerCase() || tx.value.toString() !== r.valueWei ||
          Number(tx.chainId) !== CHAIN_ID || call?.name !== 'requestCash' || call.args[0] !== r.id) {
        throw new AtmError('Transaction does not match this wallet, amount, contract, and withdrawal request.');
      }
      Object.assign(r, { txHash, status: 'submitted', message: 'Payment submitted. Waiting for blockchain confirmation.' });
      this.journal.save();
    } catch (error) {
      if (r.status === 'verifying') r.status = 'authorized';
      this.journal.save();
      throw error;
    }
    await this.process(r);
    return r;
  }
  async process(r) {
    if (r.status !== 'submitted' || this.processing.has(r.id)) return;
    this.processing.add(r.id);
    try {
      await this.assertChain();
      const receipt = await this.provider.getTransactionReceipt(r.txHash);
      if (!receipt) return;
      if (receipt.status !== 1) {
        Object.assign(r, { status: 'failed', message: 'Blockchain payment failed. No dispense command was sent.' });
        this.journal.save();
        return;
      }
      const event = receipt.logs.filter(l => l.address.toLowerCase() === this.deployment.address.toLowerCase())
        .map(l => { try { return this.iface.parseLog(l); } catch { return null; } })
        .find(e => e?.name === 'CashRequested' && e.args.requestId === r.id &&
          e.args.customer.toLowerCase() === r.wallet.toLowerCase() && e.args.paymentWei.toString() === r.valueWei &&
          Number(e.args.cashRupees) === r.rupees);
      if (!event) throw new AtmError('Confirmed transaction has no matching ATM event. Dispensing blocked.');
      // Persist before sending: a crash or lost acknowledgement must never cause an automatic retry.
      Object.assign(r, { status: 'dispensing', blockNumber: receipt.blockNumber, attemptedAt: this.now(), message: 'Payment confirmed. Running the dispense cycle.' });
      this.journal.save();
      const result = await this.hardware.dispense(r.id);
      if (!result.completed) throw new Error('ESP32 did not confirm completion.');
      Object.assign(r, { status: 'completed', completedAt: this.now(), message: r.mode === 'simulator' ? 'Payment confirmed; simulated dispense cycle completed.' : 'Payment confirmed; ESP32 dispense cycle completed.' });
      this.journal.save();
    } catch (error) {
      Object.assign(r, { status: 'uncertain', message: r.attemptedAt
        ? `Payment confirmed; dispensing not confirmed. ${error.message}`
        : `Payment verification interrupted. No dispense retry will be made. ${error.message}` });
      this.journal.save();
    } finally { this.processing.delete(r.id); }
  }
  async tick() {
    this.expire();
    for (const r of this.journal.requests.filter(r => r.status === 'submitted')) await this.process(r);
  }
}
