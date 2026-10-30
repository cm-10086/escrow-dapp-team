"use client";

import { FormEvent, useState } from "react";
import { ConfirmButton } from "../_components/ConfirmButton";
import { CreateOrderForm } from "../_components/CreateOrderForm";
import { PayButton } from "../_components/PayButton";
import { CHAIN_ID, escrowContract, explorerUrl } from "../_lib/contracts";
import { orderStatuses } from "../_lib/orderWrites";
import { erc20Abi, formatUnits } from "viem";
import { useReadContract } from "wagmi";

function OrderPreview({ orderId }: { orderId: bigint }) {
  const result = useReadContract({
    address: escrowContract.address,
    abi: escrowContract.abi,
    functionName: "getOrder",
    args: [orderId],
    chainId: CHAIN_ID,
    query: { refetchInterval: 15000 },
  });
  const order = result.data;
  const decimals = useReadContract({
    address: order?.token,
    abi: erc20Abi,
    functionName: "decimals",
    chainId: CHAIN_ID,
    query: { enabled: !!order },
  });
  const symbol = useReadContract({
    address: order?.token,
    abi: erc20Abi,
    functionName: "symbol",
    chainId: CHAIN_ID,
    query: { enabled: !!order },
  });
  if (result.isPending) return <p role="status">正在读取订单…</p>;
  if (result.error || !order)
    return (
      <div role="alert" className="text-error">
        读取失败，请检查订单号及 RPC 连接。
        <button className="btn btn-sm ml-3" onClick={() => void result.refetch()}>
          重试读取
        </button>
      </div>
    );
  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-3">
        <h3 className="font-bold">
          订单 #{orderId.toString()} <span className="badge badge-outline">{orderStatuses[order.status]}</span>
        </h3>
        <button className="btn btn-sm btn-ghost" onClick={() => void result.refetch()}>
          刷新状态
        </button>
      </div>
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="opacity-60">买家</dt>
          <dd className="font-mono break-all">{order.buyer}</dd>
        </div>
        <div>
          <dt className="opacity-60">卖家</dt>
          <dd className="font-mono break-all">{order.seller}</dd>
        </div>
        <div>
          <dt className="opacity-60">托管金额</dt>
          <dd>
            {decimals.data === undefined ? `${order.amount} 最小单位` : formatUnits(order.amount, decimals.data)}{" "}
            {symbol.data ?? ""}
          </dd>
        </div>
        <div>
          <dt className="opacity-60">代币合约</dt>
          <dd className="font-mono break-all">{order.token}</dd>
        </div>
        <div>
          <dt className="opacity-60">到期时间</dt>
          <dd>
            {order.deadline <= 8640000000000n
              ? new Date(Number(order.deadline) * 1000).toLocaleString("zh-CN")
              : `${order.deadline} Unix 秒`}
          </dd>
        </div>
        <div>
          <dt className="opacity-60">描述</dt>
          <dd className="whitespace-pre-wrap break-words">{order.description || "未填写"}</dd>
        </div>
      </dl>
      <PayButton orderId={orderId} order={order} onSuccess={() => void result.refetch()} />
      <ConfirmButton orderId={orderId} order={order} onSuccess={() => void result.refetch()} />
      <p className="text-xs opacity-70">付款与确认收货仅对该订单买家显示。卖家和仲裁人的争议、仲裁操作待小组整合。</p>
    </div>
  );
}

export default function WritePreviewPage() {
  const [idInput, setIdInput] = useState("");
  const [orderId, setOrderId] = useState<bigint>();
  const [inputError, setInputError] = useState("");
  const load = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d+$/.test(idInput) || BigInt(idInput) >= 2n ** 256n) {
      setInputError("请输入有效的非负整数订单号");
      return;
    }
    setInputError("");
    setOrderId(BigInt(idInput));
  };
  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header>
        <p className="text-sm opacity-60">第 8 组 · POTOS Testnet · 宋穗杰</p>
        <h1 className="text-3xl font-bold">托管订单 · 创建与付款</h1>
        <p>创建、授权付款与确认收货的联调入口。联合验收由彭连接买家钱包，你连接卖家钱包。</p>
        <a
          className="link text-xs break-all"
          href={`${explorerUrl}/address/${escrowContract.address}`}
          target="_blank"
          rel="noreferrer"
        >
          Escrow：{escrowContract.address}
        </a>
      </header>
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <CreateOrderForm
          onCreated={id => {
            setOrderId(id);
            setIdInput(id.toString());
          }}
        />
        <section className="card bg-base-100 shadow-sm p-5 space-y-4">
          <h2 className="text-xl font-bold">查看并操作订单</h2>
          <form onSubmit={load} className="flex gap-2 items-end">
            <label className="flex-1 flex flex-col gap-1">
              真实订单号
              <input
                className="input input-bordered w-full"
                placeholder="填写链上实际订单号"
                value={idInput}
                onChange={e => setIdInput(e.target.value)}
                inputMode="numeric"
                required
              />
            </label>
            <button className="btn btn-secondary" type="submit">
              读取
            </button>
          </form>
          {inputError && (
            <p className="text-error" role="alert">
              {inputError}
            </p>
          )}
          {orderId === undefined ? (
            <p className="opacity-60">创建成功后自动显示新订单，也可查询已有订单。请勿预设本次验收订单为 0 或 1。</p>
          ) : (
            <OrderPreview key={orderId.toString()} orderId={orderId} />
          )}
        </section>
      </div>
    </main>
  );
}
