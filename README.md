# Mermail Digital Inheritance Switch (MDIS)

Non-custodial contingency and digital inheritance protocol for Solana, operated through Mermail Model Context Protocol (MCP) and Anchor smart contracts.

The project addresses a recurring operational vulnerability in Web3: when account holders become incapacitated, pass away, or lose long-term access to their systems, their private keys and deposited assets remain permanently locked. Delegating custody or release decisions to standard large language models introduces prompt injection attack vectors, unauthenticated SMTP headers, and key exposure risks.

MDIS separates execution into two independent layers: a deterministic mathematical kernel handling timers, cryptographic signatures, and fund release invariants, accompanied by an AI notary advisor that formats status updates and instructions for beneficiaries in plain language.

---

## Architecture and Core Mechanisms

### 1. Mixed Liveness Detection
The inactivity counter does not rely solely on manual check-in emails. The engine queries Solana RPC nodes (`getSignaturesForAddress`) for the owner's public key. Any confirmed outgoing transaction—such as token transfers, decentralized exchange swaps, or governance votes—automatically resets the 30-day inactivity timer without requiring user interaction.

### 2. Ed25519 Cryptographic Proof of Life
When on-chain activity is absent, the owner can issue an active check-in by sending an email to the custodian agent mailbox. To prevent SMTP header spoofing and relay attacks, incoming messages must include a detached Ed25519 signature generated with the owner's Solana keypair. Unsigned messages or signatures older than 24 hours are discarded.

### 3. Shamir's Secret Sharing (2-of-3 Threshold Custody)
Master recovery phrases or private keys are split into three mathematical shares over Galois Field GF(2^8):
* Shard 1: Kept offline by the designated beneficiary.
* Shard 2: Stored in encrypted form by the Mermail custodian agent.
* Shard 3: Assigned to a secondary guardian contact.

No single entity holds the complete secret during standard operation. Reconstructing the master key requires combining any two of the three shares.

### 4. Solana Anchor Smart Contract (`mermail_deadman_vault`)
Deployed on Solana Devnet:
* Program ID: `E4dA4YrWnMgFv7NNseHjw8r2yikArPGiEnrxX4YYExdX`
* Vault PDA: Derived via `[b"deadman_vault", owner]`
* Multi-Asset Escrow: Native SOL and SPL Token (USDC) custody through `transfer_checked` instructions.
* Real-Time Pyth Network Feeds: Price evaluation with freshness checks and a maximum confidence interval dispersion threshold of 300 basis points.
* Non-Custodial Control: The living owner can withdraw assets, deposit additional funds, or rotate configuration parameters at any time while the vault remains active.
* Legal Attestation with Dispute Period: Authorized legal or medical oracles can file an on-chain death certificate hash (`attest_oracle_trigger`). This initiates a mandatory 48-hour dispute window during which the owner can cancel execution by issuing a life-verification ping.

### 5. Tiered Escalation Lifecycle
* Tier 1 (Day 30): Private notice dispatched to the owner.
* Tier 2 (Day 37): Urgent multi-channel notification sent via email and Telegram.
* Tier 3 (Day 45): Escalation to registered guardians. A guardian can submit an emergency hold (`/hold`) to pause countdowns for 14 days during medical emergencies or connectivity loss. Cumulative holds are capped at 60 days to prevent permanent denial of claims.
* Triggered (Day 60): The agent delivers Shard 2 and recovery documentation to the beneficiary, enabling full withdrawal execution on the Anchor smart contract.

---

## Repository Structure

```text
.
├── programs/
│   └── mermail-deadman-vault/      Anchor program source code in Rust
├── skills/
│   └── mermail-deadman-switch/     Mermail MCP agent skill definition
├── deadman-engine.mjs              Deterministic contingency state machine
├── shamir.mjs                      Shamir secret sharing engine in GF(2^8)
├── telegram-notifier.mjs           Sanitized message formatting and TWA auth
├── telegram-bot-service.mjs        Long-polling Telegram command listener
├── interactive-setup.mjs           CLI setup and live contingency simulator
├── worker.mjs                      Serverless runtime for Cloudflare Workers
├── run-all-tests.mjs               Sequential runner for all 9 validation suites
└── test-*.mjs                      Integration, invariant, and red-teaming suites
```

---

## Prerequisites

* Node.js version 20 or higher.
* Access to a Solana RPC endpoint (Devnet or Mainnet).
* Mermail MCP credentials (API key and configured mailboxes).
* Telegram Bot token and target Chat ID (optional, for real-time mobile push notifications).

---

## Installation and Configuration

1. Clone the repository:
```bash
git clone https://github.com/Totopo27/Mermail-Digital-Inheritance-Switch-MDIS-.git
cd Mermail-Digital-Inheritance-Switch-MDIS-
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
Create a `.env` file in the project root following this template:
```env
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
TELEGRAM_CHAT_ID="your_telegram_chat_id"
SOLANA_RPC_URL="https://api.devnet.solana.com"
MERMAIL_MCP_URL="https://console.mermail.app/mcp"
MERMAIL_API_KEY="your_mermail_api_key"

CUSTODIAN_EMAIL="agent@mermail.app"
CUSTODIAN_MAILBOX_ID="agent_mailbox_id"

OWNER_EMAIL="owner@mermail.app"
OWNER_MAILBOX_ID="owner_mailbox_id"
OWNER_WALLET_SOL="owner_public_key"

BENEFICIARY_EMAIL="beneficiary@mermail.app"
BENEFICIARY_MAILBOX_ID="beneficiary_mailbox_id"
BENEFICIARY_WALLET_SOL="beneficiary_public_key"

GUARDIAN_EMAIL="guardian@notary.org"
```

---

## Operational Workflows

### Interactive Onboarding Wizard
Guides the user through role setup, generates Shamir shares for the secret phrase, and simulates both life check-ins and emergency triggering:
```bash
npm run demo
```

### Continuous Telegram Service
Launches the persistent bot service to process incoming commands (`/status`, `/checkin`, `/hold`):
```bash
npm run bot
```

### Test Suite Execution
The repository includes unit validations, on-chain state machine invariant tests, adversarial prompt-injection tests, and network simulations:

Execute the full suite (9 suites, 66 tests):
```bash
npm run test:all
```

Execute individual test suites:
```bash
# Core skill scenario tests
npm test

# Solana Anchor program tests (USDC escrow, Pyth feeds, timelocks)
npm run test:contract

# Live network tests (Solana Devnet RPC and Mermail MCP)
npm run test:live

# Adversarial red-team stress tests
npm run test:redteam

# Confirmed death attestation with 48h dispute window
npm run test:death
```

---

## License

Distributed under the MIT License. See `LICENSE` for details.
