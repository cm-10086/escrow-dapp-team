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
  return {
    enabled: escrowDeployment.isBonus && query.data === true,
    configured: escrowDeployment.isBonus,
    isLoading: escrowDeployment.isBonus && query.isLoading,
    error: query.error,
  };
}
