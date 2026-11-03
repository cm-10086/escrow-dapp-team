import { Address, getAddress, zeroAddress } from "viem";

export function selectEscrowDeployment(
  legacy: { address: Address; deployedOnBlock: number },
  addressInput = "",
  blockInput = "",
) {
  const addressText = addressInput.trim();
  const blockText = blockInput.trim();
  if (!addressText && !blockText) return { ...legacy, isBonus: false };
  if (!addressText || !blockText) throw new Error("加分合约地址和部署区块必须同时填写");
  const address = getAddress(addressText);
  if (address === zeroAddress || address.toLowerCase() === legacy.address.toLowerCase()) {
    throw new Error("加分合约必须使用新版部署地址，不能填写零地址或实验三旧地址");
  }
  if (!/^\d+$/.test(blockText) || BigInt(blockText) < 1n || BigInt(blockText) > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("加分合约部署区块必须是有效的正整数");
  }
  return { address, deployedOnBlock: Number(blockText), isBonus: true };
}
