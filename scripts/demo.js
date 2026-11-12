import { spawn } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { DATA, ROOT, RPC_URL } from '../server/config.js';

const reset = process.argv.includes('--reset');
const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 700);
}
function run(script, args = [], quiet = false) {
  const child = spawn(process.execPath, [path.join(ROOT, script), ...args], { cwd: ROOT, stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
  children.add(child);
  child.on('exit', () => children.delete(child));
  return child;
}
function finished(child) {
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Command exited with code ${code}.`)));
  });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
try {
  if (existsSync(path.join(DATA, 'deployment.json')) && !reset) throw new Error('A previous demo exists. Use npm run demo:reset to explicitly start a fresh demo, or npm start if its chain is still running.');
  let occupied = false;
  try { await fetch(RPC_URL, { signal: AbortSignal.timeout(1000) }); occupied = true; } catch {}
  if (occupied) throw new Error('Port 8545 is already in use. Stop that chain, or use the manual startup commands in README.md.');
  await finished(run('node_modules/hardhat/internal/cli/cli.js', ['compile']));
  await finished(run('node_modules/vite/bin/vite.js', ['build']));
  console.log('Starting a fresh local blockchain. All ETH in this project is test currency.');
  const chain = run('node_modules/hardhat/internal/cli/cli.js', ['node', '--hostname', '127.0.0.1'], true);
  let chainOutput = '';
  chain.stdout.on('data', data => { chainOutput = (chainOutput + data.toString()).slice(-4000); });
  chain.stderr.on('data', data => { chainOutput = (chainOutput + data.toString()).slice(-4000); });
  chain.on('exit', code => { if (!stopping) { console.error(`Local chain stopped (${code}). ${chainOutput}`); stop(1); } });
  let ready = false;
  for (let n = 0; n < 60; n++) {
    try {
      const response = await fetch(RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }), signal: AbortSignal.timeout(500) });
      if ((await response.json()).result === '0x7a69') { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error(`Chain did not start. ${chainOutput}`);
  await finished(run('scripts/setup.js', reset ? ['--reset'] : []));
  const app = run('server/index.js');
  app.on('exit', code => stop(code || 0));
} catch (error) { console.error(error.message); stop(1); }
