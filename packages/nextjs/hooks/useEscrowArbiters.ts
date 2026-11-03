import { useReadContract } from "wagmi";
import { CHAIN_ID, escrowContract } from "~~/app/escrow/_lib/contracts";
import { escrowBonusAbi } from "~~/contracts/escrowBonusAbi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useShippingSupport } from "~~/hooks/useShippingSupport";

export function useEscrowArbiters() {
  const support = useShippingSupport();
  const first = useScaffoldReadContract({ contractName: "Escrow", functionName: "arbiter" });
  const second = useReadContract({
    address: escrowContract.address,
    abi: escrowBonusAbi,
    functionName: "arbiter2",
    chainId: CHAIN_ID,
    query: { enabled: support.configured && support.enabled, refetchInterval: 30000 },
  });
  const ready = !!first.data && (!support.configured || (support.enabled && !!second.data));
  return {
    arbiters: ready ? (support.configured ? [first.data!, second.data!] : [first.data!]) : [],
    ready,
    error: first.error ?? (support.configured ? (second.error ?? support.error) : null),
  };
}
