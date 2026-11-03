"use client";

import { useState } from "react";
import { CreateOrderForm } from "./_components/CreateOrderForm";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { EscrowAccountRoles } from "~~/components/escrow/EscrowAccountRoles";
import { EscrowOrderRow } from "~~/components/escrow/EscrowOrderRow";
import { Address } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useEscrowArbiters } from "~~/hooks/useEscrowArbiters";
import { useEscrowOrderHistory } from "~~/hooks/useEscrowOrderHistory";
import { useShippingSupport } from "~~/hooks/useShippingSupport";

export default function EscrowPage() {
  const shipping = useShippingSupport();
  const { address } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { data: escrow, isLoading: isContractLoading } = useDeployedContractInfo({ contractName: "Escrow" });
  const { data: orderCount, error: orderCountError } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "orderCount",
  });
  const { arbiters, ready: arbitersReady, error: arbiterError } = useEscrowArbiters();
  const {
    data: created,
    error,
    isLoading,
    isFetchingNewEvent,
    isSyncingHistory,
    refetch,
  } = useEscrowOrderHistory(orderCount);
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmedOrderBlocks, setConfirmedOrderBlocks] = useState(new Map<bigint, bigint>());
  const creationBlocks = new Map(confirmedOrderBlocks);
  for (const event of created) {
    if (typeof event?.args.id === "bigint" && typeof event.blockNumber === "bigint") {
      creationBlocks.set(event.args.id, event.blockNumber);
    }
  }

  const orderIds = [
    ...new Set([
      ...confirmedOrderBlocks.keys(),
      ...created.flatMap(event => (typeof event?.args.id === "bigint" ? [event.args.id] : [])),
    ]),
  ].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));

  const roleDataFailed = Boolean(error || arbiterError || orderCountError || (!isContractLoading && !escrow));
  const roleDataReady = Boolean(
    escrow && arbitersReady && orderCount !== undefined && !isLoading && BigInt(orderIds.length) >= orderCount,
  );

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["blockNumber"] }),
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["readContract"] }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <main className="w-full max-w-screen-2xl mx-auto px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">托管订单</h1>
          <p className="my-0 opacity-70">创建托管订单，并按当前钱包角色付款、确认收货、发起争议或处理仲裁。</p>
        </div>
        <button className="btn btn-primary btn-sm" disabled={isRefreshing || !escrow} onClick={() => void refresh()}>
          {isRefreshing ? "刷新中…" : "刷新订单"}
        </button>
      </div>

      <div className="mb-6 rounded-xl bg-base-100 p-4 text-sm" role="status">
        {!shipping.configured
          ? "当前使用实验三合约；新版合约部署并配置后可使用发货和双人仲裁功能。"
          : shipping.isLoading
            ? "正在核验加分合约的发货和双人仲裁功能…"
            : shipping.enabled
              ? "当前为加分版合约：已发货订单不能超期退款；两名仲裁人意见一致后才会结算。"
              : "当前配置地址未通过发货与双人仲裁核验，写操作已禁用，请核对新版部署地址与网络。"}
      </div>

      <div className="grid gap-4 mb-6 rounded-2xl bg-base-100 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="mt-0 mb-2 text-sm opacity-70">当前账户</p>
          {address ? <Address address={address} size="sm" /> : <span>未连接钱包，可查看订单</span>}
          <EscrowAccountRoles
            account={address}
            arbiters={arbiters}
            orders={created.map(event => event?.args ?? {})}
            dataState={roleDataFailed ? "error" : roleDataReady ? "ready" : "loading"}
          />
        </div>
        <div>
          <p className="mt-0 mb-2 text-sm opacity-70">托管合约 · {targetNetwork.name}</p>
          {escrow ? <Address address={escrow.address} size="sm" /> : <span>合约读取中…</span>}
        </div>
        <div>
          <p className="mt-0 mb-2 text-sm opacity-70">{shipping.configured ? "双人仲裁 · 两人一致生效" : "仲裁人"}</p>
          {arbiters.length ? (
            arbiters.map((arbiter, index) => (
              <div key={arbiter} className="mb-2">
                {shipping.configured && <span className="text-xs opacity-70">仲裁人 {index + 1}</span>}
                <Address address={arbiter} size="sm" />
              </div>
            ))
          ) : (
            <span>{arbiterError ? "读取失败，请刷新重试" : "读取中…"}</span>
          )}
        </div>
        <div aria-live="polite">
          <p className="mt-0 mb-2 text-sm opacity-70">已读取订单 / 链上订单数</p>
          <span className="text-xl font-semibold">
            {orderIds.length} / {orderCount?.toString() ?? "…"}
          </span>
        </div>
      </div>

      {!isContractLoading && !escrow && (
        <p className="text-error" role="alert">
          无法读取托管合约，请检查网络连接后重试。
        </p>
      )}
      {error && (
        <p className="text-error" role="alert">
          订单列表读取失败，请点击“刷新订单”重试。
        </p>
      )}
      {(isLoading || isSyncingHistory) && (
        <p role="status">
          <span className="loading loading-spinner loading-sm mr-2" aria-hidden="true" />
          {isLoading ? "正在读取最新订单…" : "正在后台补读历史订单，已显示的订单可正常操作。"}
        </p>
      )}

      <div className="mb-6">
        <CreateOrderForm
          onCreated={(id, _hash, blockNumber) => {
            setConfirmedOrderBlocks(previous => new Map(previous).set(id, blockNumber));
            void refresh();
          }}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl bg-base-100 shadow-sm">
        <table className="table">
          <caption className="sr-only">托管订单及当前钱包可执行的付款、确认收货、争议和仲裁操作</caption>
          <thead>
            <tr>
              <th scope="col">订单号</th>
              <th scope="col">买卖双方</th>
              <th scope="col">金额 / 代币</th>
              <th scope="col">状态</th>
              <th scope="col">截止时间</th>
              <th scope="col">描述</th>
              <th scope="col">当前角色与操作</th>
            </tr>
          </thead>
          <tbody>
            {orderIds.map(orderId => (
              <EscrowOrderRow key={orderId.toString()} orderId={orderId} createdAtBlock={creationBlocks.get(orderId)} />
            ))}
            {!isLoading && !isFetchingNewEvent && !error && escrow && orderIds.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10">
                  暂无订单
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
