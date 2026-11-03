const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const artifact = JSON.parse(fs.readFileSync(path.join(root, "packages/hardhat/artifacts/contracts/EscrowBonus.sol/EscrowBonus.json"), "utf8"));
const output = path.join(root, "packages/nextjs/contracts/escrowBonusAbi.ts");
async function main() {
  const prettier = require(path.join(root, "packages/nextjs/node_modules/prettier"));
  const source = await prettier.format("// Generated from EscrowBonus.sol by scripts/export-escrow-bonus-abi.cjs.\n" +
    "// This is an ABI only, not a testnet deployment record.\n" +
    `export const escrowBonusAbi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`, { parser: "typescript" });
  if (process.argv.includes("--check")) {
    if (fs.readFileSync(output, "utf8").replace(/\r\n/g, "\n") !== source) throw new Error("EscrowBonus ABI is stale; run node scripts/export-escrow-bonus-abi.cjs after compiling.");
    console.log("EscrowBonus ABI matches the compiled contract.");
  } else {
    fs.writeFileSync(output, source);
    console.log("Updated EscrowBonus ABI; no deployment or address was created.");
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
