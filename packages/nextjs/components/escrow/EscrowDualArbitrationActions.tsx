"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWriteContract } from "wagmi";
import { TransactionFeedback } from "~~/app/escrow/_components/TransactionFeedback";
import { useOrderTransaction } from "~~/app/escrow/_hooks/useOrderTransaction";
import { CHAIN_ID, escrowContract } from "~~/app/escrow/_lib/contracts";
import { EscrowOrderForActions } from "~~/components/escrow/EscrowDisputeActions";
import { Address } from "~~/components/scaffold-eth";
import { escrowBonusAbi } from "~~/contracts/escrowBonusAbi";
import { useEscrowArbiters } from "~~/hooks/useEscrowArbiters";
import { useShippingSupport } from "~~/hooks/useShippingSupport";
import {
  disputeBonusOrder,
  getArbitrationProgress,
  getVoteLabel,
  voteOnDispute,
} from "~~/utils/escrow/arbitrationActions";
import { getEscrowPermissions } from "~~/utils/escrow/permissions";

export function EscrowDualArbitrationActions({
  orderId,
  order,
  onConfirmed,
}: {
  orderId: bigint;
  order: EscrowOrderForActions;
  onConfirmed?: () => void;
}) {
  const support = useShippingSupport();
  const { arbiters, ready: arbitersReady } = useEscrowArbiters();
  const tx = useOrderTransaction();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const status = Number(order.status);
  const votes = useQuery({
    queryKey: ["escrowResolutionVotes", CHAIN_ID, escrowContract.address, orderId.toString(), ...arbiters],
    queryFn: () =>
      Promise.all(
        arbiters.map(account =>
          tx.client!.readContract({
            address: escrowContract.address,
            abi: escrowBonusAbi,
            functionName: "resolutionVotes",
            args: [orderId, account],
          }),
        ),
      ),
    enabled: support.enabled && arbitersReady && !!tx.client && [2, 3, 4].includes(status),
    refetchInterval: status === 4 ? 5000 : false,
    retry: 1,
  });
  const progress = getArbitrationProgress(status, votes.data);
  const permissions = getEscrowPermissions({ account: tx.account.address, ...order, arbiters });
  const ownIndex = arbiters.findIndex(address => address.toLowerCase() === tx.account.address?.toLowerCase());
  const ownVote = votes.data?.[ownIndex];
  const disabled = tx.busy || !tx.ready || !arbitersReady;

  const submit = (action: "dispute" | "resolve", sellerWins = false) =>
    void tx.run(async ({ account, assertWallet, send }) => {
      const port = {
        assertWallet,
        supportsDualArbitration: () =>
          tx.client!.readContract({
            address: escrowContract.address,
            abi: escrowBonusAbi,
            functionName: "supportsDualArbitration",
          }),
        readOrder: () => tx.client!.readContract({ ...escrowContract, functionName: "getOrder", args: [orderId] }),
      };
      if (action === "dispute")
        await disputeBonusOrder(account, {
          ...port,
          dispute: async () => {
            await send("发起争议", () =>
              writeContractAsync({
                address: escrowContract.address,
                abi: escrowBonusAbi,
                functionName: "dispute",
                args: [orderId],
                account,
                chainId: CHAIN_ID,
              }),
            );
          },
        });
      else
        await voteOnDispute(account, sellerWins, {
          ...port,
          readArbiters: () =>
            Promise.all([
              tx.client!.readContract({
                address: escrowContract.address,
                abi: escrowBonusAbi,
                functionName: "arbiter",
              }),
              tx.client!.readContract({
                address: escrowContract.address,
                abi: escrowBonusAbi,
                functionName: "arbiter2",
              }),
            ]),
          readVote: () =>
            tx.client!.readContract({
              address: escrowContract.address,
              abi: escrowBonusAbi,
              functionName: "resolutionVotes",
              args: [orderId, account as `0x${string}`],
            }),
          resolve: async () => {
            await send("提交仲裁意见", () =>
              writeContractAsync({
                address: escrowContract.address,
                abi: escrowBonusAbi,
                functionName: "resolve",
                args: [orderId, sellerWins],
                account,
                chainId: CHAIN_ID,
              }),
            );
          },
        });
      onConfirmed?.();
      await Promise.allSettled([
        votes.refetch(),
        queryClient.invalidateQueries({
          queryKey: ["escrowTimelineLogs", CHAIN_ID, escrowContract.address],
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: ["escrowOrderTimeline", CHAIN_ID, escrowContract.address, orderId.toString()],
        }),
      ]);
    });

  return (
    <div className="space-y-3">
      <span className="text-sm">当前角色：{permissions.role}</span>
      {permissions.canDispute && (
        <button className="btn btn-warning btn-sm" disabled={disabled} onClick={() => submit("dispute")}>
          发起争议
        </button>
      )}
      {(status === 4 || progress.count > 0) && (
        <section
          className="rounded-lg border border-base-300 p-3 space-y-2 max-w-sm whitespace-normal"
          aria-label={`订单 #${orderId} 双人仲裁`}
          aria-live="polite"
        >
          <p className="m-0 font-semibold">
            双人仲裁 · {progress.known ? `${progress.count}/2 已投票` : "意见读取中…"}
          </p>
          {arbiters.map((address, index) => (
            <div key={address} className="space-y-1 text-sm">
              <span>
                仲裁人 {index + 1}：{getVoteLabel(votes.data?.[index])}
              </span>
              <Address address={address} size="xs" />
            </div>
          ))}
          <p className="m-0 text-xs opacity-75">
            {progress.phase === "settled"
              ? "订单已结算，仲裁意见已保留。"
              : progress.phase === "disagree"
                ? "两人意见不一致，款项继续托管；任一仲裁人可修改意见，意见一致后自动结算。"
                : progress.phase === "one"
                  ? "已记录一名仲裁人的意见，款项继续托管，等待另一名仲裁人。"
                  : progress.phase === "agreed"
                    ? "两人意见一致，正在核对最终结算状态，请刷新。"
                    : "两名不同仲裁人均提交相同意见后才会结算。"}
          </p>
          <button
            className="btn btn-ghost btn-xs"
            disabled={votes.isFetching}
            onClick={() => {
              void votes.refetch();
              onConfirmed?.();
            }}
          >
            刷新仲裁意见
          </button>
          {votes.error && (
            <p className="text-error text-xs" role="alert">
              仲裁意见读取失败，请刷新重试。
            </p>
          )}
        </section>
      )}
      {permissions.canResolve && (
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-success btn-sm"
            disabled={disabled || !progress.known || !!votes.error || ownVote === 2}
            onClick={() => submit("resolve", true)}
          >
            {ownVote === 2 ? "已投：判给卖家" : ownVote === 1 ? "改为判给卖家" : "投票：判给卖家"}
          </button>
          <button
            className="btn btn-outline btn-sm"
            disabled={disabled || !progress.known || !!votes.error || ownVote === 1}
            onClick={() => submit("resolve", false)}
          >
            {ownVote === 1 ? "已投：退给买家" : ownVote === 2 ? "改为退给买家" : "投票：退给买家"}
          </button>
        </div>
      )}
      <TransactionFeedback {...tx} />
    </div>
  );
}
