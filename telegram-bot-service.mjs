/**
 * Telegram Bot Service - Mermail Dead Man's Switch
 * Long-polling service for real-time bidirectional interaction.
 *
 * Supported Commands:
 * - /start    : Welcome and command guide.
 * - /status   : Switch status, last heartbeat, and timer health.
 * - /checkin  : Submit active proof of life (resets inactivity timer).
 * - /hold     : Apply emergency hold (Guardian/Authorized user).
 * - /help     : Detailed usage instructions.
 */

import fs from "fs";
import path from "path";
import { DeadMansSwitchEngine } from "./deadman-engine.mjs";
import {
  dispatchTelegramNotification,
  formatTelegramHtml,
  formatInlineKeyboard,
  isAuthorizedTelegramSender
} from "./telegram-notifier.mjs";

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
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = process.env.TELEGRAM_CHAT_ID || env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN) {
  console.error("[ERROR] Missing TELEGRAM_BOT_TOKEN in environment or .env");
  process.exit(1);
}

// State storage
const STATE_FILE = path.resolve(".deadman-state.json");

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    } catch {}
  }
  return {
    id: "DMS-VAULT-2026-XEN",
    status: "ARMED",
    lastHeartbeatAt: new Date().toISOString(),
    heartbeatIntervalDays: 30,
    gracePeriodHours: 48,
    ownerEmail: env.OWNER_EMAIL || "owner@mermail.app",
    beneficiaryEmail: env.BENEFICIARY_EMAIL || "beneficiary@mermail.app",
    beneficiarySolWallet: env.BENEFICIARY_WALLET_SOL || "F9tjfnvJUy8EYip947GhYM4YW7kG6U5hDcMFc3DRFbwE",
    guardianEmails: ["guardian@trusted-notary.org"]
  };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

let switchState = loadState();
let engine = new DeadMansSwitchEngine(switchState);

console.log("===============================================================");
console.log("🤖 TELEGRAM BOT SERVICE: MERMAIL DEAD MAN'S SWITCH 🤖");
console.log(`Bot Token: [CONFIGURED] | Authorized Chat ID: ${ALLOWED_CHAT_ID || "ALL"}`);
console.log(`Current Vault Status: ${engine.state.status}`);
console.log("===============================================================\n");

async function handleCommand(chatId, text) {
  const cleanCmd = text.trim().toLowerCase().split(" ")[0];

  switch (cleanCmd) {
    case "/start": {
      const welcomeHtml = formatTelegramHtml({
        title: "MERMAIL DEAD MAN SWITCH CUSTODIAN",
        fields: [
          { label: "Vault ID", value: engine.state.id },
          { label: "Estado", value: engine.state.status },
          { label: "Intervalo", value: `${engine.state.heartbeatIntervalDays} dias` }
        ]
      });

      const keyboard = formatInlineKeyboard([
        [
          { text: "📊 Ver Estado", callback_data: "/status" },
          { text: "❤️ Registrar Check-in", callback_data: "/checkin" }
        ]
      ]);

      return dispatchTelegramNotification({
        botToken: BOT_TOKEN,
        chatId,
        htmlMessage: welcomeHtml + "\n\n<i>Comandos disponibles:</i>\n/status - Consultar el estado del switch\n/checkin - Emitir prueba de vida\n/hold - Aplicar pausa de emergencia",
        replyMarkup: keyboard
      });
    }

    case "/status": {
      const evaluation = engine.evaluateSwitchStatus();
      const lastHb = new Date(engine.state.lastHeartbeatAt).toLocaleString("es-AR", { timeZone: "UTC" });
      
      const statusHtml = formatTelegramHtml({
        title: "ESTADO DEL DEAD MAN SWITCH",
        fields: [
          { label: "Vault ID", value: engine.state.id },
          { label: "Estado Actual", value: engine.state.status },
          { label: "Ultimo Check-in", value: `${lastHb} UTC` },
          { label: "Accion Pendiente", value: evaluation.actionRequired || "NONE" }
        ],
        link: { label: "Solana Explorer (Tx Receipt)", url: "https://explorer.solana.com/tx/5bgzuHtYGFzcXj76tmzzEtb9ue8Ue5ZSDhKGhYqwgAaLSWQB4L1qsCMQAESMnqvo8WZKx5nQoaUvpNsswMqbUniP?cluster=devnet" }
      });

      return dispatchTelegramNotification({
        botToken: BOT_TOKEN,
        chatId,
        htmlMessage: statusHtml
      });
    }

    case "/checkin": {
      if (engine.state.status === "TRIGGERED") {
        return dispatchTelegramNotification({
          botToken: BOT_TOKEN,
          chatId,
          htmlMessage: "⚠️ <b>ACCION DENEGADA</b>\n\nEl Dead Man's Switch ya fue <b>TRIGGERED</b> de manera irrevocable. No es posible rearmar el temporizador."
        });
      }

      engine.state.lastHeartbeatAt = new Date().toISOString();
      engine.state.warningIssuedAt = null;
      engine.state.guardianNotifiedAt = null;
      engine.state.guardianHoldUntil = null;
      engine.state.guardianHoldReason = null;
      engine.state.status = "ARMED";

      saveState(engine.state);

      const checkinHtml = formatTelegramHtml({
        title: "PRUEBA DE VIDA REGISTRADA CON EXITO",
        fields: [
          { label: "Estado", value: "ARMED" },
          { label: "Nuevo Check-in", value: `${new Date().toLocaleString("es-AR", { timeZone: "UTC" })} UTC` },
          { label: "Proximo Vencimiento", value: `En ${engine.state.heartbeatIntervalDays} dias` }
        ]
      });

      return dispatchTelegramNotification({
        botToken: BOT_TOKEN,
        chatId,
        htmlMessage: checkinHtml
      });
    }

    case "/hold": {
      if (engine.state.status === "TRIGGERED") {
        return dispatchTelegramNotification({
          botToken: BOT_TOKEN,
          chatId,
          htmlMessage: "⚠️ <b>ACCION DENEGADA</b>\n\nNo se puede aplicar pausa a un switch que ya fue ejecutado (TRIGGERED)."
        });
      }

      const holdDays = 14;
      const holdUntil = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000).toISOString();
      engine.state.status = "GUARDIAN_HOLD";
      engine.state.guardianHoldUntil = holdUntil;
      engine.state.guardianHoldReason = "Pausa de emergencia solicitada desde Telegram";

      saveState(engine.state);

      const holdHtml = formatTelegramHtml({
        title: "PAUSA DE GUARDIAN APLICADA",
        fields: [
          { label: "Estado", value: "GUARDIAN_HOLD" },
          { label: "Vigencia", value: `14 dias (hasta ${new Date(holdUntil).toLocaleDateString()})` },
          { label: "Motivo", value: engine.state.guardianHoldReason }
        ]
      });

      return dispatchTelegramNotification({
        botToken: BOT_TOKEN,
        chatId,
        htmlMessage: holdHtml
      });
    }

    default:
      return dispatchTelegramNotification({
        botToken: BOT_TOKEN,
        chatId,
        htmlMessage: "Comando no reconocido. Proba con /status, /checkin o /hold."
      });
  }
}

// Poll loop
let offset = 0;
let running = true;

async function pollUpdates() {
  while (running) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=20`, {
        signal: AbortSignal.timeout(25000)
      });
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;

          // Message update
          if (update.message && update.message.text) {
            const chatId = String(update.message.chat.id);
            if (ALLOWED_CHAT_ID && !isAuthorizedTelegramSender(chatId, ALLOWED_CHAT_ID)) {
              console.warn(`[WARN] Mensaje de Chat ID no autorizado ignorado: ${chatId}`);
              continue;
            }
            console.log(`[CMD] Recibido de ${chatId}: ${update.message.text}`);
            await handleCommand(chatId, update.message.text);
          }

          // Callback query update (inline keyboard)
          if (update.callback_query && update.callback_query.data) {
            const chatId = String(update.callback_query.message.chat.id);
            if (ALLOWED_CHAT_ID && !isAuthorizedTelegramSender(chatId, ALLOWED_CHAT_ID)) continue;
            console.log(`[CALLBACK] Recibido de ${chatId}: ${update.callback_query.data}`);
            await handleCommand(chatId, update.callback_query.data);

            // Acknowledge callback query
            try {
              await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ callback_query_id: update.callback_query.id })
              });
            } catch {}
          }
        }
      }
    } catch (err) {
      if (err.name !== "TimeoutError") {
        console.warn(`[POLL WARN]: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

process.on("SIGINT", () => {
  console.log("\nDeteniendo bot...");
  running = false;
  process.exit(0);
});

pollUpdates();
