"use client";

import { useQuery } from "@tanstack/react-query";
import { useWriteContract } from "wagmi";
import { TransactionFeedback } from "~~/app/escrow/_components/TransactionFeedback";
import { useOrderTransaction } from "~~/app/escrow/_hooks/useOrderTransaction";
import { CHAIN_ID, escrowContract } from "~~/app/escrow/_lib/contracts";
import { Order } from "~~/app/escrow/_lib/orderWrites";
import { escrowBonusAbi } from "~~/contracts/escrowBonusAbi";
import { useShippingSupport } from "~~/hooks/useShippingSupport";
import { getShippingPermissions, refundUnshippedOrder, shipOrder } from "~~/utils/escrow/shippingActions";

export function EscrowShippingActions({
  orderId,
  order,
  onSuccess,
}: {
  orderId: bigint;
  order: Order;
  onSuccess: () => void;
}) {
  const support = useShippingSupport();
  const tx = useOrderTransaction();
  const { writeContractAsync } = useWriteContract();
  const participant = [order.buyer.toLowerCase(), order.seller.toLowerCase()].includes(
    tx.account.address?.toLowerCase() ?? "",
  );
  const clock = useQuery({
    queryKey: ["escrowShippingClock", CHAIN_ID],
    queryFn: async () => (await tx.client!.getBlock({ blockTag: "latest" })).timestamp,
    enabled: support.enabled && order.status === 1 && participant && !!tx.client,
    refetchInterval: 10000,
    retry: 1,
  });
  const permission = getShippingPermissions({
    account: tx.account.address,
    order,
    chainTimestamp: clock.data,
    supported: support.enabled,
  });
  if (!support.enabled || (!permission.showShip && !permission.showRefund && tx.records.length === 0)) return null;

  const submit = (action: "ship" | "refund") =>
    void tx.run(async ({ account, assertWallet, send }) => {
      const port = {
        assertWallet,
        supportsShipping: () =>
          tx.client!.readContract({
            address: escrowContract.address,
            abi: escrowBonusAbi,
            functionName: "supportsShipping",
          }),
        readOrder: () => tx.client!.readContract({ ...escrowContract, functionName: "getOrder", args: [orderId] }),
        chainTimestamp: async () => (await tx.client!.getBlock({ blockTag: "latest" })).timestamp,
      };
      if (action === "ship")
        await shipOrder(account, {
          ...port,
          markShipped: async () => {
            await send("卖家标记发货", () =>
              writeContractAsync({
                address: escrowContract.address,
                abi: escrowBonusAbi,
                functionName: "markShipped",
                args: [orderId],
                account,
                chainId: CHAIN_ID,
              }),
            );
          },
        });
      else
        await refundUnshippedOrder(account, {
          ...port,
          refund: async () => {
            await send("未发货超期退款", () =>
              writeContractAsync({
                address: escrowContract.address,
                abi: escrowBonusAbi,
                functionName: "refund",
                args: [orderId],
                account,
                chainId: CHAIN_ID,
              }),
            );
          },
        });
      onSuccess();
    });

  return (
    <div className="space-y-2">
      {permission.showShip && (
        <>
          <button
            className="btn btn-info btn-sm"
            disabled={!permission.canShip || !tx.ready || tx.busy}
            onClick={() => submit("ship")}
          >
            {tx.busy ? "发货交易处理中…" : "标记已发货"}
          </button>
          <p className="m-0 text-xs opacity-70">
            {clock.data !== undefined && clock.data > order.deadline
              ? "订单已到期，卖家不能再标记发货。"
              : "请在实际发货后、订单到期前标记；托管款仍保留在合约中。"}
          </p>
        </>
      )}
      {permission.showRefund && (
        <>
          <button
            className="btn btn-outline btn-sm"
            disabled={!permission.canRefund || !tx.ready || tx.busy}
            onClick={() => submit("refund")}
          >
            {tx.busy ? "退款交易处理中…" : "超期退款（未发货）"}
          </button>
          <p className="m-0 text-xs opacity-70">
            {permission.canRefund
              ? "链上截止时间已过，订单未发货，可以申请退款。"
              : "仅在链上截止时间之后且卖家未发货时可退款。"}
          </p>
        </>
      )}
      {(permission.showShip || permission.showRefund) && (
        <button className="btn btn-ghost btn-xs" disabled={clock.isFetching} onClick={() => void clock.refetch()}>
          {clock.error ? "链上时间读取失败，点击重试" : clock.isFetching ? "正在核对链上时间…" : "核对链上时间"}
        </button>
      )}
      <TransactionFeedback {...tx} />
    </div>
  );
}
