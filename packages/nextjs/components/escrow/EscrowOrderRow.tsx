"use client";

import { useState } from "react";
import { EscrowDisputeActions } from "./EscrowDisputeActions";
import { EscrowOrderTimeline } from "./EscrowOrderTimeline";
import { EscrowShippingActions } from "./EscrowShippingActions";
import { Address as AddressType, erc20Abi, formatUnits } from "viem";
import { useReadContract } from "wagmi";
import { ConfirmButton } from "~~/app/escrow/_components/ConfirmButton";
import { PayButton } from "~~/app/escrow/_components/PayButton";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";

const STATUS_LABELS = ["待付款", "已付款", "已完成", "已退款", "争议中", "已发货"];

function OrderAmount({ token, amount }: { token: AddressType; amount: bigint }) {
  const { targetNetwork } = useTargetNetwork();
  const { data: decimals } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "decimals",
    chainId: targetNetwork.id,
  });
  const { data: symbol } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "symbol",
    chainId: targetNetwork.id,
  });

  return (
    <div className="space-y-2">
      <span className="font-medium">
        {decimals === undefined ? `${amount.toString()} 最小单位` : formatUnits(amount, decimals)} {symbol}
      </span>
      <Address address={token} size="xs" />
    </div>
  );
}

export function EscrowOrderRow({ orderId, createdAtBlock }: { orderId: bigint; createdAtBlock?: bigint }) {
  const [showTimeline, setShowTimeline] = useState(false);
  const {
    data: order,
    error,
    refetch,
  } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "getOrder",
    args: [orderId],
  });

  if (error) {
    return (
      <tr>
        <th scope="row">#{orderId.toString()}</th>
        <td colSpan={6}>
          <div className="flex items-center gap-3" role="alert">
            <span className="text-error">订单读取失败，请重试。</span>
            <button className="btn btn-sm btn-outline" onClick={() => void refetch()}>
              重新读取
            </button>
          </div>
        </td>
      </tr>
    );
  }

  if (!order) {
    return (
      <tr>
        <th scope="row">#{orderId.toString()}</th>
        <td colSpan={6}>
          <span className="loading loading-spinner loading-xs mr-2" aria-hidden="true" />
          订单读取中…
        </td>
      </tr>
    );
  }

  const deadline = new Date(Number(order.deadline) * 1000);
  const isValidDeadline = Number.isFinite(deadline.getTime());

  return (
    <>
      <tr>
        <th scope="row">#{orderId.toString()}</th>
        <td>
          <div className="space-y-3">
            <div>
              <span className="text-xs opacity-70">买家</span>
              <Address address={order.buyer} size="sm" />
            </div>
            <div>
              <span className="text-xs opacity-70">卖家</span>
              <Address address={order.seller} size="sm" />
            </div>
          </div>
        </td>
        <td>
          <OrderAmount token={order.token} amount={order.amount} />
        </td>
        <td aria-live="polite">
          <span className="badge badge-outline whitespace-nowrap">{STATUS_LABELS[order.status] ?? "未知状态"}</span>
        </td>
        <td>
          {isValidDeadline ? (
            <time dateTime={deadline.toISOString()}>{deadline.toLocaleString("zh-CN", { hour12: false })}</time>
          ) : (
            <span>{order.deadline.toString()} 秒</span>
          )}
        </td>
        <td className="min-w-36 max-w-64 whitespace-normal break-words">{order.description || "无描述"}</td>
        <td className="min-w-64 space-y-4">
          <PayButton orderId={orderId} order={order} onSuccess={() => void refetch()} />
          <ConfirmButton orderId={orderId} order={order} onSuccess={() => void refetch()} />
          <EscrowShippingActions orderId={orderId} order={order} onSuccess={() => void refetch()} />
          <EscrowDisputeActions
            orderId={orderId}
            order={{ buyer: order.buyer, seller: order.seller, status: order.status }}
            onConfirmed={() => void refetch()}
          />
          <button
            className="btn btn-ghost btn-sm"
            aria-expanded={showTimeline}
            aria-controls={`order-timeline-${orderId}`}
            aria-label={`${showTimeline ? "收起" : "展开"}订单 #${orderId} 的时间线`}
            onClick={() => setShowTimeline(previous => !previous)}
          >
            {showTimeline ? "收起时间线" : "展开时间线"}
          </button>
        </td>
      </tr>
      {showTimeline && (
        <tr id={`order-timeline-${orderId}`}>
          <td colSpan={7} className="p-0 sm:p-3">
            <div className="sticky left-0 w-[calc(100vw-2rem)] sm:w-auto">
              <EscrowOrderTimeline orderId={orderId} status={order.status} createdAtBlock={createdAtBlock} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
