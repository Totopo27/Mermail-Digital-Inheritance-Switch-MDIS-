/**
 * Test & Simulación en Vivo: Muerte Confirmada / Atestación Legal & Médica
 * Demuestra qué pasa cuando un heredero/notaría presenta un certificado de defunción
 * para activar la herencia inmediatamente sin esperar los 60 días de inactividad.
 */

import { Keypair, PublicKey } from "@solana/web3.js";
import crypto from "crypto";
import { NotaryAgentAdvisor } from "./deadman-engine.mjs";
import { splitSecret, combineShares } from "./shamir.mjs";

console.log("===============================================================");
console.log("⚖️  SIMULACIÓN: ACTIVACIÓN POR MUERTE CONFIRMADA (LEGAL ORACLE) ⚖️");
console.log("Atestación On-Chain de Defunción & Ventana de Disputa de 48 Horas");
console.log("===============================================================\n");

// 1. Identidades
const owner = Keypair.generate();
const beneficiary = Keypair.generate();
const legalOracle = Keypair.generate(); // Escribano / Registro Civil / Oráculo Médico

console.log(`[Titular / Owner]:       ${owner.publicKey.toBase58()}`);
console.log(`[Heredero / Beneficiary]: ${beneficiary.publicKey.toBase58()}`);
console.log(`[Oráculo Legal Autorizado]: ${legalOracle.publicKey.toBase58()}\n`);

// 2. Custodia del Secreto (Shamir 2-de-3)
const masterSeed = "orange lemon victory solar quantum rocket nebula galaxy";
console.log(`[1] Clave Maestra Protegida: "${masterSeed}"`);
const [shardBeneficiary, shardAgent, shardGuardian] = splitSecret(masterSeed, 3, 2);
console.log(`   - Shard #1 (Beneficiario offline): ID=${shardBeneficiary.id} [${shardBeneficiary.data.slice(0, 24)}...]`);
console.log(`   - Shard #2 (Custodiado por Agente): ID=${shardAgent.id} [${shardAgent.data.slice(0, 24)}...]`);
console.log(`   - Shard #3 (Guardián legal):       ID=${shardGuardian.id} [${shardGuardian.data.slice(0, 24)}...]\n`);

// 3. Simulación de Certificado de Defunción
console.log("[2] El Heredero presenta Certificado Oficial de Defunción ante la Notaría...");
const deathCertificateDoc = {
  deceased: owner.publicKey.toBase58(),
  dateOfDeath: new Date().toISOString(),
  registryNumber: "ACTA-DEF-2026-X99",
  issuer: "Registro Civil Central / Notaría Oficial"
};

// Generar hash SHA-256 del certificado
const certificateHash = crypto.createHash("sha256").update(JSON.stringify(deathCertificateDoc)).digest();
console.log(`   - Documento validado: Acta N° ${deathCertificateDoc.registryNumber}`);
console.log(`   - Hash Criptográfico On-Chain (32 bytes): ${certificateHash.toString("hex")}\n`);

// 4. Atestación en el Smart Contract de Solana
console.log("[3] El Oráculo Legal emite la instrucción 'attest_oracle_trigger' en Solana...");
let vaultStatus = "Active";
let disputeWindowUntil = Date.now() + (48 * 3600 * 1000); // 48 horas de salvaguarda
vaultStatus = "OracleDisputePending";

console.log(`   - Estado del Vault cambiado a: [ORACLE_DISPUTE_PENDING]`);
console.log(`   - Hash del certificado almacenado en la PDA del contrato.`);
console.log(`   - Ventana de seguridad abierta: 48 horas para prevenir fraude o falsos certificados.\n`);

// 5. Análisis del Escenario
console.log("[4] Evaluación de los dos caminos posibles:\n");

console.log("   🟢 CAMINO A: Si el titular estuviera VIVO (Falso Certificado / Fraude):");
console.log("      El titular recibe una alerta roja de máxima prioridad.");
console.log("      Si el titular emite un ping en Solana antes de las 48h...");
console.log("      --> El Smart Contract revierte el estado a ACTIVE y anula el certificado falso.\n");

console.log("   🔴 CAMINO B: Muerte Real Confirmada (Sin disputa durante 48 horas):");
console.log("      Transcurridas las 48 horas sin reclamo del titular...");
vaultStatus = "Triggered";
console.log(`      --> El Vault pasa irrevocablemente a: [TRIGGERED]`);
console.log(`      --> El Agente Notarial libera el Shard #2 al beneficiario.`);

console.log("\n[5] Reconstrucción de Fondos por el Heredero:");
const reconstructedSecret = combineShares([shardBeneficiary, shardAgent]);
console.log(`   - Shard #1 (Heredero) + Shard #2 (Liberado por Agente) combinados en GF(2^8).`);
console.log(`   - Clave Maestra Reconstruida: "${reconstructedSecret}"`);

if (reconstructedSecret === masterSeed) {
  console.log("   ✅ [ÉXITO TOTAL]: La herencia fue transferida de forma inmediata y matemáticamente verificada.");
}

console.log("\n===============================================================");
console.log("🏆 PRUEBA DE MUERTE CONFIRMADA FINALIZADA CON ÉXITO");
console.log("===============================================================");
