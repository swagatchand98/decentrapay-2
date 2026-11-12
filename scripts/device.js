import path from 'node:path';
import { getAddress } from 'ethers';
import { DATA, settings } from '../server/config.js';
import { acquireLock, writeJson } from '../server/store.js';
import { createHardware } from '../server/hardware.js';

let hardware, unlock;
try {
  const command = process.argv[2];
  if (command === 'ports') {
    const { SerialPort } = await import('serialport');
    console.table(await SerialPort.list());
  } else {
    const config = settings();
    unlock = acquireLock(path.join(DATA, 'atm.lock'));
    if (command === 'enroll') {
      let wallet;
      try { wallet = getAddress(process.argv[3]); } catch { throw new Error('Usage: npm run enroll -- WALLET_ADDRESS'); }
      hardware = await createHardware(config);
      console.log(`Enrollment mode: ${config.mode}. Slot 1 will be replaced. Follow the fingerprint prompts below.`);
      await hardware.enroll();
      writeJson(path.join(DATA, `enrollment.${config.mode}.json`), { slot: 1, wallet, mode: config.mode });
      console.log(`Enrolled slot 1 and linked it to ${wallet}.`);
    } else if (command === 'check') {
      hardware = await createHardware(config);
      console.log(await hardware.status());
      console.log('Place the enrolled finger on the sensor.');
      console.log(await hardware.scan());
      console.log('Running one bench-test LED/servo cycle (no blockchain payment).');
      const { randomBytes } = await import('node:crypto');
      console.log(await hardware.dispense('0x' + randomBytes(32).toString('hex')));
    } else throw new Error('Unknown hardware command.');
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await hardware?.close(); unlock?.(); }
