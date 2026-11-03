"use client";

import { useRef, useState } from "react";
import { CHAIN_ID } from "../_lib/contracts";
import { Hash, TransactionReceipt } from "viem";
import { useAccount, useConfig, usePublicClient } from "wagmi";
import { getAccount } from "wagmi/actions";
import { useShippingSupport } from "~~/hooks/useShippingSupport";

export type TransactionRecord = { label: string; hash: Hash; confirmed: boolean };

export function useOrderTransaction() {
  const shipping = useShippingSupport();
  const config = useConfig();
  const account = useAccount();
  const client = usePublicClient({ chainId: CHAIN_ID });
  const lock = useRef(false);
  const unresolved = useRef<Hash | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [records, setRecords] = useState<TransactionRecord[]>([]);

  const run = async (
    action: (context: {
      account: string;
      assertWallet: () => void;
      send: (label: string, write: () => Promise<Hash>) => Promise<TransactionReceipt>;
    }) => Promise<void>,
  ) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("正在检查钱包与链上状态…");
    try {
      if (!client) throw new Error("网络尚未就绪，请稍后重试");
      if (shipping.configured && !shipping.enabled) throw new Error("新版合约尚未通过发货功能核验，请检查地址与网络");
      // A timeout is not a failed transaction. Resolve its receipt before allowing a new write.
      if (unresolved.current) {
        const hash = unresolved.current;
        const receipt = await client.waitForTransactionReceipt({ hash });
        unresolved.current = undefined;
        setRecords(items =>
          items.map(item => (item.hash === hash ? { ...item, confirmed: receipt.status === "success" } : item)),
        );
        setMessage(receipt.status === "success" ? "上笔交易已确认，请刷新订单后继续。" : "上笔交易已回滚，可以重试。");
        return;
      }
      const initial = getAccount(config);
      if (!initial.address || initial.status !== "connected") throw new Error("请先连接 MetaMask 钱包");
      const address = initial.address;
      const assertWallet = () => {
        const current = getAccount(config);
        if (current.chainId !== CHAIN_ID) throw new Error("请将钱包切换到 POTOS Testnet（60600）");
        if (current.status !== "connected" || current.address?.toLowerCase() !== address.toLowerCase()) {
          throw new Error("钱包账户已变化，请刷新订单后重试");
        }
      };
      assertWallet();
      await action({
        account: address,
        assertWallet,
        send: async (label, write) => {
          assertWallet();
          setMessage(`${label}：请在钱包确认`);
          const hash = await write();
          unresolved.current = hash;
          setRecords(items => [...items, { label, hash, confirmed: false }]);
          setMessage(`${label}：等待链上确认…`);
          let replacedWithDifferentCall = false;
          const receipt = await client.waitForTransactionReceipt({
            hash,
            onReplaced: replacement => {
              replacedWithDifferentCall = replacement.reason !== "repriced";
              unresolved.current = replacement.transaction.hash;
              setRecords(items =>
                items.map(item => (item.hash === hash ? { ...item, hash: replacement.transaction.hash } : item)),
              );
            },
          });
          const minedHash = unresolved.current;
          unresolved.current = undefined;
          setRecords(items =>
            items.map(item =>
              item.hash === minedHash
                ? { ...item, confirmed: receipt.status === "success" && !replacedWithDifferentCall }
                : item,
            ),
          );
          if (receipt.status !== "success") throw new Error(`${label}已回滚，请查看交易详情`);
          // A wallet cancellation replaces the transaction with another transaction, not the requested contract call.
          if (replacedWithDifferentCall) throw new Error(`${label}已被取消或替换，请刷新订单后重试`);
          setMessage(`${label}已确认`);
          return receipt;
        },
      });
    } catch (cause) {
      const detail = cause as { shortMessage?: string; message?: string };
      setError(detail.shortMessage || detail.message || "交易未完成，请重试");
      setMessage(
        unresolved.current
          ? "交易确认结果未知；请先核验下方哈希，再点击按钮查询结果。"
          : "操作未完成，已停止后续步骤。",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return {
    run,
    busy,
    message,
    error,
    records,
    client,
    account,
    ready:
      account.isConnected && account.chainId === CHAIN_ID && !!client && (!shipping.configured || shipping.enabled),
  };
}
