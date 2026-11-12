// Optional UI check against an already running SIMULATOR demo.
// Uses an injected local test-wallet adapter, not the actual MetaMask extension.
import { chromium } from 'playwright';
import { JsonRpcProvider } from 'ethers';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const base = process.env.ATM_URL || 'http://127.0.0.1:3000';
const provider = new JsonRpcProvider('http://127.0.0.1:8545', 31337, { staticNetwork: true, cacheTimeout: -1 });
let browser;
try {
  const config = await (await fetch(`${base}/api/config`)).json();
  assert.equal(config.mode, 'simulator', 'Browser checks must use simulator mode.');
  const account = await (await provider.getSigner(1)).getAddress();
  assert.equal(account.toLowerCase(), config.enrolledWallet.toLowerCase(), 'Enroll the default demo account before this check.');
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.exposeFunction('testWalletRpc', async ({ method, params = [] }) => {
    if (['eth_requestAccounts', 'eth_accounts'].includes(method)) return [account];
    if (method === 'wallet_switchEthereumChain') return null;
    return provider.send(method, params);
  });
  await page.addInitScript(() => {
    window.ethereum = {
      on() {},
      async request(args) {
        if (args.method === 'eth_sendTransaction' && window.rejectNextPayment) {
          window.rejectNextPayment = false;
          const error = new Error('User rejected the transaction.'); error.code = 4001; throw error;
        }
        return window.testWalletRpc(args);
      },
    };
  });
  await page.goto(base);
  await page.getByRole('button', { name: 'Connect wallet', exact: false }).click();
  await page.waitForFunction(() => document.getElementById('connect').textContent.includes('Connected'));
  await page.waitForFunction(() => !document.getElementById('withdraw').disabled);

  await page.selectOption('#scan-result', 'unknown');
  await page.click('#withdraw');
  await page.waitForFunction(() => document.getElementById('feedback').textContent.includes('not recognized'));
  await page.waitForFunction(() => !document.getElementById('withdraw').disabled);
  await page.selectOption('#scan-result', 'match');
  await page.evaluate(() => { window.rejectNextPayment = true; });
  await page.click('#withdraw');
  await page.waitForFunction(() => document.getElementById('feedback').textContent.includes('cancelled in MetaMask'));
  await page.waitForFunction(() => !document.getElementById('withdraw').disabled);
  for (const amount of [100, 200, 500]) {
    await page.click(`[data-amount="${amount}"]`);
    await page.click('#withdraw');
    await page.waitForFunction(() => document.getElementById('feedback').textContent.includes('simulated dispense cycle completed'), null, { timeout: 20000 });
    await page.waitForFunction(() => !document.getElementById('withdraw').disabled);
  }
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/atm-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Mobile page must not overflow horizontally.');
  await page.screenshot({ path: 'test-results/atm-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: fingerprint rejection, wallet rejection, three withdrawals, desktop/mobile layouts. Actual MetaMask approval still needs a manual check.');
} catch (error) {
  console.error(`Browser check failed: ${error.message}`);
  console.error('Start the simulator demo first. Install Chromium with npx playwright install chromium, or set CHROME_PATH to your Chrome executable.');
  process.exitCode = 1;
} finally { await browser?.close(); provider.destroy(); }
