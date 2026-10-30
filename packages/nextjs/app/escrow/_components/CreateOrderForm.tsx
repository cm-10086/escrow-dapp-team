"use client";

import { FormEvent, useState } from "react";
import { useOrderTransaction } from "../_hooks/useOrderTransaction";
import { CHAIN_ID, escrowContract, tokenContract } from "../_lib/contracts";
import { amountToUnits, deadlineFromMinutes } from "../_lib/orderWrites";
import { TransactionFeedback } from "./TransactionFeedback";
import { Hash, decodeEventLog, erc20Abi, getAddress, isAddress, zeroAddress } from "viem";
import { useReadContract, useWriteContract } from "wagmi";

export function CreateOrderForm({ onCreated }: { onCreated?: (orderId: bigint, hash: Hash) => void }) {
  const tx = useOrderTransaction();
  const { writeContractAsync } = useWriteContract();
  const [seller, setSeller] = useState("");
  const [amount, setAmount] = useState("30");
  const [minutes, setMinutes] = useState("30");
  const [description, setDescription] = useState("");
  const [createdId, setCreatedId] = useState<bigint>();
  const { data: decimals } = useReadContract({
    address: tokenContract.address,
    abi: erc20Abi,
    functionName: "decimals",
    chainId: CHAIN_ID,
  });
  const { data: symbol } = useReadContract({
    address: tokenContract.address,
    abi: erc20Abi,
    functionName: "symbol",
    chainId: CHAIN_ID,
  });
  const count = useReadContract({
    ...escrowContract,
    functionName: "orderCount",
    chainId: CHAIN_ID,
    query: { refetchInterval: 30000 },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void tx.run(async ({ account, send }) => {
      setCreatedId(undefined);
      if (!isAddress(seller) || seller.toLowerCase() === zeroAddress) throw new Error("请填写有效的非零卖家地址");
      const sellerAddress = getAddress(seller);
      if (sellerAddress.toLowerCase() === account.toLowerCase()) throw new Error("买家不能同时是卖家");
      if (decimals === undefined) throw new Error("代币精度尚未读取成功，请稍后重试");
      const units = amountToUnits(amount, decimals);
      const block = await tx.client!.getBlock();
      const deadline = deadlineFromMinutes(minutes, block.timestamp);
      // Read the count for context only; concurrent creates can change it before mining.
      await count.refetch({ throwOnError: true });
      const receipt = await send("创建订单", () =>
        writeContractAsync({
          address: escrowContract.address,
          abi: escrowContract.abi,
          functionName: "createOrder",
          args: [sellerAddress, tokenContract.address, units, deadline, description.trim()],
          account,
          chainId: CHAIN_ID,
        }),
      );
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== escrowContract.address.toLowerCase()) continue;
        let id: bigint;
        try {
          const event = decodeEventLog({
            abi: escrowContract.abi,
            eventName: "OrderCreated",
            data: log.data,
            topics: log.topics,
          });
          if (event.args.buyer.toLowerCase() !== account.toLowerCase()) continue;
          id = event.args.id;
        } catch {
          // Other receipt logs are not OrderCreated events.
          continue;
        }
        setCreatedId(id);
        void count.refetch();
        onCreated?.(id, receipt.transactionHash);
        return;
      }
      throw new Error("交易已确认，但未解析到订单号；请按上方哈希核验，不要重复创建");
    });
  };

  return (
    <section className="card bg-base-100 shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-xl font-bold">创建托管订单</h2>
        <p className="text-sm opacity-70">当前钱包将成为买家。创建后还需授权并付款。</p>
      </div>
      <p className="text-sm m-0">
        链上已有订单：{count.data?.toString() ?? (count.error ? "读取失败" : "读取中")} · 新订单号以创建回执为准
      </p>
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={tx.busy} className="space-y-4">
          <label className="flex flex-col gap-1">
            卖家钱包地址
            <input
              className="input input-bordered w-full font-mono"
              value={seller}
              onChange={e => setSeller(e.target.value.trim())}
              placeholder="0x…"
              required
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              金额（{symbol ?? "代币"}）
              <input
                className="input input-bordered w-full"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              多少分钟后到期
              <input
                className="input input-bordered w-full"
                inputMode="numeric"
                value={minutes}
                onChange={e => setMinutes(e.target.value)}
                required
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            订单描述
            <textarea
              className="textarea textarea-bordered w-full"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={500}
              placeholder="填写商品或服务说明"
            />
          </label>
          <p className="text-xs break-all">
            支付代币：{tokenContract.address} · 精度：{decimals ?? "读取中"}
          </p>
          <button type="submit" className="btn btn-primary" disabled={!tx.ready || decimals === undefined || tx.busy}>
            {tx.busy ? "处理中…" : "创建订单"}
          </button>
          {!tx.ready && <p className="text-sm">请在右上角连接钱包并切换到 POTOS Testnet。</p>}
        </fieldset>
      </form>
      {createdId !== undefined && (
        <p role="status" className="text-success font-bold">
          创建成功，真实订单号 #{createdId.toString()}
        </p>
      )}
      <TransactionFeedback {...tx} />
    </section>
  );
}
