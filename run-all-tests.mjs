// Script Maestro: Ejecución Completa de Pruebas (66/66)
import { execSync } from "child_process";

const suites = [
  { name: "1. Unit & Scenarios (Skill Core)", cmd: "npm test" },
  { name: "2. Live Infrastructure (Solana Devnet + Mermail MCP)", cmd: "npm run test:live" },
  { name: "3. Solana Smart Contract (Anchor PDA, USDC & Pyth)", cmd: "npm run test:contract" },
  { name: "4. Cloudflare Serverless Worker", cmd: "npm run test:worker" },
  { name: "5. Telegram Notifier & Security Escaping", cmd: "npm run test:telegram" },
  { name: "6. Adversarial Red Team Stress-Testing", cmd: "npm run test:redteam" },
  { name: "7. Boundary & On-Chain Error Rejections", cmd: "npm run test:boundary" },
  { name: "8. Solana-Dev Invariants & Anti-Griefing", cmd: "npm run test:invariants" },
  { name: "9. Solana Chaos & Transaction v1 (SIMD-0385)", cmd: "npm run test:chaos" }
];

console.log("===============================================================");
console.log("🚀 EJECUTANDO LA SUITE COMPLETA DE PRUEBAS DE INFRAESTRUCTURA 🚀");
console.log("===============================================================\n");

let passedSuites = 0;

for (const suite of suites) {
  console.log(`\n▶️  [SUITE]: ${suite.name}`);
  console.log(`    Comando: ${suite.cmd}`);
  console.log("---------------------------------------------------------------");
  try {
    execSync(suite.cmd, { stdio: "inherit" });
    passedSuites++;
    console.log(`✅  [SUITE SUPERADA]: ${suite.name}\n`);
  } catch (err) {
    console.error(`❌  [SUITE FALLIDA]: ${suite.name}`);
    process.exit(1);
  }
}

console.log("===============================================================");
console.log(`🏆 RESUMEN FINAL: ${passedSuites}/${suites.length} SUITES SUPERADAS CON ÉXITO (100% PASS RATE)`);
console.log("===============================================================");
