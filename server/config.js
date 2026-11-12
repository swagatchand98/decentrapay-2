import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(path.join(ROOT, '.env'))) loadEnvFile(path.join(ROOT, '.env'));
export const DATA = path.join(ROOT, 'data');
mkdirSync(DATA, { recursive: true });
export const RPC_URL = 'http://127.0.0.1:8545';
export const CHAIN_ID = 31337;
export const AMOUNTS = { 100: '1000000000000000', 200: '2000000000000000', 500: '5000000000000000' };
export const DEMO_WALLET = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
export const artifact = () => readJson(path.join(ROOT, 'artifacts/contracts/DemoATM.sol/DemoATM.json'));

export function settings() {
  const mode = process.env.HARDWARE_MODE || 'simulator';
  if (!['simulator', 'serial'].includes(mode)) throw new Error('HARDWARE_MODE must be simulator or serial.');
  return { mode, port: Number(process.env.PORT || 3000), serialPath: process.env.SERIAL_PORT };
}
