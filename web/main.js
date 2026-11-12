import { BrowserProvider, Contract, formatEther } from 'ethers';
import './style.css';

const $ = id => document.getElementById(id);
const short = value => value ? `${value.slice(0, 8)}…${value.slice(-6)}` : '—';
let config, provider, wallet, amount = 100, busy = false, current = null, ready = false, epoch = 0;
let recovery = null;
try { recovery = JSON.parse(localStorage.getItem('atm-payment') || 'null'); } catch { localStorage.removeItem('atm-payment'); }
let lastCompleted = null;
async function api(url, body) {
  const response = await fetch(`/api${url}`, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'ATM request failed.');
  return result;
}
function feedback(message, type = '') { $('feedback').textContent = message; $('feedback').className = `feedback ${type}`; }
function humanError(error) {
  if (error.code === 4001 || error.code === 'ACTION_REJECTED') return 'Payment cancelled in MetaMask. No dispense command was sent.';
  if (error.code === 'INSUFFICIENT_FUNDS') return 'Not enough test ETH for the payment and gas. Import the funded demo account.';
  return error.shortMessage || error.message || 'Something went wrong. Try again.';
}
function controls() {
  $('withdraw').disabled = busy || !wallet || !ready || Boolean(recovery);
  $('withdraw-label').textContent = busy ? 'Withdrawal in progress…' : recovery ? 'Payment needs checking' : !wallet ? 'Connect wallet to continue' : !ready ? 'Waiting for ATM connection' : `Verify fingerprint & withdraw ₹${amount}`;
  $('connect').disabled = busy;
  document.querySelectorAll('.amount').forEach(b => { b.disabled = busy || Boolean(recovery); });
  $('scan-result').disabled = busy;
  $('retry').hidden = !recovery || busy;
}
function steps(stage) {
  ['wallet', 'finger', 'pay', 'cash'].forEach((s, i) => { $(`step-${s}`).className = i < stage ? 'done' : i === stage ? 'current' : ''; });
}
async function balance() {
  if (provider && wallet) {
    try { $('balance').textContent = `${Number(formatEther(await provider.getBalance(wallet))).toFixed(6)} test ETH available`; } catch {}
  }
}
async function connect() {
  if (!window.ethereum) { $('setup-dialog').showModal(); throw new Error('MetaMask is not installed. Follow the setup guide to connect a demo wallet.'); }
  if (!config) throw new Error('ATM configuration is not loaded yet.');
  await window.ethereum.request({ method: 'eth_requestAccounts' });
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (Number(chainId) !== config.chainId) {
    try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x7a69' }] }); }
    catch (error) {
      if (error.code !== 4902) throw error;
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x7a69', chainName: 'DecentraPay Local', rpcUrls: [config.rpcUrl], nativeCurrency: { name: 'Test Ether', symbol: 'ETH', decimals: 18 } }] });
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x7a69' }] });
    }
  }
  provider = new BrowserProvider(window.ethereum);
  wallet = await (await provider.getSigner()).getAddress();
  $('wallet-address').textContent = short(wallet);
  $('wallet-address').title = wallet;
  $('connect').textContent = 'Connected ✓';
  steps(1);
  await balance();
  if (wallet.toLowerCase() !== config.enrolledWallet.toLowerCase()) feedback(`Use the enrolled demo wallet: ${short(config.enrolledWallet)}.`, 'error');
  else feedback('Wallet connected. Choose an amount, then verify your fingerprint.');
  controls();
}
async function invalidate() {
  epoch++;
  wallet = null;
  provider = null;
  $('wallet-address').textContent = 'Wallet or network changed';
  $('balance').textContent = 'Reconnect to begin a new fingerprint session';
  $('connect').textContent = 'Connect wallet ↗';
  if (current && !recovery) await api(`/withdrawals/${current.id}/cancel`, {}).catch(() => {});
  current = null;
  steps(0);
  controls();
}
function remember(value) {
  recovery = value;
  if (value) localStorage.setItem('atm-payment', JSON.stringify(value));
  else localStorage.removeItem('atm-payment');
  controls();
}
async function waitForResult(id) {
  for (let n = 0; n < 120; n++) {
    const r = await api(`/withdrawals/${id}`);
    feedback(r.message, ['failed', 'uncertain'].includes(r.status) ? 'error' : r.status === 'completed' ? 'success' : '');
    if (r.status === 'dispensing') { steps(3); $('machine').className = 'machine active'; }
    if (!['submitted', 'verifying', 'dispensing'].includes(r.status)) {
      remember(null);
      if (r.status === 'completed') steps(4);
      await refresh();
      await balance();
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 750));
  }
  throw new Error('Confirmation is taking longer than expected. Check the same payment again; do not make another payment.');
}
async function resumePayment() {
  if (!recovery) return;
  if (recovery.deploymentId !== config.deploymentId) { remember(null); throw new Error('The ATM was reset. Old payment belongs to the previous deployment; inspect MetaMask before starting again.'); }
  const saved = { ...recovery };
  const record = await api(`/withdrawals/${saved.id}`);
  if (record.txHash || !['authorized', 'verifying'].includes(record.status)) {
    if (!record.txHash) { remember(null); throw new Error('Session ended before payment verification. Inspect MetaMask; automatic dispensing is blocked.'); }
  } else await api(`/withdrawals/${saved.id}/submit`, { txHash: saved.txHash });
  await waitForResult(saved.id);
}
async function withdraw() {
  if (!wallet || busy || !ready || recovery) return;
  busy = true;
  current = null;
  let fingerMatched = false;
  const startedEpoch = epoch;
  controls();
  try {
    $('machine').className = 'machine scanning';
    $('finger-status').textContent = 'Scanning…';
    steps(1);
    feedback(config.mode === 'simulator' ? 'Simulating a fingerprint scan…' : 'Place your enrolled finger on the R307 sensor.');
    current = await api('/withdrawals', { wallet, rupees: amount, scanResult: $('scan-result').value });
    if (startedEpoch !== epoch || current.status !== 'authorized') {
      await api(`/withdrawals/${current.id}/cancel`, {});
      throw new Error('Wallet or network changed. Reconnect and scan again.');
    }
    $('machine').className = 'machine';
    fingerMatched = true;
    $('finger-status').textContent = 'Match verified';
    steps(2);
    feedback('Fingerprint matched. Approve the test ETH payment in MetaMask.');
    const request = current;
    const signer = await provider.getSigner();
    const contract = new Contract(config.address, config.abi, signer);
    const tx = await contract.requestCash(request.id, { value: BigInt(request.valueWei) });
    remember({ id: request.id, txHash: tx.hash, address: config.address, deploymentId: config.deploymentId });
    feedback('Payment submitted. Verifying the blockchain transaction…');
    await resumePayment();
  } catch (error) {
    $('finger-status').textContent = fingerMatched ? 'Match verified' : 'Not verified';
    feedback(humanError(error), 'error');
    if (current && !recovery) await api(`/withdrawals/${current.id}/cancel`, {}).catch(() => {});
  } finally {
    busy = false;
    $('machine').classList.remove('scanning');
    controls();
    await refresh();
  }
}
function renderHistory(records) {
  $('history-count').textContent = `${records.length} ${records.length === 1 ? 'request' : 'requests'}`;
  $('empty-history').hidden = records.length > 0;
  $('history').replaceChildren();
  for (const r of records.slice(0, 10)) {
    const row = document.createElement('tr');
    const values = [new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), `₹${r.rupees}`, `${formatEther(r.valueWei)} ETH`, '', ''];
    for (const text of values) { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); }
    if (r.txHash) {
      const button = document.createElement('button');
      button.className = 'hash'; button.textContent = short(r.txHash) + ' ↗'; button.title = `Copy transaction hash: ${r.txHash}`;
      button.onclick = () => navigator.clipboard.writeText(r.txHash).then(() => feedback('Transaction hash copied.')).catch(() => feedback(r.txHash));
      row.children[3].append(button);
    } else row.children[3].textContent = '—';
    const tag = document.createElement('span'); tag.className = `status-tag ${r.status}`; tag.textContent = r.status === 'completed' ? (r.mode === 'simulator' ? 'Simulated dispense ✓' : 'Cycle completed ✓') : r.status; tag.title = r.message;
    row.children[4].append(tag);
    $('history').append(row);
  }
  const latest = records[0];
  if (latest) {
    $('cycle-status').textContent = latest.status === 'completed' ? 'Completed' : latest.status === 'uncertain' ? 'Inspect hardware' : latest.status === 'dispensing' ? 'Running…' : 'Idle';
    $('machine-status').textContent = latest.status === 'completed' ? 'TRANSACTION COMPLETE' : latest.status === 'dispensing' ? 'DISPENSING DEMO CASH' : 'READY WHEN YOU ARE';
    if (latest.status === 'completed' && latest.id !== lastCompleted) {
      lastCompleted = latest.id;
      // Only animate a completion observed during this page session.
      if (busy) { $('machine').className = 'machine active completed'; setTimeout(() => $('machine').classList.remove('active'), 1500); }
    }
  }
}
let refreshing = false;
async function refresh() {
  if (!config || refreshing) return;
  refreshing = true;
  try {
    const [status, records] = await Promise.all([api('/status'), api('/withdrawals')]);
    ready = status.chain.connected && status.hardware.connected && status.hardware.sensorReady !== false;
    $('chain-status').textContent = status.chain.connected ? 'Connected · 31337' : 'Disconnected';
    $('device-status').textContent = status.hardware.connected ? (config.mode === 'simulator' ? 'Simulator ready' : 'USB connected') : 'Disconnected';
    $('hardware-pill').textContent = config.mode === 'simulator' ? 'SIMULATOR' : 'USB SERIAL';
    if (!status.chain.connected) feedback(status.chain.error, 'error');
    else if (!status.hardware.connected) feedback(status.hardware.error || 'ESP32 disconnected. Reconnect and restart the server.', 'error');
    renderHistory(records);
  } catch { ready = false; $('chain-status').textContent = 'Server unavailable'; $('device-status').textContent = 'Server unavailable'; }
  finally { refreshing = false; controls(); }
}
$('help').onclick = () => $('setup-dialog').showModal();
$('close-help').onclick = () => $('setup-dialog').close();
$('connect').onclick = () => connect().catch(error => feedback(humanError(error), 'error'));
$('withdraw').onclick = withdraw;
$('retry').onclick = async () => {
  busy = true; controls();
  try { await resumePayment(); } catch (error) { feedback(humanError(error), 'error'); }
  finally { busy = false; controls(); }
};
document.querySelectorAll('.amount').forEach(button => {
  button.onclick = () => {
    amount = Number(button.dataset.amount);
    document.querySelectorAll('.amount').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); });
    controls();
  };
});
window.ethereum?.on?.('accountsChanged', invalidate);
window.ethereum?.on?.('chainChanged', invalidate);
try {
  config = await api('/config');
  $('mode-banner').replaceChildren();
  const dot = document.createElement('span'); dot.className = 'dot';
  const label = document.createElement('strong'); label.textContent = config.mode === 'simulator' ? 'Hardware simulator · Fingerprint and servo are simulated. Blockchain transactions are real on your local test network.' : 'ESP32 hardware mode · Physical fingerprint and servo connected through USB. Test funds only.';
  $('mode-banner').append(dot, label);
  $('mode-banner').classList.toggle('live', config.mode === 'serial');
  $('sim-controls').hidden = config.mode !== 'simulator';
  $('expected-wallet').textContent = config.enrolledWallet;
  $('device-label').textContent = config.mode === 'simulator' ? 'Hardware simulator' : 'ESP32';
  $('hardware-note').textContent = config.mode === 'simulator' ? 'This illustration represents a simulated device. Switch to serial mode to use your physical ESP32, fingerprint sensor, and servo.' : 'The ESP32 confirms that its movement sequence finished. This prototype has no sensor to detect actual cash.';
  if (recovery) feedback('A previous payment needs checking. Use “Check the same payment again” before making another withdrawal.');
  await refresh();
  setInterval(refresh, 2000);
} catch (error) { feedback(`Cannot load ATM: ${error.message}`, 'error'); }
