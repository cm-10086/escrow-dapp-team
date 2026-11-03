"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useShippingSupport } from "~~/hooks/useShippingSupport";
import { getEscrowPermissions } from "~~/utils/escrow/permissions";

export type EscrowOrderForActions = {
  buyer: string;
  seller: string;
  status: number | bigint;
};

type Props = {
  orderId: bigint;
  order?: EscrowOrderForActions;
  onConfirmed?: () => void;
};

export function EscrowDisputeActions({ orderId, order, onConfirmed }: Props) {
  const { address } = useAccount();
  const support = useShippingSupport();
  const { data: arbiter } = useScaffoldReadContract({ contractName: "Escrow", functionName: "arbiter" });
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "Escrow" });
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!order) return <span>订单读取中…</span>;

  const permissions = getEscrowPermissions({
    account: address,
    buyer: order.buyer,
    seller: order.seller,
    arbiter,
    status: order.status,
  });
  const disabled = Boolean(pendingAction) || isMining || (support.configured && !support.enabled);

  const submit = async (action: "dispute" | "resolve", sellerWins?: boolean) => {
    setPendingAction(action);
    setLastHash(null);
    setError(null);
    try {
      if (support.configured && !support.enabled) throw new Error("加分合约尚未通过核验");
      const hash =
        action === "dispute"
          ? await writeContractAsync({ functionName: "dispute", args: [orderId] })
          : await writeContractAsync({ functionName: "resolve", args: [orderId, Boolean(sellerWins)] });
      if (hash) {
        setLastHash(hash);
        onConfirmed?.();
      }
    } catch {
      setError("交易未完成，请查看钱包或页面提示。");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm">当前角色：{permissions.role}</span>
      {permissions.canDispute && (
        <button className="btn btn-warning btn-sm" disabled={disabled} onClick={() => void submit("dispute")}>
          {pendingAction === "dispute" ? "争议交易处理中…" : "发起争议"}
        </button>
      )}
      {permissions.canResolve && (
        <>
          <button className="btn btn-success btn-sm" disabled={disabled} onClick={() => void submit("resolve", true)}>
            {pendingAction === "resolve" ? "仲裁交易处理中…" : "判给卖家"}
          </button>
          <button className="btn btn-outline btn-sm" disabled={disabled} onClick={() => void submit("resolve", false)}>
            退给买家
          </button>
        </>
      )}
      {lastHash && (
        <a
          className="link text-sm"
          href={`https://scan-testnet.potos.hk/tx/${lastHash}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          查看交易
        </a>
      )}
      {error && <span className="text-error text-sm">{error}</span>}
    </div>
  );
}
