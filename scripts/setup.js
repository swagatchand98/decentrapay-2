import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { ContractFactory, JsonRpcProvider } from 'ethers';
import { artifact, DATA, DEMO_WALLET, RPC_URL, CHAIN_ID } from '../server/config.js';
import { acquireLock, writeJson } from '../server/store.js';

let unlock, provider;
try {
  unlock = acquireLock(path.join(DATA, 'atm.lock'));
  provider = new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true, cacheTimeout: -1 });
  if (Number(await provider.send('eth_chainId', [])) !== CHAIN_ID) throw new Error('Only the local chain 31337 is supported.');
  const metadata = await provider.send('hardhat_metadata', []);
  const deploymentPath = path.join(DATA, 'deployment.json');
  if (existsSync(deploymentPath) && !process.argv.includes('--reset')) {
    throw new Error('A deployment already exists. To deliberately start over, stop the server and run npm run reset.');
  }
  const { abi, bytecode } = artifact();
  const contract = await new ContractFactory(abi, bytecode, await provider.getSigner(0)).deploy();
  await contract.waitForDeployment();
  if (existsSync(deploymentPath)) {
    const archive = path.join(DATA, 'archive', `${Date.now()}-${randomUUID()}`);
    mkdirSync(archive, { recursive: true });
    for (const file of ['deployment.json', 'journal.json']) {
      if (existsSync(path.join(DATA, file))) renameSync(path.join(DATA, file), path.join(archive, file));
    }
    console.log('Previous deployment and dispensing history archived. Enrollment retained.');
  }
  const deployment = { id: randomUUID(), address: await contract.getAddress(), instanceId: metadata.instanceId,
    chainId: CHAIN_ID, deployedAt: new Date().toISOString() };
  writeJson(deploymentPath, deployment);
  writeJson(path.join(DATA, 'journal.json'), { deploymentId: deployment.id, requests: [] });
  if (!existsSync(path.join(DATA, 'enrollment.simulator.json'))) {
    writeJson(path.join(DATA, 'enrollment.simulator.json'), { slot: 1, wallet: DEMO_WALLET, mode: 'simulator' });
  }
  console.log(`Contract deployed: ${deployment.address}\nDemo customer: ${DEMO_WALLET}\nTest network: ${RPC_URL} (chain 31337)`);
  provider.destroy();
} catch (error) {
  console.error(`Setup failed: ${error.shortMessage || error.message}`);
  process.exitCode = 1;
} finally { provider?.destroy(); unlock?.(); }
