// Read-only verification; this script never creates a wallet or sends a transaction.
const { createRequire } = require("node:module");
const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const nextRequire = createRequire(resolve(__dirname, "../packages/nextjs/package.json"));
const { createPublicClient, http, erc20Abi, keccak256 } = nextRequire("viem");
const root = resolve(__dirname, "..");
const deployment = name => JSON.parse(readFileSync(resolve(root, `packages/hardhat/deployments/potos_testnet/${name}.json`), "utf8"));
const escrow = deployment("Escrow");
const token = deployment("PCMToken");
async function main() {
  const client = createPublicClient({ transport: http("https://rpc-testnet.potos.hk", { timeout: 15000, retryCount: 1 }) });
  if (escrow.address.toLowerCase() !== "0x267db7196845d6a1ee887889eea581067abe56cb" || token.address.toLowerCase() !== "0x93c729e48c10ea7c5b7dc971f73db2b130318631") throw Error("Deployment address mismatch");
  const [chainId, block, escrowCode, tokenCode, arbiter, count, decimals, symbol] = await Promise.all([
    client.getChainId(), client.getBlockNumber(), client.getCode({ address: escrow.address }), client.getCode({ address: token.address }),
    client.readContract({ address: escrow.address, abi: escrow.abi, functionName: "arbiter" }),
    client.readContract({ address: escrow.address, abi: escrow.abi, functionName: "orderCount" }),
    client.readContract({ address: token.address, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address: token.address, abi: erc20Abi, functionName: "symbol" }),
  ]);
  if (chainId !== 60600 || !escrowCode || !tokenCode) throw Error("Unexpected chain or missing code");
  if (escrowCode.toLowerCase() !== escrow.deployedBytecode.toLowerCase()) throw Error("Escrow runtime bytecode mismatch");
  if (tokenCode.toLowerCase() !== token.deployedBytecode.toLowerCase()) throw Error("Token runtime bytecode mismatch");
  const result = { checkedAt: new Date().toISOString(), chainId, blockNumber: block.toString(), escrow: escrow.address, token: token.address, arbiter, orderCount: count.toString(), tokenDecimals: decimals, tokenSymbol: symbol, escrowCodeHash: keccak256(escrowCode), tokenCodeHash: keccak256(tokenCode), deploymentBytecodesMatch: true, signedTransactions: 0 };
  writeFileSync(resolve(root, "docs/song-chain-check.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
