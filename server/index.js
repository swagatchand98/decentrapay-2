import path from 'node:path';
import { existsSync } from 'node:fs';
import { JsonRpcProvider } from 'ethers';
import { artifact, CHAIN_ID, DATA, ROOT, RPC_URL, readJson, settings } from './config.js';
import { acquireLock, Journal } from './store.js';
import { createHardware } from './hardware.js';
import { ATM } from './atm.js';
import { createApp } from './app.js';

let unlock, hardware, server, timer, provider;
async function shutdown() {
  clearInterval(timer);
  server?.close();
  await hardware?.close();
  provider?.destroy();
  unlock?.();
  process.exit(0);
}
try {
  const config = settings();
  if (!existsSync(path.join(ROOT, 'dist/index.html'))) throw new Error('Build the ATM screen first: npm run build');
  if (!existsSync(path.join(DATA, 'deployment.json'))) throw new Error('Start the local chain and run npm run setup first.');
  unlock = acquireLock(path.join(DATA, 'atm.lock'));
  const deployment = readJson(path.join(DATA, 'deployment.json'));
  const enrollmentFile = path.join(DATA, config.mode === 'simulator' ? 'enrollment.simulator.json' : 'enrollment.serial.json');
  if (!existsSync(enrollmentFile)) throw new Error('Fingerprint enrollment is missing. Stop the server and run npm run enroll -- WALLET_ADDRESS');
  hardware = await createHardware(config);
  provider = new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true, cacheTimeout: -1 });
  const atm = new ATM({ provider, deployment,
    abi: artifact().abi, journal: new Journal(path.join(DATA, 'journal.json'), deployment.id), hardware, enrollment: readJson(enrollmentFile) });
  await atm.assertChain();
  server = createApp({ atm, port: config.port }).listen(config.port, '127.0.0.1', () => {
    console.log(`\nDecentraPay ATM: http://127.0.0.1:${config.port}`);
    console.log(config.mode === 'simulator' ? 'HARDWARE SIMULATOR — no physical fingerprint or servo is being used.' : 'ESP32 HARDWARE — USB serial connected.');
  });
  server.on('error', error => { console.error(error.message); shutdown(); });
  timer = setInterval(() => atm.tick().catch(error => console.error(error.message)), 1000);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error(`ATM could not start: ${error.message}`);
  await hardware?.close();
  provider?.destroy();
  unlock?.();
  process.exitCode = 1;
}
