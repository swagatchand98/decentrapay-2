# DecentraPay — Web3 ATM college demo

A simple college demonstration: **connect a wallet → scan a fingerprint → pay test ETH → confirm the transaction → move a servo and light an LED**.

The laptop runs the ATM screen and local blockchain. An ESP32 connects over USB. A labelled hardware simulator lets you develop and present the software before wiring the components. This project uses no real money and does not attempt to build a production ATM.

## Start with the software

Prerequisites: **Node.js 22.12+**, npm, and Chrome/Firefox with MetaMask. Node 24 also meets the application engine requirement; the build and tests were checked with Node 22.12. On a machine using nvm, run `nvm install` then `nvm use` in this folder.

```bash
npm ci
npm run demo
```

Open **http://127.0.0.1:3000** and leave the terminal running. First startup compiles the contract, builds the screen, starts Hardhat, deploys the contract, and starts the simulator bridge. Initial package/extension installation needs internet; the installed project uses no external API, font, CDN, or testnet faucet.

After stopping the all-in-one demo, explicitly start a new chain with:

```bash
npm run demo:reset
```

This archives the previous deployment and dispensing journal and starts a fresh local chain. Fingerprint enrollment is retained. Clear the **demo account’s** MetaMask activity/nonce data after a chain reset if it keeps an old pending transaction. Browser payment recovery detects a different deployment and will not reuse an old payment.

### MetaMask setup

Use a separate demo wallet/profile. Add this custom network:

| Field | Value |
|---|---|
| Network name | DecentraPay Local |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency symbol | `ETH` |
| Block explorer | Leave empty — this is a local chain |

Import Hardhat's second public development account:

```text
Address:     0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Private key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

This is a publicly known **local test key**, never a place to store real funds. The local chain prefunds it; no deposit or faucet is required. The default simulated fingerprint maps to this address. Connect that account in the ATM screen.

Select ₹100, ₹200, or ₹500, leave the simulated fingerprint set to “Enrolled finger,” and click the withdrawal button. Approve the payment in MetaMask. The screen shows the transaction hash and simulated dispense result. The hardware illustration is a visualization, not evidence of a connected device.

| Simulated rupees | Test ETH sent to contract |
|---|---:|
| ₹100 | 0.001 |
| ₹200 | 0.002 |
| ₹500 | 0.005 |

This fixed rate is a demonstration rule, not an exchange rate. MetaMask also deducts gas. Test ETH remains in the contract; there is no withdrawal-to-wallet function or automatic refund.

## Connect the physical hardware

Follow **[the wiring and firmware guide](docs/HARDWARE.md)**. Target components are an ESP32-WROOM-32 development board, R307 fingerprint sensor, SG90 180° positional servo, LED, resistor, breadboard, wires, USB data cable, and regulated 5 V supply.

1. Upload `firmware/DecentraPayATM/DecentraPayATM.ino` using Arduino IDE.
2. Stop the ATM server so the serial port is free. Copy `.env.example` to `.env`, set `HARDWARE_MODE=serial`, and set `SERIAL_PORT` to your board's port.
3. Enroll your finger, following the terminal prompts:

   ```bash
   npm run ports
   npm run enroll -- 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
   npm run hardware:check
   ```

4. Start the demo with `npm run demo:reset`. The screen must say **ESP32 hardware mode**. Run three withdrawals and observe a real LED/servo cycle for each.

`hardware:check` is an explicit bench test: it scans a finger and moves the servo without payment. It is only a terminal command and is unavailable in the ATM web interface. Simulator enrollment and physical enrollment are separate; a simulated scan cannot satisfy hardware mode.

## Commands and reset behavior

For development, keep the blockchain in one terminal and restart the bridge independently:

```bash
# Terminal 1
npm run chain

# Terminal 2: first setup
npm run compile
npm run build
npm run setup
npm start
```

When a deployment already exists, stop the bridge and replace `npm run setup` with `npm run reset`. If you also want fresh wallet balances, stop/restart the chain first. `reset` archives old records and deploys a new contract; it does not magically replenish a running chain's balances. Never run setup/reset while the bridge or enrollment command owns `data/atm.lock`.

Restarting only `npm start` preserves the chain and history. Pending/ambiguous dispensing records become “uncertain” and are **never replayed automatically**. A server or USB interruption after payment cannot reverse the blockchain payment. Inspect the hardware and wallet, then demonstrate again with a new request after resolving the interruption.

| Command | Purpose |
|---|---|
| `npm run demo` | First all-in-one simulator/hardware startup, according to `.env` |
| `npm run demo:reset` | Explicit fresh all-in-one demonstration |
| `npm run chain` | Run the local chain separately |
| `npm run setup` / `npm run reset` | Deploy initially / archive and redeploy |
| `npm run build` | Build the local browser interface |
| `npm start` | Serve the built interface and USB/simulator bridge |
| `npm run enroll -- ADDRESS` | Enroll slot 1 and associate it with a wallet |
| `npm run hardware:check` | Test fingerprint and one servo/LED cycle |
| `npm test` | Run contract and bridge tests on an isolated in-process EVM |
| `npm run test:browser` | Optional UI test against a running simulator |

## Verification

The Solidity contract compiles, the Vite app builds, and the contract/bridge automated tests run on a real in-process Hardhat EVM. Tests cover amount validation, events/value transfers, three withdrawals, fingerprint rejection, session expiry/cancellation, unrelated payments, pending/reverted transactions, replay prevention, hardware failure, restart handling, and HTTP access boundaries.

Browser checks use a test wallet adapter to submit local transactions; they do **not** test the MetaMask extension itself. Install the browser with `npx playwright install chromium`, or set `CHROME_PATH` to your existing Chrome executable, start the simulator, then run `npm run test:browser`. This adds test withdrawals to that demo's history and saves screenshots in `test-results/`.

The implementation environment blocked listening sockets and browser launch, so live browser/MetaMask verification could not be completed there. Arduino compilation/upload and physical acceptance must be completed with Arduino IDE and the actual components. Do not describe hardware operation as verified until the three physical demonstration runs pass.

## Where things live

```text
contracts/       One small Solidity ATM contract
server/          HTTP API, receipt verification, journal, simulator/USB bridge
web/             Plain HTML, CSS, JavaScript ATM interface
firmware/        ESP32 Arduino sketch
scripts/         Startup, deployment, enrollment, optional browser check
test/            Contract and bridge integration tests
docs/            Wiring, architecture, scope, and presentation guides
data/            Generated local enrollment/deployment/history (gitignored)
```

Tooling uses pinned Hardhat **2.29.1**, ethers **6.16.0**, and a local npm-pinned Solidity compiler. Hardhat 2 replaced the originally proposed Hardhat 3 because the implementation environment had those packages available offline. There is no dependency on a global `forge` executable or downloaded Solidity compiler.

Read [PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) for the agreed scope, [ARCHITECTURE.md](docs/ARCHITECTURE.md) for the interfaces, and [DEMO.md](docs/DEMO.md) for the college presentation.

## College presentation pack

The [presentation folder](presentation/README.md) contains an editable 10-slide PowerPoint and a 14-page Word report, with matching PDFs, speaker notes, a printable bench checklist, ATM labels, and a blank physical acceptance sheet. Follow the [purchase and assembly checklist](docs/PRESENTATION_CHECKLIST.md) to move from the working software demo to the physical model.

The pack includes the student's saved simulator transaction evidence and the automated test/build logs. Physical hardware results remain marked NOT RUN. Replace the cover placeholders and add actual assembly photographs and physical results before final submission; re-export the PDFs after editing the Office files.
