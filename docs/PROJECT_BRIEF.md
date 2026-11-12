# Project brief

**Topic:** Decentralized ATM system using Web3.

**Purpose:** A working, understandable college demonstration. The student does not intend to maintain or expand it into a production business. Prefer a small implementation with a clear explanation over additional infrastructure or features.

## Agreed demonstration

- One laptop, one USB-connected ESP32, one fingerprint enrollment, and one demo wallet.
- MetaMask approves real transactions on a local Ethereum-compatible blockchain.
- ₹100 / ₹200 / ₹500 simulated cash costs 0.001 / 0.002 / 0.005 local test ETH.
- The sensor verifies the enrolled finger for each request; the bridge verifies the blockchain payment; the servo and LED demonstrate dispensing.
- Servo movement alone is the physical objective. No real notes, feeders, or bill counters are required.
- Software-first development uses a clearly labelled hardware simulator. Physical mode must never silently fall back to simulation.

## Boundaries

No real money, banking services, public deployment, public testnet, token launch, cash deposit mechanism, price feed, mobile app, multi-ATM system, fingerprint cloud storage, or production security claim.

The local chain demonstrates Web3 transaction execution; it is a single development node, not an independently operated decentralized network. Fingerprint checking, hardware access, and dispensing records rely on the local bridge. Explain these limits accurately during the viva.

## Done means

The software passes its checks, the student can install/start/reset it using the guides, and the physical system completes three consecutive demonstrations. Each shows a matching fingerprint, a confirmed transaction hash, a decreased wallet balance, and exactly one visible servo/LED cycle. Physical completion remains pending until performed on the actual components.
