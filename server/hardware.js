import { randomUUID } from 'node:crypto';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export class Simulator {
  mode = 'simulator';
  connected = true;
  cycles = 0;
  used = new Set();
  async status() { return { connected: this.connected, sensorReady: this.connected, mode: this.mode, cycles: this.cycles }; }
  async scan(result = 'match') {
    await sleep(650);
    if (!this.connected) throw new Error('Hardware simulator disconnected.');
    if (result === 'error') throw new Error('Simulated sensor communication error.');
    if (result === 'unknown') throw new Error('Fingerprint not recognized. Try the enrolled finger.');
    return { slot: 1 };
  }
  async enroll() { return { slot: 1 }; }
  async dispense(id) {
    if (!this.connected) throw new Error('Hardware simulator disconnected.');
    if (this.used.has(id)) throw new Error('Duplicate dispense command refused.');
    this.used.add(id);
    this.cycles++;
    await sleep(1400);
    return { completed: true };
  }
  async close() {}
}

export class SerialHardware {
  mode = 'serial';
  connected = false;
  pending = new Map();
  busy = false;
  constructor(serialPath) { this.serialPath = serialPath; }
  async connect() {
    if (!this.serialPath) throw new Error('Set SERIAL_PORT in .env; run npm run ports to list USB devices.');
    const { SerialPort, ReadlineParser } = await import('serialport');
    this.port = new SerialPort({ path: this.serialPath, baudRate: 115200, autoOpen: false });
    this.port.on('error', error => this.fail(error));
    this.port.on('close', () => this.fail(new Error('ESP32 disconnected.')));
    this.port.pipe(new ReadlineParser({ delimiter: '\n' })).on('data', line => {
      let msg;
      try { msg = JSON.parse(line.trim()); } catch { return; } // ESP32 boot messages aren't protocol packets.
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      if (msg.event === 'progress') { console.log(`Fingerprint: ${msg.message}`); return; }
      clearTimeout(pending.timer);
      this.pending.delete(msg.id);
      msg.ok ? pending.resolve(msg) : pending.reject(new Error(msg.error || 'ESP32 command failed.'));
    });
    await new Promise((resolve, reject) => this.port.open(error => error ? reject(error) : resolve()));
    this.connected = true;
    await sleep(2000); // Opening USB can reset the board.
    await this.command('status');
  }
  fail(error) {
    this.connected = false;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(error); }
    this.pending.clear();
  }
  async command(command, extra = {}, timeout = 5000) {
    if (!this.connected) throw new Error('ESP32 disconnected. Reconnect it and restart the ATM server.');
    if (this.busy) throw new Error('ESP32 is busy. Wait for the current operation.');
    this.busy = true;
    const id = randomUUID();
    try {
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.fail(new Error('ESP32 response timed out. Inspect the hardware and restart the server; dispensing will not be retried.'));
        }, timeout);
        this.pending.set(id, { resolve, reject, timer });
        this.port.write(JSON.stringify({ id, command, ...extra }) + '\n', error => {
          if (error) this.fail(error);
        });
      });
    } finally { this.busy = false; }
  }
  async status() {
    if (!this.connected || this.busy) return { connected: this.connected, mode: this.mode, busy: this.busy };
    const r = await this.command('status');
    return { connected: true, mode: this.mode, sensorReady: r.sensorReady };
  }
  scan() { return this.command('scan', {}, 35000); }
  enroll() { return this.command('enroll', { slot: 1 }, 90000); }
  dispense(requestId) { return this.command('dispense', { requestId }, 10000); }
  async close() {
    if (this.port?.isOpen) await new Promise(resolve => this.port.close(resolve));
  }
}

export async function createHardware({ mode, serialPath }) {
  if (mode === 'simulator') return new Simulator();
  const hardware = new SerialHardware(serialPath);
  try { await hardware.connect(); return hardware; }
  catch (error) { await hardware.close(); throw error; }
}
