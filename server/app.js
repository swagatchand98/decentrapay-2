import express from 'express';
import path from 'node:path';
import { AMOUNTS, CHAIN_ID, ROOT, RPC_URL } from './config.js';

export function createApp({ atm, port }) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!allowedHosts.includes(req.headers.host)) return res.status(403).json({ error: 'Use the local ATM address.' });
    if (req.headers.origin && !allowedHosts.some(h => req.headers.origin === `http://${h}`)) {
      return res.status(403).json({ error: 'Only the local ATM page may access this service.' });
    }
    if (req.method === 'POST' && !req.is('application/json')) return res.status(415).json({ error: 'Send JSON.' });
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '8kb' }));
  app.get('/api/config', (_req, res) => res.json({
    chainId: CHAIN_ID, rpcUrl: RPC_URL, address: atm.deployment.address, deploymentId: atm.deployment.id,
    abi: atm.iface.fragments.map(f => JSON.parse(f.format('json'))),
    mode: atm.hardware.mode, enrolledWallet: atm.enrollment.wallet, amounts: AMOUNTS,
  }));
  app.get('/api/status', async (_req, res) => {
    let chain = { connected: true };
    let hardware;
    try { await atm.assertChain(); } catch (e) { chain = { connected: false, error: e.message }; }
    try { hardware = await atm.hardware.status(); } catch (e) { hardware = { connected: false, error: e.message, mode: atm.hardware.mode }; }
    res.json({ chain, hardware });
  });
  app.get('/api/withdrawals', (_req, res) => res.json(atm.history()));
  app.get('/api/withdrawals/:id', (req, res) => { atm.expire(); res.json(atm.find(req.params.id)); });
  app.post('/api/withdrawals', async (req, res) => res.status(201).json(await atm.create(req.body)));
  app.post('/api/withdrawals/:id/submit', async (req, res) => res.json(await atm.submit(req.params.id, req.body.txHash)));
  app.post('/api/withdrawals/:id/cancel', (req, res) => res.json(atm.cancel(req.params.id)));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown ATM endpoint.' }));
  app.use(express.static(path.join(ROOT, 'dist')));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message || 'ATM request failed.' }));
  return app;
}
