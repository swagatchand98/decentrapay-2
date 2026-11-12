import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IncomingMessage, ServerResponse } from 'node:http';
import { PassThrough } from 'node:stream';
import hre from 'hardhat';
import { randomBytes } from 'node:crypto';
import { ContractFactory, BrowserProvider, parseEther, ZeroHash } from 'ethers';
import { ATM } from '../server/atm.js';
import { Journal, acquireLock } from '../server/store.js';
import { Simulator } from '../server/hardware.js';
import { createApp } from '../server/app.js';
import { artifact, ROOT, AMOUNTS } from '../server/config.js';

const temp = mkdtempSync(path.join(os.tmpdir(), 'decentrapay-tests-'));
const id = () => '0x' + randomBytes(32).toString('hex');
let provider, customer, outsider, contract, deployment;
const abi = artifact().abi;
before(async () => {
  // Real Hardhat EVM in-process: no internet, listening port, or external demo state.
  provider = new BrowserProvider(hre.network.provider, 31337, { cacheTimeout: -1 });
  provider.pollingInterval = 50;
  customer = await provider.getSigner(1);
  outsider = await provider.getSigner(2);
  contract = await new ContractFactory(abi, artifact().bytecode, await provider.getSigner(0)).deploy();
  await contract.waitForDeployment();
  deployment = { id: id(), address: await contract.getAddress(), instanceId: (await provider.send('hardhat_metadata', [])).instanceId };
});
after(async () => {
  provider?.destroy();
  rmSync(temp, { recursive: true, force: true });
});
function makeATM(overrides = {}) {
  const hardware = {
    mode: 'simulator', cycles: 0, connected: true,
    async status() { return { mode: this.mode, connected: this.connected, sensorReady: true }; },
    async scan(result) { if (result !== 'match') throw new Error('Fingerprint not recognized.'); return { slot: 1 }; },
    async dispense() { this.cycles++; return { completed: true }; },
    ...overrides.hardware,
  };
  const journal = new Journal(path.join(temp, `${id()}.json`), deployment.id);
  return new ATM({ provider, deployment, abi, journal, hardware, enrollment: { wallet: customer.address, slot: 1 }, ...overrides, hardware });
}
async function authorize(atm, rupees = 100) { return atm.create({ wallet: customer.address, rupees }); }
async function pay(r, signer = customer, target = contract) {
  const tx = await target.connect(signer).requestCash(r.id, { value: BigInt(r.valueWei) });
  await tx.wait();
  return tx;
}

test('contract accepts each supported amount, transfers value, and emits exact event', async () => {
  for (const [rupees, wei] of Object.entries(AMOUNTS)) {
    const requestId = id();
    const beforeBalance = await provider.getBalance(deployment.address);
    const tx = await contract.connect(customer).requestCash(requestId, { value: BigInt(wei) });
    const receipt = await tx.wait();
    assert.equal(await provider.getBalance(deployment.address), beforeBalance + BigInt(wei));
    const event = contract.interface.parseLog(receipt.logs[0]);
    assert.equal(event.name, 'CashRequested');
    assert.equal(event.args.requestId, requestId);
    assert.equal(event.args.customer, customer.address);
    assert.equal(event.args.paymentWei, BigInt(wei));
    assert.equal(event.args.cashRupees, BigInt(rupees));
  }
});
test('contract rejects invalid amounts, zero IDs, and reused IDs without changing balance', async () => {
  const requestId = id();
  await (await contract.connect(customer).requestCash(requestId, { value: parseEther('0.001') })).wait();
  const beforeBalance = await provider.getBalance(deployment.address);
  for (const wei of [0n, 1n, parseEther('0.003')]) await assert.rejects(contract.connect(customer).requestCash(id(), { value: wei }));
  await assert.rejects(contract.connect(customer).requestCash(ZeroHash, { value: parseEther('0.001') }));
  await assert.rejects(contract.connect(customer).requestCash(requestId, { value: parseEther('0.001') }));
  assert.equal(await provider.getBalance(deployment.address), beforeBalance);
});
test('three consecutive authenticated withdrawals each dispense once and reduce the wallet balance', async () => {
  const atm = makeATM();
  for (const amount of [100, 200, 500]) {
    const r = await authorize(atm, amount);
    const beforeBalance = await provider.getBalance(customer.address);
    const tx = await pay(r);
    await atm.submit(r.id, tx.hash);
    assert.equal(r.status, 'completed');
    assert.ok(await provider.getBalance(customer.address) < beforeBalance - BigInt(r.valueWei));
    assert.ok(r.blockNumber > 0);
  }
  assert.equal(atm.hardware.cycles, 3);
});
test('unrecognized fingerprint, wrong slot, wrong wallet, and invalid amount never dispense', async () => {
  const atm = makeATM();
  await assert.rejects(atm.create({ wallet: customer.address, rupees: 100, scanResult: 'unknown' }), /not recognized/);
  await assert.rejects(atm.create({ wallet: outsider.address, rupees: 100 }), /not linked/);
  await assert.rejects(authorize(atm, 300), /Select/);
  const wrongSlot = makeATM({ hardware: { async scan() { return { slot: 2 }; } } });
  await assert.rejects(authorize(wrongSlot), /does not belong/);
  assert.equal(atm.hardware.cycles + wrongSlot.hardware.cycles, 0);
});
test('one session is reserved before asynchronous scanning; cancellation prevents authorization', async () => {
  let finish;
  const atm = makeATM({ hardware: { scan: () => new Promise(resolve => { finish = resolve; }) } });
  const first = authorize(atm);
  await assert.rejects(authorize(atm), /in progress/);
  while (!finish) await new Promise(resolve => setTimeout(resolve, 10));
  atm.cancel(atm.journal.requests[0].id);
  finish({ slot: 1 });
  assert.equal((await first).status, 'cancelled');
});
test('expired and cancelled fingerprint sessions cannot authorize a paid transaction', async () => {
  let now = Date.now();
  const atm = makeATM({ now: () => now });
  const r = await authorize(atm);
  const tx = await pay(r);
  now += 5 * 60_000 + 1;
  await assert.rejects(atm.submit(r.id, tx.hash), /no longer authorized/);
  assert.equal(r.status, 'expired');
  const r2 = await authorize(atm);
  atm.cancel(r2.id);
  await assert.rejects(atm.submit(r2.id, tx.hash), /no longer authorized/);
  assert.equal(atm.hardware.cycles, 0);
});
test('unrelated payment, wrong wallet, wrong amount, and wrong contract are rejected', async () => {
  const atm = makeATM();
  const r = await authorize(atm);
  const unrelated = await contract.connect(customer).requestCash(id(), { value: parseEther('0.001') });
  await assert.rejects(atm.submit(r.id, unrelated.hash), /does not match/);
  const foreign = await pay(r, outsider);
  await assert.rejects(atm.submit(r.id, foreign.hash), /does not match/);
  const r2 = { ...r, id: id(), valueWei: AMOUNTS[200] };
  const wrongAmount = await pay(r2);
  await assert.rejects(atm.submit(r.id, wrongAmount.hash), /does not match/);
  const otherContract = await new ContractFactory(abi, artifact().bytecode, await provider.getSigner(0)).deploy();
  await otherContract.waitForDeployment();
  const wrongContract = await pay(r, customer, otherContract);
  await assert.rejects(atm.submit(r.id, wrongContract.hash), /does not match/);
  assert.equal(atm.hardware.cycles, 0);
});
test('duplicate hash submissions and repeated polling do not dispense twice', async () => {
  const atm = makeATM();
  const r = await authorize(atm);
  const tx = await pay(r);
  await atm.submit(r.id, tx.hash);
  await Promise.all([atm.submit(r.id, tx.hash), atm.submit(r.id, tx.hash), atm.tick()]);
  assert.equal(atm.hardware.cycles, 1);
  const next = await authorize(atm);
  await assert.rejects(atm.submit(next.id, tx.hash), /does not match/);
});
test('no dispense occurs until a pending payment is mined', async () => {
  const atm = makeATM();
  const r = await authorize(atm);
  await provider.send('evm_setAutomine', [false]);
  try {
    const tx = await contract.connect(customer).requestCash(r.id, { value: BigInt(r.valueWei), gasLimit: 100000 });
    await atm.submit(r.id, tx.hash);
    assert.equal(r.status, 'submitted');
    assert.equal(atm.hardware.cycles, 0);
    await provider.send('evm_mine', []);
    await atm.tick();
    assert.equal(r.status, 'completed');
    assert.equal(atm.hardware.cycles, 1);
  } finally { await provider.send('evm_setAutomine', [true]); }
});
test('matching transaction that reverts never dispenses', async () => {
  const atm = makeATM();
  const r = await authorize(atm);
  await pay(r);
  // Disable RPC throw-on-failure by sending while mining is paused.
  await provider.send('evm_setAutomine', [false]);
  try {
    const tx = await contract.connect(customer).requestCash(r.id, { value: BigInt(r.valueWei), gasLimit: 100000 });
    await provider.send('evm_mine', []);
    await atm.submit(r.id, tx.hash);
    assert.equal(r.status, 'failed');
    assert.equal(atm.hardware.cycles, 0);
  } finally { await provider.send('evm_setAutomine', [true]); }
});
test('lost hardware acknowledgement is recorded once and never retried, including after restart', async () => {
  const atm = makeATM({ hardware: { async dispense() { this.cycles++; throw new Error('USB disconnected'); } } });
  const r = await authorize(atm);
  const tx = await pay(r);
  await atm.submit(r.id, tx.hash);
  assert.equal(r.status, 'uncertain');
  assert.match(r.message, /Payment confirmed; dispensing not confirmed/);
  assert.ok(r.attemptedAt);
  await atm.submit(r.id, tx.hash);
  const restarted = new ATM({ provider, deployment, abi, journal: new Journal(atm.journal.file, deployment.id), hardware: atm.hardware, enrollment: atm.enrollment });
  await restarted.tick();
  await restarted.submit(r.id, tx.hash);
  assert.equal(atm.hardware.cycles, 1);
});
test('restart marks interrupted dispense uncertain and cancels stale fingerprint authorization', () => {
  const atm = makeATM();
  atm.journal.requests.push({ id: id(), status: 'dispensing' }, { id: id(), status: 'authorized' });
  atm.journal.save();
  const journal = new Journal(atm.journal.file, deployment.id);
  assert.equal(journal.requests[0].status, 'uncertain');
  assert.equal(journal.requests[1].status, 'cancelled');
  assert.throws(() => new Journal(atm.journal.file, 'other-chain'), /another deployment/);
});
test('changed blockchain identity blocks hardware use', async () => {
  const atm = makeATM({ deployment: { ...deployment, instanceId: 'wrong-chain' } });
  await assert.rejects(authorize(atm), /chain changed/);
  assert.equal(atm.hardware.cycles, 0);
});
test('serial mode cannot accept simulator failure/match overrides', async () => {
  const atm = makeATM({ hardware: { mode: 'serial' } });
  await assert.rejects(atm.create({ wallet: customer.address, rupees: 100, scanResult: 'unknown' }), /Simulation controls/);
});
test('simulator is explicitly identified and rejects duplicate dispense IDs', async () => {
  const simulator = new Simulator();
  assert.equal((await simulator.status()).mode, 'simulator');
  const requestId = id();
  await simulator.dispense(requestId);
  await assert.rejects(simulator.dispense(requestId), /Duplicate/);
  assert.equal(simulator.cycles, 1);
});
test('HTTP API rejects foreign origins and exposes no direct dispense endpoint', async () => {
  const atm = makeATM();
  const port = 18546;
  const app = createApp({ atm, port });
  async function request(url, origin, method = 'GET') {
    const socket = new PassThrough();
    socket.on('data', () => {});
    const req = new IncomingMessage(socket);
    req.method = method; req.url = url;
    req.headers = { host: `127.0.0.1:${port}`, ...(origin ? { origin } : {}), 'content-type': 'application/json', 'content-length': '2' };
    const res = new ServerResponse(req);
    res.assignSocket(socket);
    const done = new Promise(resolve => res.on('finish', () => resolve(res.statusCode)));
    app.handle(req, res);
    req.push('{}'); req.push(null);
    const code = await done;
    socket.destroy();
    return code;
  }
  assert.equal(await request('/api/config'), 200);
  assert.equal(await request('/api/withdrawals', 'https://unrelated.example', 'POST'), 403);
  assert.equal(await request('/api/dispense', undefined, 'POST'), 404);
});
test('process lock prevents two bridges from owning the journal', () => {
  const file = path.join(temp, 'lock');
  const release = acquireLock(file);
  assert.throws(() => acquireLock(file), /Another ATM/);
  release();
  assert.equal(existsSync(file), false);
});
