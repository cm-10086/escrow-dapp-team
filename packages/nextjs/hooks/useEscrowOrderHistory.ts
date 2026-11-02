import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toFunctionSelector } from "viem";
import { useBlockNumber, usePublicClient } from "wagmi";
import { useDeployedContractInfo, useScaffoldEventHistory, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { getCreationHintBlocks } from "~~/utils/escrow/creationHints";

/** Read both ends of a sparse contract history instead of making new orders wait behind old empty blocks. */
export function useEscrowOrderHistory(orderCount: bigint | undefined) {
  const { targetNetwork } = useTargetNetwork();
  const client = usePublicClient({ chainId: targetNetwork.id });
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

  // A cold load on the next day must not put old-but-recent orders behind the long empty gap again.
  // The explorer supplies candidate block numbers only; no order is added without an RPC event.
  const hinted = useQuery({
    queryKey: ["escrowVerifiedCreations", targetNetwork.id, escrow?.address, orderCount?.toString()],
    enabled: Boolean(ready && client && escrow && orderCount !== undefined && orderCount > 0n && !historyComplete),
    staleTime: 30000,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!client || !escrow || head === undefined) return [];
      const explorer = targetNetwork.blockExplorers?.default.url;
      if (!explorer) return [];
      const create = escrow.abi.find(item => item.type === "function" && item.name === "createOrder")!;
      const event = escrow.abi.find(item => item.type === "event" && item.name === "OrderCreated")!;
      const blocks = new Set<bigint>();
      let cursor: Record<string, string | number> = {};
      for (let page = 0; page < 3; page++) {
        const url = new URL(`/api/v2/addresses/${escrow.address}/transactions`, explorer);
        for (const [key, value] of Object.entries(cursor)) url.searchParams.set(key, String(value));
        const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
        if (!response.ok) throw new Error("Explorer index unavailable");
        const body = await response.json();
        if (!Array.isArray(body.items)) throw new Error("Explorer index unavailable");
        for (const block of getCreationHintBlocks(
          body.items,
          escrow.address,
          toFunctionSelector(create),
          deployment,
          head,
        ))
          blocks.add(block);
        if (!body.next_page_params || BigInt(blocks.size) >= (orderCount ?? 0n)) break;
        cursor = body.next_page_params;
      }
      const locations = [...blocks];
      const verified: (typeof recent.data)[number][] = [];
      for (let offset = 0; offset < locations.length; offset += 4) {
        signal.throwIfAborted();
        const batches = await Promise.all(
          locations.slice(offset, offset + 4).map(block =>
            client.getLogs({
              address: escrow.address,
              event,
              fromBlock: block,
              toBlock: block,
              strict: true,
            }),
          ),
        );
        for (const batch of batches) verified.push(...batch);
      }
      return verified;
    },
  });

  const byId = new Map<bigint, (typeof recent.data)[number]>();
  for (const event of [...older.data, ...recent.data, ...(hinted.data ?? [])]) {
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
    isSyncingHistory:
      !complete && (older.isLoading || older.isFetchingNewEvent || recent.isFetchingNewEvent || hinted.isFetching),
    refetch: async () => {
      // Successful creation events are immutable: only retry old pages when their scan failed.
      await Promise.allSettled([recent.refetch(), hinted.refetch(), ...(older.error ? [older.refetch()] : [])]);
    },
  };
}
