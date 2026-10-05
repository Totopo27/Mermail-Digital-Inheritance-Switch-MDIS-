/**
 * Deadman Vault Client & State Machine Simulator
 * Mirrors the on-chain Anchor smart contract (programs/mermail-deadman-vault)
 * Used by in-process invariant tests and contract test suites.
 */

import { PublicKey } from "@solana/web3.js";

export const DEADMAN_PROGRAM_ID = new PublicKey("DMSvauLt11111111111111111111111111111111111");
export const RENT_RESERVE_MINIMUM_LAMPORTS = 2_000_000; // 0.002 SOL

export function getVaultPda(ownerPubkey, programId = DEADMAN_PROGRAM_ID) {
  const seeds = [Buffer.from("deadman_vault"), ownerPubkey.toBuffer()];
  return PublicKey.findProgramAddressSync(seeds, programId);
}

export function evaluateVaultClaimability(vault, currentTimestamp) {
  if (vault.isClosed) {
    return { claimable: false, reason: "Vault is already closed" };
  }
  if (vault.status === "Triggered") {
    return { claimable: true, reason: "Vault already triggered" };
  }
  const deadline = vault.lastHeartbeatTimestamp + vault.heartbeatIntervalSeconds + vault.gracePeriodSeconds;
  if (currentTimestamp < deadline) {
    return { claimable: false, reason: "Timelock not expired" };
  }
  return { claimable: true, reason: "Timelock expired" };
}

export class SolanaDeadmanVaultSimulator {
  constructor({
    owner,
    beneficiary,
    guardian,
    oracleAttestation = null,
    heartbeatIntervalSeconds = 30 * 86400,
    gracePeriodSeconds = 14 * 86400,
    initialTimestamp = Math.floor(Date.now() / 1000)
  }) {
    this.owner = owner;
    this.beneficiary = beneficiary;
    this.guardian = guardian;
    this.oracleAttestation = oracleAttestation;
    this.heartbeatIntervalSeconds = heartbeatIntervalSeconds;
    this.gracePeriodSeconds = gracePeriodSeconds;
    this.lastHeartbeatTimestamp = initialTimestamp;
    this.lamports = 0;
    this.splTokenBalance = 0;
    this.splTokenMint = null;
    this.pythPriceFeed = null;
    this.status = "Active";
    this.isClosed = false;
    this.totalHoldSecondsConsumed = 0;
    this.holdUntilTimestamp = 0;
    this.oracleDisputeUntil = 0;
    const [pda] = getVaultPda(this.owner);
    this.pda = pda;
  }

  deposit(lamports) {
    if (this.isClosed) throw new Error("VaultIsClosed");
    this.lamports += lamports;
    return this.lamports;
  }

  withdraw(lamports, callerPubkey) {
    if (this.status === "Triggered") throw new Error("VaultAlreadyTriggered");
    if (!this.owner.equals(callerPubkey)) throw new Error("UnauthorizedCaller");
    if (this.lamports < lamports) throw new Error("InsufficientFunds");
    this.lamports -= lamports;
    return this.lamports;
  }

  depositSplTokens(amount, mintPubkey, callerPubkey) {
    if (this.isClosed) throw new Error("VaultIsClosed");
    if (!this.owner.equals(callerPubkey)) throw new Error("UnauthorizedCaller");
    if (this.splTokenMint && !this.splTokenMint.equals(mintPubkey)) {
      throw new Error("MismatchedMint");
    }
    this.splTokenMint = mintPubkey;
    this.splTokenBalance += amount;
    return this.splTokenBalance;
  }

  ping(callerPubkey, timestamp) {
    if (this.isClosed) throw new Error("VaultIsClosed");
    if (!this.owner.equals(callerPubkey)) throw new Error("UnauthorizedCaller");
    this.lastHeartbeatTimestamp = timestamp;
    this.status = "Active";
    this.oracleDisputeUntil = 0;
    return true;
  }

  applyGuardianHold(callerPubkey, durationSeconds, currentTimestamp) {
    if (!this.guardian.equals(callerPubkey)) throw new Error("UnauthorizedCaller");
    if (durationSeconds > 30 * 86400) throw new Error("InvalidHoldDuration");
    if (this.totalHoldSecondsConsumed + durationSeconds > 60 * 86400) {
      throw new Error("CumulativeHoldLimitExceeded");
    }
    this.totalHoldSecondsConsumed += durationSeconds;
    this.holdUntilTimestamp = currentTimestamp + durationSeconds;
    return true;
  }

  attestOracleTrigger(callerPubkey, certHash, currentTimestamp) {
    if (!this.oracleAttestation || !this.oracleAttestation.equals(callerPubkey)) {
      throw new Error("UnauthorizedOracle");
    }
    this.oracleDisputeUntil = currentTimestamp + 48 * 3600;
    return true;
  }

  validatePythPrice(feed, currentTimestamp) {
    if (feed.price <= 0) throw new Error("InvalidPrice");
    if (currentTimestamp - feed.publishTime > 120) throw new Error("StalePriceFeed");
    const confBps = (feed.conf / feed.price) * 10000;
    if (confBps > 300) throw new Error("PriceConfidenceTooWide");
    const realPrice = feed.price * Math.pow(10, feed.expo);
    return { valid: true, realPrice, confBps };
  }

  updateConfig(callerPubkey, { guardian, heartbeatInterval }) {
    if (!this.owner.equals(callerPubkey)) throw new Error("UnauthorizedCaller");
    if (this.status === "Triggered") throw new Error("VaultAlreadyTriggered");
    if (guardian) this.guardian = guardian;
    if (heartbeatInterval) this.heartbeatIntervalSeconds = heartbeatInterval;
    return true;
  }

  claimInheritance(callerPubkey, currentTimestamp) {
    if (this.isClosed) throw new Error("VaultIsClosed");
    if (!this.beneficiary.equals(callerPubkey)) throw new Error("UnauthorizedBeneficiary");
    if (this.holdUntilTimestamp > 0 && currentTimestamp < this.holdUntilTimestamp) {
      throw new Error("Guardian emergency hold active");
    }
    if (this.status === "Triggered") {
      throw new Error("Vault has already been triggered");
    }
    if (this.oracleDisputeUntil > 0 && currentTimestamp < this.oracleDisputeUntil) {
      throw new Error("Oracle dispute window active (48h)");
    }
    const check = evaluateVaultClaimability(this, currentTimestamp);
    if (!check.claimable) {
      throw new Error(check.reason);
    }
    this.status = "Triggered";
    const available = Math.max(0, this.lamports - RENT_RESERVE_MINIMUM_LAMPORTS);
    this.lamports -= available;
    return {
      success: true,
      claimedLamports: available,
      rentRetained: this.lamports
    };
  }

  claimSplInheritance(callerPubkey, mintPubkey, currentTimestamp) {
    if (this.isClosed) throw new Error("VaultIsClosed");
    if (!this.beneficiary.equals(callerPubkey)) throw new Error("UnauthorizedBeneficiary");
    if (this.oracleDisputeUntil > 0 && currentTimestamp < this.oracleDisputeUntil) {
      throw new Error("Oracle dispute window active (48h)");
    }
    const check = evaluateVaultClaimability(this, currentTimestamp);
    if (!check.claimable) {
      throw new Error(check.reason);
    }
    this.status = "Triggered";
    if (this.splTokenBalance === 0) throw new Error("NoTokensToClaim");
    if (this.splTokenMint && !this.splTokenMint.equals(mintPubkey)) {
      throw new Error("MismatchedMint");
    }
    const claimedTokens = this.splTokenBalance;
    this.splTokenBalance = 0;
    return { success: true, claimedTokens };
  }

  closeVault(callerPubkey) {
    if (this.isClosed) throw new Error("VaultAlreadyClosed");
    if (!this.beneficiary.equals(callerPubkey) && !this.owner.equals(callerPubkey)) {
      throw new Error("UnauthorizedCaller");
    }
    const refundedRent = this.lamports;
    this.lamports = 0;
    this.isClosed = true;
    return { success: true, refundedRent };
  }
}
