# Five-minute presentation script

## Slide 1 — DecentraPay (20 seconds)

“Our project is a decentralized ATM prototype using Web3. A user verifies a fingerprint, approves a local test payment, and sees a simulated cash-dispensing action. The laptop is the screen, and an ESP32 connects to the physical components.”

Introduce the team and guide. State that this is a college demonstration with test funds.

## Slide 2 — Objective (20 seconds)

“We wanted to connect a wallet-signed smart-contract transaction to a visible hardware action. The learning objective is to understand identity checking, blockchain confirmation, and device control in one workflow.”

Do not claim the project replaces a bank or solves every trust/security issue.

## Slide 3 — Scope (20 seconds)

“There is one local ATM and one enrolled user. The rupee amounts are simulated, with a fixed demonstration rate. We are demonstrating a servo action, not feeding or counting real notes.”

## Slide 4 — Architecture (30 seconds)

Point to the browser, chain, bridge, and ESP32. “MetaMask signs the payment. The local smart contract records it. The Node bridge checks the receipt and tells the ESP32 to run the motor. The bridge is trusted; the blockchain does not directly inspect fingerprints or cash.”

## Slide 5 — Hardware (20 seconds)

Identify the ESP32, R307, SG90, and LED. Explain the USB link and separate peripheral supply. Show physical components only if they are actually assembled; otherwise describe them as the planned hardware stage.

## Slide 6 — Software and contract (25 seconds)

“The application uses plain HTML/CSS/JavaScript, a small Node server, and one Solidity contract. The contract accepts three amounts, rejects repeated request IDs, and emits a payment event. There is no bank account or external price feed.”

## Slide 7 — Workflow (25 seconds)

Walk through the four visible steps. Explain that every new request needs a matching finger and that the wallet approves the payment separately. The servo runs only after the bridge verifies confirmation.

## Slide 8 — Live demonstration (90 seconds)

Switch to the running ATM page. Confirm the mode banner aloud.

1. Show the enrolled wallet and balance.
2. Select Rs 100 and start verification.
3. Scan the enrolled finger (or clearly describe the simulated scan).
4. Approve in MetaMask.
5. Show the confirmed transaction and reduced balance.
6. Show the physical servo/LED cycle if in hardware mode.

If time allows, show an unknown finger being rejected. If hardware is not ready, call the run a software simulation. If the live demo fails, explain the displayed error and show a labelled recording only if a real recording exists.

## Slide 9 — Evidence and limitations (30 seconds)

“The automated software checks pass, including duplicate prevention and failure handling. The saved simulator journal contains three successful payments and two failed scan cases. Physical acceptance is recorded separately.”

Before presenting, update the physical status based on actual observations. The current delivered slide correctly says that hardware testing is pending.

## Slide 10 — Conclusion (20 seconds)

“This prototype connects a wallet payment with a hardware-control workflow that we can explain and demonstrate. It uses a single local blockchain and a trusted bridge; it does not dispense real cash or operate as a banking service.”

Invite questions. Keep the scope small rather than promising a future production rollout.

## If asked

- **Where are fingerprints stored?** In the sensor; the laptop stores only the slot-to-wallet mapping.
- **Why MetaMask and fingerprint?** The fingerprint checks the person at the terminal, while MetaMask approves the wallet payment.
- **What is decentralized?** Wallet-signed transactions and smart-contract execution are demonstrated. The local chain is a single node and the hardware bridge is trusted.
- **What if payment succeeds but USB fails?** The payment remains on-chain; the app reports uncertainty and does not automatically repeat the physical action.
- **Does the firmware prove cash came out?** No. It acknowledges completion of its movement sequence. There is no cash or shaft-position sensor.
- **Why is the same account required?** Sensor slot 1 is mapped to the supplied demo wallet. Connecting any other wallet does not satisfy that enrollment.
