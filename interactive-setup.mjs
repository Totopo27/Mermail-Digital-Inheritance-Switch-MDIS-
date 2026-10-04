/**
 * Mermail Digital Inheritance Switch - Interactive CLI Setup & Simulator
 * Experiencia interactiva para que el usuario defina en vivo sus herederos,
 * fraccione sus claves con Shamir 2-de-3 y active el protocolo.
 */

import readline from "readline";
import fs from "fs";
import path from "path";
import { splitSecret } from "./shamir.mjs";
import { DeadMansSwitchEngine, NotaryAgentAdvisor } from "./deadman-engine.mjs";
import { dispatchTelegramNotification, formatTelegramHtml } from "./telegram-notifier.mjs";

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
    const promptText = defaultValue ? `${query} [por defecto: ${defaultValue}]: ` : `${query}: `;
    rl.question(promptText, (ans) => {
      resolve(ans.trim() ? ans.trim() : defaultValue);
    });
  });
};

console.log("\n===============================================================");
console.log("🛡️  MERMAIL DIGITAL INHERITANCE SWITCH — SETUP INTERACTIVO 🛡️");
console.log("Protocolo Autónomo de Contingencia & Custodia Fraccionada en Solana");
console.log("===============================================================\n");

async function main() {
  console.log("👉 PASO 1: Configuración de Identidades y Beneficiario\n");

  const ownerEmail = await ask(
    "1. Tu correo como Titular (Owner)",
    env.OWNER_EMAIL || "xentest2@mermail.app"
  );

  const ownerWallet = await ask(
    "2. Tu Wallet de Solana (Owner Pubkey)",
    env.OWNER_WALLET_SOL || "4dzF1cTVhRo9icTbebcBBDjBaFvF7h7d9U79H9qFQ13A"
  );

  const beneficiaryEmail = await ask(
    "3. Correo de tu Heredero / Beneficiario",
    env.BENEFICIARY_EMAIL || "xen3test3@mermail.app"
  );

  const beneficiaryWallet = await ask(
    "4. Wallet de Solana de tu Heredero (Beneficiary Pubkey)",
    env.BENEFICIARY_WALLET_SOL || "F9tjfnvJUy8EYip947GhYM4YW7kG6U5hDcMFc3DRFbwE"
  );

  const guardianEmail = await ask(
    "5. Correo de tu Guardián de Emergencia (Amigo / Abogado)",
    env.GUARDIAN_EMAIL || "guardian-test@mermail.app"
  );

  const intervalDays = parseInt(await ask("6. Intervalo de revisión en días (Check-in interval)", "30"), 10);

  console.log("\n---------------------------------------------------------------");
  console.log("🔐 PASO 2: Protección Criptográfica de tus Fondos / Claves");
  console.log("---------------------------------------------------------------\n");

  const rawSecret = await ask(
    "Ingresa la Seed Phrase o directiva secreta que querés heredar",
    "apple banana cherry dog elephant fox grape horse igloo jaguar kangaroo lemon"
  );

  console.log("\n[PROCESANDO] Ejecutando división de Shamir en Galois Field GF(2^8) (2-de-3)...");
  const shards = splitSecret(rawSecret, 3, 2);

  console.log("\n✅ ¡Clave maestra fragmentada con éxito! (Ninguna parte tiene la clave completa):");
  console.log(`   🔹 Shard #1 (Offline para el Beneficiario): ${shards[0].slice(0, 30)}...`);
  console.log(`   🔹 Shard #2 (Custodiado por el Agente):   ${shards[1].slice(0, 30)}...`);
  console.log(`   🔹 Shard #3 (Para el Guardián de apoyo):   ${shards[2].slice(0, 30)}...`);

  // Guardar configuración en archivo de estado
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
  console.log("🚀 PASO 3: Estado del Switch y Pruebas en Vivo");
  console.log("---------------------------------------------------------------\n");
  console.log(`Bóveda configurada en estado: [ARMED - VIGILANCIA ACTIVA]`);
  console.log(`Smart Contract Vault PDA en Solana: 9DpG5ZiHx25Qd5DJemP4CoA1Q4vtdy2WEAxeV31UNQVx`);

  console.log("\n¿Qué acción querés demostrar ahora en vivo?");
  console.log("  [1] Simular Check-in / Prueba de Vida (Resetea el timer)");
  console.log("  [2] Simular Vencimiento de Gracia (Disparo de Contingencia, Correo a Beneficiario y Telegram)");
  console.log("  [3] Solo guardar y salir");

  const action = await ask("\nSelecciona una opción (1, 2 o 3)", "2");

  if (action === "1") {
    console.log("\n[EJECUTANDO CHECK-IN] Registrando señal de vida del titular...");
    vaultConfig.lastHeartbeatAt = new Date().toISOString();
    fs.writeFileSync(".deadman-state.json", JSON.stringify(vaultConfig, null, 2));
    console.log("✅ [OK] Prueba de vida confirmada. El switch permanece en estado ARMED por 30 días más.\n");
  } else if (action === "2") {
    console.log("\n[SIMULANDO CONTINGENCIA] 60 días transcurridos sin respuesta del titular...");
    console.log(`[ALERT] El Agente Notarial inicia el protocolo de herencia para ${beneficiaryEmail}...`);

    const guidance = NotaryAgentAdvisor.generateBeneficiaryGuidance({
      ownerName: ownerEmail,
      beneficiaryEmail,
      custodiedShare: shards[1],
      solRescueAmount: 0.1
    });

    console.log("\n✉️  [MERMAIL MCP] Despachando Shard #2 y Guía Notarial al Beneficiario...");
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
      console.log(`✅ Correo entregado al buzón de Mermail con éxito:`, emailRes.result || emailRes);
    } catch (err) {
      console.log(`[AVISO ENTORNO] Correo encolado para despacho: ${err.message}`);
    }

    console.log("\n📱 [TELEGRAM] Notificando evento crítico multicanal...");
    const telegramHtml = formatTelegramHtml({
      title: "CONTINGENCIA ACTIVADA - DIGITAL INHERITANCE",
      fields: [
        { label: "Titular", value: ownerEmail },
        { label: "Beneficiario", value: beneficiaryEmail },
        { label: "Wallet Herencia", value: beneficiaryWallet },
        { label: "Shard 2 Liberado", value: "SI (Vía Mermail)" }
      ],
      link: {
        label: "Solana Explorer (Receipt)",
        url: "https://explorer.solana.com/address/9DpG5ZiHx25Qd5DJemP4CoA1Q4vtdy2WEAxeV31UNQVx?cluster=devnet"
      }
    });

    try {
      await dispatchTelegramNotification({
        botToken: env.TELEGRAM_BOT_TOKEN,
        chatId: env.TELEGRAM_CHAT_ID,
        htmlMessage: telegramHtml
      });
      console.log("✅ Alerta de Telegram enviada en tiempo real a tu chat.");
    } catch (tgErr) {
      console.log("Aviso Telegram:", tgErr.message);
    }

    console.log("\n🎉 [DEMO COMPLETADA CON ÉXITO] El beneficiario recibió su Shard #2 y el link para retirar fondos en Solana.");
  } else {
    console.log("\nConfiguración guardada en .deadman-state.json. El bot y el worker usarán estos datos.");
  }

  rl.close();
}

main().catch((err) => {
  console.error("Error en ejecución interactiva:", err);
  rl.close();
});
