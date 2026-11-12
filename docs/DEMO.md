# College demonstration and viva notes

## Before the demonstration

Install dependencies, MetaMask, Arduino board support, and libraries while internet is available. Compile/upload the firmware and rehearse once with the actual laptop and components. Do not rely on downloading anything at the venue.

1. Check external servo power, USB data cable, common ground, and the enrolled fingerprint.
2. Start the chosen mode. Use `npm run demo:reset` for a fresh local chain.
3. Select DecentraPay Local in MetaMask. If the chain was reset, clear the demo account's stale transaction activity if necessary.
4. Open http://127.0.0.1:3000, connect the demo account, and verify chain/device status.
5. Keep the physical servo arm and LED visible to the examiner. Leave the running terminal open.

## Two-minute demonstration

**Explain:** “This is a prototype of a decentralized ATM using Web3. Our smart contract records the payment. An ESP32 verifies a fingerprint and simulates cash dispensing with a servo. We use test funds on a local blockchain.”

**Show the wallet:** Point out its test ETH balance and the enrolled account.

**Select ₹100:** Explain that it represents 0.001 test ETH at an artificial demonstration rate.

**Scan and approve:** Place the enrolled finger on the sensor, then approve the payment in MetaMask. Show the resulting transaction hash, confirmation, lower wallet balance, and physical servo/LED movement.

**Show rejection:** Use an unregistered finger. The app should refuse the withdrawal without asking for payment or moving the servo. In simulator mode, select “Unknown finger” and clearly state that the sensor is being simulated.

**Finish:** Explain the division of work: the contract records payment, the bridge verifies it, and the ESP32 executes the physical action.

## Acceptance sheet

Complete this with the physical components before claiming hardware success:

| Run | Fingerprint matched | Transaction hash recorded | Balance reduced | One real servo/LED cycle |
|---|---|---|---|---|
| ₹100 | ☐ | ☐ | ☐ | ☐ |
| ₹200 | ☐ | ☐ | ☐ | ☐ |
| ₹500 | ☐ | ☐ | ☐ | ☐ |

Also check unknown-finger rejection, cancelling MetaMask approval, and handling a disconnected ESP32. If a payment has already confirmed when USB fails, explain the “dispensing not confirmed” result; do not replay the command.

## Likely viva questions

**What is decentralized here?** The software uses an Ethereum-compatible smart contract and wallet-signed transactions. This classroom setup runs a single local development node; it demonstrates blockchain execution, not a distributed public network.

**Why use a fingerprint?** It links the person at the ATM to the enrolled wallet before the application permits dispensing. It does not replace MetaMask's payment signature.

**Where are fingerprints stored?** Templates remain inside the R307. The laptop stores the template slot-to-wallet mapping, and the blockchain receives neither fingerprint images nor templates.

**Does the ESP32 run the blockchain?** No. The laptop runs the chain and verifies transactions. The ESP32 handles the sensor, LED, and servo over USB.

**Does the smart contract validate fingerprints?** No. That check belongs to the local bridge. The physical system still requires trust in that bridge.

**Are you dispensing real money?** No. Rupees and dispensing are simulated. Test ETH moves into the contract; the servo demonstrates the action after confirmation.

**Can a transaction move the servo twice?** The backend records an attempt before sending a command and rejects repeated processing. The ESP32 also remembers its most recent request. On an ambiguous hardware failure, the app stops rather than automatically trying again.

**How do you know cash came out?** There is no cash sensor. The firmware confirms that it executed its movement sequence, and the examiner observes the physical servo. A production cash mechanism is outside this project's scope.

**Why a local chain?** It allows predictable demonstrations with funded test accounts and no reliance on college internet or public testnet faucets.
