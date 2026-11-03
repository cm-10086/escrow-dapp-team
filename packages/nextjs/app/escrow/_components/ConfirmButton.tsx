"use client";

import { useState } from "react";
import { useOrderTransaction } from "../_hooks/useOrderTransaction";
import { CHAIN_ID, escrowContract } from "../_lib/contracts";
import { Order, confirmOrder, isBuyer } from "../_lib/orderWrites";
import { TransactionFeedback } from "./TransactionFeedback";
import { useWriteContract } from "wagmi";

export function ConfirmButton({
  orderId,
  order,
  onSuccess,
}: {
  orderId: bigint;
  order: Order;
  onSuccess?: () => void;
}) {
  const tx = useOrderTransaction();
  const { writeContractAsync } = useWriteContract();
  const [received, setReceived] = useState(false);
  const eligible = isBuyer(order, tx.account.address) && (order.status === 1 || order.status === 5);
  if (!eligible && tx.records.length === 0) return null;
  const confirm = () =>
    void tx.run(async ({ account, assertWallet, send }) => {
      await confirmOrder(account, {
        assertWallet,
        readOrder: () =>
          tx.client!.readContract({
            address: escrowContract.address,
            abi: escrowContract.abi,
            functionName: "getOrder",
            args: [orderId],
          }),
        confirm: async () => {
          await send("确认收货", () =>
            writeContractAsync({
              address: escrowContract.address,
              abi: escrowContract.abi,
              functionName: "confirm",
              args: [orderId],
              account,
              chainId: CHAIN_ID,
            }),
          );
        },
      });
      setReceived(false);
      onSuccess?.();
    });
  return (
    <div className="space-y-3">
      {eligible && (
        <>
          <label className="flex gap-2 items-center text-sm">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={received}
              disabled={tx.busy}
              onChange={e => setReceived(e.target.checked)}
            />
            我已收到商品或服务，同意将托管款放给卖家
          </label>
          <button
            type="button"
            onClick={confirm}
            disabled={!received || !tx.ready || tx.busy}
            className="btn btn-success"
          >
            {tx.busy ? "确认处理中…" : "确认收货并放款"}
          </button>
        </>
      )}
      <TransactionFeedback {...tx} />
    </div>
  );
}
