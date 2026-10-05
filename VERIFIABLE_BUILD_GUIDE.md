# Verifiable Build & On-Chain Verification Guide (solana-verify)
> **Standard:** Solana Foundation & OtterSec Verifiable Builds (`DEP-002` / `OPS-026`)

## 1. Overview
In Solana, when a program is deployed to Devnet or Mainnet, explorers (SolanaFM, Solscan, Solana Explorer) display **"Program Not Verified"** until a deterministic build matches the deployed on-chain bytecode bit-by-bit.

This guide details the exact steps to compile using `solana-verify` in Docker and upload the verification PDA.

---

## 2. Prerequisites & Configuration

Our repository is already pre-configured for deterministic builds:
- **`Cargo.toml` (root):**
  ```toml
  [workspace.metadata.cli]
  solana = "1.18.17"
  ```
- **`programs/mermail-deadman-vault/Cargo.toml`:**
  - Standard Anchor dependencies with `solana-security-txt = "1.1.1"`.
- **Docker:**
  - Docker daemon running locally or in CI (`docker --version`).

---

## 3. Step-by-Step Verification Procedure

### Step 3.1: Install `solana-verify` CLI
Install the official tool locally:
```bash
cargo install solana-verify --locked
```

### Step 3.2: Build Deterministally via Docker
Run the build command from the root of the repository. `solana-verify` pulls the pinned Solana compiler Docker image (`ellipsislabs/solana-verifiable-build`) and compiles `mermail_deadman_vault` in a clean container:
```bash
solana-verify build --library-name mermail_deadman_vault
```
*Output Artifact:* `target/deploy/mermail_deadman_vault.so`

### Step 3.3: Verify Locally against Deployed Program
Verify that the newly compiled `.so` hash matches the on-chain deployed program:
```bash
solana-verify get-program-hash target/deploy/mermail_deadman_vault.so
solana-verify get-program-hash -u devnet E4dA4YrWnMgFv7NNseHjw8r2yikArPGiEnrxX4YYExdX
```
Both SHA-256 hashes must be identical.

### Step 3.4: Deploy/Upgrade the Program to Solana Devnet
Deploy the updated binary (which includes `security.txt` and the security patches):
```bash
solana program deploy \
  --program-id deployer-keypair.json \
  target/deploy/mermail_deadman_vault.so \
  --url devnet
```

### Step 3.5: Upload On-Chain Verification Metadata
Using the program's Upgrade Authority keypair (`4dzF1...FQ13A` shown in the explorer):
```bash
solana-verify upload-and-verify \
  --program-id E4dA4YrWnMgFv7NNseHjw8r2yikArPGiEnrxX4YYExdX \
  --keypair-path <PATH_TO_UPGRADE_AUTHORITY_KEYPAIR> \
  --url devnet
```
This transaction creates a Program Derived Address (PDA) on Solana with the build parameters (git commit hash, repository URL, Docker image digest).

---

## 4. Explorer Verification Indexing
Once the verification PDA is initialized:
1. OtterSec's remote verification indexer detects the transaction.
2. It clones our public GitHub repository at the recorded commit, replicates the Docker build, and confirms the hash match.
3. SolanaFM, Solscan, and Solana Explorer update their status:
   - **Verified Build:** changes from `Program Not Verified` to `Verified (OtterSec / Solana Foundation)`
   - **Security.txt:** resolves to display our contacts (`security@mermail.io`) and `SECURITY.md` link.
