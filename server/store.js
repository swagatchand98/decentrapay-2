import { existsSync, writeFileSync, renameSync, openSync, closeSync, readFileSync, unlinkSync } from 'node:fs';

export function writeJson(file, value) {
  writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  renameSync(`${file}.tmp`, file);
}

// A single bridge/enrollment process owns the hardware and journal at a time.
export function acquireLock(file) {
  if (existsSync(file)) {
    const pid = Number(readFileSync(file, 'utf8'));
    if (!Number.isInteger(pid) || pid <= 0) throw new Error(`Invalid lock: ${file}. Remove it only after stopping the ATM.`);
    try { process.kill(pid, 0); }
    catch (error) {
      if (error.code !== 'ESRCH') throw error;
      unlinkSync(file);
    }
  }
  let fd;
  try { fd = openSync(file, 'wx', 0o600); }
  catch { throw new Error('Another ATM/setup/enrollment process is running. Stop it first.'); }
  writeFileSync(fd, String(process.pid));
  closeSync(fd);
  return () => {
    if (existsSync(file) && readFileSync(file, 'utf8') === String(process.pid)) unlinkSync(file);
  };
}

export class Journal {
  constructor(file, deploymentId) {
    this.file = file;
    this.data = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { deploymentId, requests: [] };
    if (this.data.deploymentId !== deploymentId) throw new Error('Journal belongs to another deployment. Run the documented reset procedure.');
    for (const r of this.data.requests) {
      if (['submitted', 'verifying', 'dispensing'].includes(r.status)) {
        r.status = 'uncertain';
        r.message = 'Interrupted by restart. Inspect the wallet and hardware; dispensing will not be retried.';
      } else if (['scanning', 'authorized'].includes(r.status)) {
        r.status = 'cancelled';
        r.message = 'Session ended on restart. Check MetaMask for any pending payment.';
      }
    }
    this.save();
  }
  get requests() { return this.data.requests; }
  save() { writeJson(this.file, this.data); }
}
