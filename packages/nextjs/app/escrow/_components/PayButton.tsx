"use client";

import { useOrderTransaction } from "../_hooks/useOrderTransaction";
import { CHAIN_ID, escrowContract } from "../_lib/contracts";
import { Order, isBuyer, payOrder } from "../_lib/orderWrites";
import { TransactionFeedback } from "./TransactionFeedback";
import { erc20Abi } from "viem";
import { useWriteContract } from "wagmi";

export function PayButton({ orderId, order, onSuccess }: { orderId: bigint; order: Order; onSuccess?: () => void }) {
  const tx = useOrderTransaction();
  const { writeContractAsync } = useWriteContract();
  const eligible = isBuyer(order, tx.account.address) && order.status === 0;
  if (!eligible && tx.records.length === 0) return null;
  const pay = () =>
    void tx.run(async ({ account, assertWallet, send }) => {
      await payOrder(account, {
        assertWallet,
        readOrder: () =>
          tx.client!.readContract({
            address: escrowContract.address,
            abi: escrowContract.abi,
            functionName: "getOrder",
            args: [orderId],
          }),
        balance: current =>
          tx.client!.readContract({
            address: current.token,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [account],
          }),
        allowance: current =>
          tx.client!.readContract({
            address: current.token,
            abi: erc20Abi,
            functionName: "allowance",
            args: [account, escrowContract.address],
          }),
        approve: async current => {
          await send("1/2 授权", () =>
            writeContractAsync({
              address: current.token,
              abi: erc20Abi,
              functionName: "approve",
              args: [escrowContract.address, current.amount],
              account,
              chainId: CHAIN_ID,
            }),
          );
        },
        deposit: async () => {
          await send("2/2 托管付款", () =>
            writeContractAsync({
              address: escrowContract.address,
              abi: escrowContract.abi,
              functionName: "deposit",
              args: [orderId],
              account,
              chainId: CHAIN_ID,
            }),
          );
        },
      });
      onSuccess?.();
    });
  return (
    <div className="space-y-2">
      {eligible && (
        <>
          <button type="button" onClick={pay} disabled={!tx.ready || tx.busy} className="btn btn-primary">
            {tx.busy ? "付款处理中…" : "授权并付款"}
          </button>
          <p className="text-xs">授权金额仅为本订单金额；授权确认后才发起付款。已有足额授权时直接付款。</p>
        </>
      )}
      <TransactionFeedback {...tx} />
    </div>
  );
}
