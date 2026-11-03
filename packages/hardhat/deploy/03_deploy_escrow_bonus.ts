import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployEscrowBonus: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // Agreed public wallets: Cai (first) and Peng (second, also the buyer).
  const addresses = [
    process.env.ESCROW_BONUS_ARBITER_1?.trim() || "0x5a11A430A712486394708358fa76a6688FFA6275",
    process.env.ESCROW_BONUS_ARBITER_2?.trim() || "0xDD22eDe4D64E611519099bAF7813B5b10294b20B",
  ];
  if (addresses.some(address => !address || !hre.ethers.isAddress(address))) {
    throw new Error("Set ESCROW_BONUS_ARBITER_1 and ESCROW_BONUS_ARBITER_2 to the two agreed public wallet addresses.");
  }
  const arbiters = addresses.map(address => hre.ethers.getAddress(address!));
  if (arbiters.some(address => address === hre.ethers.ZeroAddress) || arbiters[0] === arbiters[1]) {
    throw new Error("The two arbiters must be different, nonzero wallet addresses.");
  }
  const { deployer } = await hre.getNamedAccounts();
  await hre.deployments.deploy("EscrowBonus", {
    from: deployer,
    args: arbiters,
    log: true,
    autoMine: true,
  });
};

deployEscrowBonus.tags = ["EscrowBonus"];
// Opt-in only; compiling, testing, or an ordinary deploy must not silently deploy the bonus contract.
deployEscrowBonus.skip = async () => process.env.DEPLOY_ESCROW_BONUS !== "true";
export default deployEscrowBonus;
