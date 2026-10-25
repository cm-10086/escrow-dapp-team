import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// 仲裁人的 MetaMask 公共地址
const ARBITER = "0x5a11A430A712486394708358fa76a6688FFA6275";

const deployEscrow: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  await hre.deployments.deploy("Escrow", {
    from: deployer,
    args: [ARBITER],
    log: true,
    autoMine: true,
  });
};

export default deployEscrow;

deployEscrow.tags = ["EscrowPCM202430551274"];
