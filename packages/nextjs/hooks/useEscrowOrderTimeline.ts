import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { escrowBonusAbi } from "~~/contracts/escrowBonusAbi";
import { escrowDeployment } from "~~/contracts/selectedEscrow";
import { useDeployedContractInfo, useTargetNetwork } from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";
import { OrderTimelineResult, readOrderTimeline } from "~~/utils/escrow/orderTimeline";

export function useEscrowOrderTimeline(orderId: bigint, status: number, createdAtBlock?: bigint) {
  const { targetNetwork } = useTargetNetwork();
  const client = usePublicClient({ chainId: targetNetwork.id });
  const { data: escrow } = useDeployedContractInfo({ contractName: "Escrow" });
  const queryClient = useQueryClient();
  const scope = `${targetNetwork.id}:${escrow?.address}:${orderId}:${createdAtBlock}:${status}`;
  const [progress, setProgress] = useState<{ scope: string; count: number }>();
  const query = useQuery<OrderTimelineResult>({
    queryKey: [
      "escrowOrderTimeline",
      targetNetwork.id,
      escrow?.address,
      orderId.toString(),
      createdAtBlock?.toString(),
      status,
    ],
    enabled: Boolean(client && escrow && createdAtBlock !== undefined),
    staleTime: Infinity,
    retry: 1,
    refetchInterval: current => {
      const currentStatus = current.state.data?.status ?? status;
      return currentStatus === 2 || currentStatus === 3 ? false : scaffoldConfig.pollingInterval;
    },
    queryFn: async ({ signal }) => {
      if (!client || !escrow || createdAtBlock === undefined) throw new Error("订单创建记录尚未就绪");
      const head = await client.getBlockNumber({ cacheTime: 0 });
      const current = await client.readContract({
        address: escrow.address,
        abi: escrow.abi,
        functionName: "getOrder",
        args: [orderId],
        blockNumber: head,
      });
      const lastVoteBlock =
        escrowDeployment.isBonus && current.status === 4
          ? await client.readContract({
              address: escrow.address,
              abi: escrowBonusAbi,
              functionName: "lastResolutionVoteBlock",
              args: [orderId],
              blockNumber: head,
            })
          : 0n;
      return readOrderTimeline({
        orderId,
        fromBlock: createdAtBlock,
        toBlock: head,
        status: current.status,
        arbitrationVoteBlock: lastVoteBlock || undefined,
        requireArbitrationVotes: escrowDeployment.isBonus,
        signal,
        onProgress: count => setProgress({ scope, count }),
        readBatch: (from, to) =>
          queryClient.fetchQuery({
            queryKey: ["escrowTimelineLogs", targetNetwork.id, escrow.address, from.toString(), to.toString()],
            staleTime: Infinity,
            retry: 1,
            queryFn: () =>
              client.getLogs({
                address: escrow.address,
                events: escrow.abi.filter(item => item.type === "event"),
                fromBlock: from,
                toBlock: to,
                strict: true,
              }),
          }),
      });
    },
  });

  return {
    ...query,
    foundCount: progress?.scope === scope ? progress.count : 0,
    refresh: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["escrowTimelineLogs", targetNetwork.id, escrow?.address],
        refetchType: "none",
      });
      return query.refetch();
    },
  };
}
