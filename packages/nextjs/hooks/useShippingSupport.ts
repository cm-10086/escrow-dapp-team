import { useReadContract } from "wagmi";
import { escrowBonusAbi } from "~~/contracts/escrowBonusAbi";
import { escrowDeployment } from "~~/contracts/selectedEscrow";

export function useShippingSupport() {
  const query = useReadContract({
    address: escrowDeployment.address,
    abi: escrowBonusAbi,
    functionName: "supportsShipping",
    chainId: 60600,
    query: { enabled: escrowDeployment.isBonus, retry: false },
  });
  const arbitration = useReadContract({
    address: escrowDeployment.address,
    abi: escrowBonusAbi,
    functionName: "supportsDualArbitration",
    chainId: 60600,
    query: { enabled: escrowDeployment.isBonus, retry: false },
  });
  return {
    // Only the combined release may be selected as the bonus deployment.
    enabled: escrowDeployment.isBonus && query.data === true && arbitration.data === true,
    configured: escrowDeployment.isBonus,
    isLoading: escrowDeployment.isBonus && (query.isLoading || arbitration.isLoading),
    error: query.error ?? arbitration.error,
  };
}
