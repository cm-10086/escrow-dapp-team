import { useEffect, useState } from "react";
import { useBlockNumber } from "wagmi";
import { useDeployedContractInfo, useScaffoldEventHistory, useTargetNetwork } from "~~/hooks/scaffold-eth";

/** Read both ends of a sparse contract history instead of making new orders wait behind old empty blocks. */
export function useEscrowOrderHistory(orderCount: bigint | undefined) {
  const { targetNetwork } = useTargetNetwork();
  const { data: escrow } = useDeployedContractInfo({ contractName: "Escrow" });
  const { data: head, error: headError } = useBlockNumber({ chainId: targetNetwork.id, cacheTime: 0 });
  const [window, setWindow] = useState<{ address: string; start: bigint }>();
  const [historyComplete, setHistoryComplete] = useState(false);

  useEffect(() => {
    if (head === undefined || !escrow) return;
    setWindow(previous => {
      if (previous?.address === escrow.address) return previous;
      const deployment = BigInt(escrow.deployedOnBlock ?? 0);
      const start = head - 999n;
      return { address: escrow.address, start: start > deployment ? start : deployment };
    });
  }, [head, escrow]);

  const ready = Boolean(window && escrow && window.address === escrow.address);
  const deployment = BigInt(escrow?.deployedOnBlock ?? 0);
  const hasOlderRange = ready && window!.start > deployment;
  const recent = useScaffoldEventHistory({
    contractName: "Escrow",
    eventName: "OrderCreated",
    fromBlock: window?.start,
    blocksBatchSize: 10,
    scanFromLatest: true,
    watch: true,
    enabled: ready,
  });
  const older = useScaffoldEventHistory({
    contractName: "Escrow",
    eventName: "OrderCreated",
    fromBlock: deployment,
    toBlock: hasOlderRange ? window!.start - 1n : undefined,
    blocksBatchSize: 10,
    enabled: hasOlderRange && !historyComplete,
  });

  const byId = new Map<bigint, (typeof recent.data)[number]>();
  for (const event of [...older.data, ...recent.data]) {
    if (typeof event?.args.id === "bigint") byId.set(event.args.id, event);
  }
  const data = [...byId.values()];
  const complete = orderCount !== undefined && BigInt(data.length) >= orderCount;
  useEffect(() => setHistoryComplete(complete), [complete]);

  return {
    data,
    error: recent.error ?? older.error ?? headError,
    isLoading: !ready || recent.isLoading,
    isFetchingNewEvent: recent.isFetchingNewEvent,
    isSyncingHistory: !complete && (older.isLoading || older.isFetchingNewEvent || recent.isFetchingNewEvent),
    refetch: async () => {
      // Successful creation events are immutable: only retry old pages when their scan failed.
      await Promise.allSettled([recent.refetch(), ...(older.error ? [older.refetch()] : [])]);
    },
  };
}
