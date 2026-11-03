import deployedContracts from "./deployedContracts";
import { escrowBonusAbi } from "./escrowBonusAbi";
import { selectEscrowDeployment } from "~~/utils/escrow/deployment";

const legacy = deployedContracts[60600].Escrow;
export const escrowDeployment = selectEscrowDeployment(
  legacy,
  process.env.NEXT_PUBLIC_ESCROW_BONUS_ADDRESS,
  process.env.NEXT_PUBLIC_ESCROW_BONUS_DEPLOY_BLOCK,
);

// The declaration and all write buttons must use exactly the same selected address and ABI.
export const selectedEscrow = {
  address: escrowDeployment.address,
  abi: escrowDeployment.isBonus ? escrowBonusAbi : legacy.abi,
  deployedOnBlock: escrowDeployment.deployedOnBlock,
  inheritedFunctions: {},
} as const;
