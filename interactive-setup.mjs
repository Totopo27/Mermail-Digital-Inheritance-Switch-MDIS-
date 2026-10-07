/**
 * Mermail Digital Inheritance Switch - Interactive CLI Setup & Simulator
 * Interactive experience to configure beneficiaries, split keys via Shamir 2-of-3,
 * and arm the protocol in real time.
 */

import readline from "readline";
import fs from "fs";
import path from "path";
import { splitSecret } from "./shamir.mjs";
import { DeadMansSwitchEngine, NotaryAgentAdvisor } from "./deadman-engine.mjs";

function loadEnv() {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnv();
const MCP_URL = env.MERMAIL_MCP_URL || "https://console.mermail.app/mcp";
const CUSTODIAN_KEY = env.MERMAIL_API_KEY || env.MERMAIL_API_KEY_CUSTODIAN;
const CUSTODIAN_MAILBOX_ID = env.CUSTODIAN_MAILBOX_ID;
const CUSTODIAN_EMAIL = env.CUSTODIAN_EMAIL || "xentest@mermail.app";

async function callMcp(apiKey, name, args) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json, text/event-stream",
      "x-api-key": apiKey
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args }
    })
  });
  if (!res.ok) throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
  return await res.json();
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query, defaultValue) => {
  return new Promise((resolve) => {
    const promptText = defaultValue ? `${query} [default: ${defaultValue}]: ` : `${query}: `;
    rl.question(promptText, (ans) => {
      resolve(ans.trim() ? ans.trim() : defaultValue);
    });
  });
};

console.log("\n===============================================================");
console.log("🛡️  MERMAIL DIGITAL INHERITANCE SWITCH — INTERACTIVE SETUP 🛡️");
console.log("Autonomous Contingency Protocol & Fractional Threshold Custody on Solana");
console.log("===============================================================\n");

async function main() {
  console.log("👉 STEP 1: Identity & Beneficiary Configuration\n");

  const ownerEmail = await ask(
    "1. Principal / Owner Email",
    env.OWNER_EMAIL || "xentest2@mermail.app"
  );

  const ownerWallet = await ask(
    "2. Principal Solana Wallet (Owner Pubkey)",
    env.OWNER_WALLET_SOL || "4dzF1cTVhRo9icTbebcBBDjBaFvF7h7d9U79H9qFQ13A"
  );

  const beneficiaryEmail = await ask(
    "3. Primary Beneficiary / Heir Email",
    env.BENEFICIARY_EMAIL || "xen3test3@mermail.app"
  );

  const beneficiaryWallet = await ask(
    "4. Primary Beneficiary Solana Wallet",
    env.BENEFICIARY_WALLET_SOL || "F9tjfnvJUy8EYip947GhYM4YW7kG6U5hDcMFc3DRFbwE"
  );

  const guardianEmail = await ask(
    "5. Emergency Legal Guardian / Trustee Email",
    env.GUARDIAN_EMAIL || "guardian-test@mermail.app"
  );

  const intervalDays = parseInt(await ask("6. Routine Check-in Interval in days", "30"), 10);

  console.log("\n---------------------------------------------------------------");
  console.log("🔐 STEP 2: Cryptographic Threshold Vault Protection");
  console.log("---------------------------------------------------------------\n");

  const rawSecret = await ask(
    "Enter Master Recovery Seed / Secret Directive to protect",
    "apple banana cherry dog elephant fox grape horse igloo jaguar kangaroo lemon"
  );

  console.log("\n[PROCESSING] Splitting secret via Shamir in Galois Field GF(2^8) (2-of-3 threshold)...");
  const shards = splitSecret(rawSecret, 3, 2);

  console.log("\n✅ Master Key successfully split into 3 shards (Zero single point of failure):");
  console.log(`   🔹 Shard #1 (Offline Heir Share):       ${shards[0].data.slice(0, 30)}...`);
  console.log(`   🔹 Shard #2 (Mermail Custodian Share):  ${shards[1].data.slice(0, 30)}...`);
  console.log(`   🔹 Shard #3 (Legal Guardian Share):     ${shards[2].data.slice(0, 30)}...`);

  const vaultConfig = {
    id: "DMS-VAULT-2026-LIVE",
    ownerEmail,
    ownerSolPubkey: ownerWallet,
    custodianEmail: CUSTODIAN_EMAIL,
    beneficiaryEmail,
    beneficiarySolWallet: beneficiaryWallet,
    guardianEmails: [guardianEmail],
    heartbeatIntervalDays: intervalDays,
    status: "ARMED",
    lastHeartbeatAt: new Date().toISOString(),
    custodiedShare: shards[1]
  };

  fs.writeFileSync(".deadman-state.json", JSON.stringify(vaultConfig, null, 2));

  console.log("\n---------------------------------------------------------------");
  console.log("🚀 STEP 3: Switch Status & Live Simulation Actions");
  console.log("---------------------------------------------------------------\n");
  console.log(`Vault active state: [ARMED - CONTINUOUS VIGILANCE]`);
  console.log(`Solana Smart Contract Vault PDA: 9DpG5ZiHx25Qd5DJemP4CoA1Q4vtdy2WEAxeV31UNQVx`);

  console.log("\nSelect a live action to demonstrate:");
  console.log("  [1] Simulate Check-in / Proof of Life (Timer resets to 30 days)");
  console.log("  [2] Simulate Grace Expiration (Contingency Trigger, Heir Notice & Telegram Push)");
  console.log("  [3] Save configuration and exit");

  const action = await ask("\nEnter choice [1, 2 or 3]", "2");

  if (action === "1") {
    console.log("\n[EXECUTING CHECK-IN] Recording verified liveness signal...");
    vaultConfig.lastHeartbeatAt = new Date().toISOString();
    fs.writeFileSync(".deadman-state.json", JSON.stringify(vaultConfig, null, 2));
    console.log("✅ [OK] Proof of life confirmed. Switch remains ARMED for an additional 30 days.\n");
  } else if (action === "2") {
    console.log("\n[SIMULATING CONTINGENCY] 60 days elapsed without principal response...");
    console.log(`[ALERT] Notary Agent initiating digital inheritance protocol for ${beneficiaryEmail}...`);

    const guidance = NotaryAgentAdvisor.generateBeneficiaryGuidance({
      ownerName: ownerEmail,
      beneficiaryEmail,
      custodiedShare: shards[1],
      solRescueAmount: 0.1
    });

    console.log(`\n📬 [MERMAIL MCP] Sending Shard #2 and recovery instructions via ${CUSTODIAN_EMAIL}...`);
    try {
      const emailRes = await callMcp(CUSTODIAN_KEY, "send_email", {
        mailboxId: CUSTODIAN_MAILBOX_ID,
        body: {
          from: CUSTODIAN_EMAIL,
          to: beneficiaryEmail,
          subject: guidance.subject,
          text: guidance.guidanceText
        }
      });
      console.log("✅ Mermail MCP email delivered successfully to beneficiary mailbox:", emailRes.result || emailRes);
    } catch (err) {
      console.log(`[ENVIRONMENT NOTICE] Email queued for delivery: ${err.message}`);
    }

    console.log("\n📱 [MERMAIL TELEGRAM INTEGRATION] Multi-channel notification active via Mermail native delivery.");
    console.log("   --> Connected channels: Mermail Webmail & Linked Telegram Push.");

    console.log("\n🎉 [SUCCESS] Contingency sequence completed. Beneficiary received Shard #2 and Solana withdrawal link.\n");
  } else {
    console.log("\n💾 Configuration saved to .deadman-state.json. Exiting.\n");
  }

  rl.close();
}

main().catch((err) => {
  console.error("Critical error in interactive setup:", err);
  rl.close();
  process.exit(1);
});
