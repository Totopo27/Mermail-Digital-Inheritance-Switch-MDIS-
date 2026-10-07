// Master Test Suite Runner: Full Infrastructure & Smart Contract Verification
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
console.log("🚀 EXECUTING FULL INFRASTRUCTURE & SECURITY TEST SUITE 🚀");
console.log("===============================================================\n");

let passedSuites = 0;

for (const suite of suites) {
  console.log(`\n▶️  [SUITE]: ${suite.name}`);
  console.log(`    Command: ${suite.cmd}`);
  console.log("---------------------------------------------------------------");
  try {
    execSync(suite.cmd, { stdio: "inherit" });
    passedSuites++;
    console.log(`✅  [SUITE PASSED]: ${suite.name}\n`);
  } catch (err) {
    console.error(`❌  [SUITE FAILED]: ${suite.name}`);
    process.exit(1);
  }
}

console.log("===============================================================");
console.log(`🏆 FINAL SUMMARY: ${passedSuites}/${suites.length} SUITES VERIFIED (100% PASS RATE)`);
console.log("===============================================================");
