export type Order = {
  buyer: string;
  seller: string;
  token: string;
  amount: bigint;
  deadline: bigint;
  status: number;
  description: string;
};

export const orderStatuses = ["Created", "Paid", "Completed", "Refunded", "Disputed", "Shipped"] as const;

export function isBuyer(order: Order, account?: string) {
  return !!account && order.buyer.toLowerCase() === account.toLowerCase();
}

// Reject excess precision explicitly: parseUnits otherwise rounds some inputs.
export function amountToUnits(input: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error("无法读取代币精度");
  if (!/^\d+(\.\d+)?$/.test(input)) throw new Error("金额必须是正数，不支持科学计数法");
  const [whole, fraction = ""] = input.split(".");
  if (fraction.length > decimals) throw new Error(`金额最多支持 ${decimals} 位小数`);
  const units = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
  if (units <= 0n || units >= 2n ** 256n) throw new Error("金额必须大于零且在合约允许范围内");
  return units;
}

export function deadlineFromMinutes(input: string, timestamp: bigint): bigint {
  if (!/^\d+$/.test(input) || BigInt(input) < 1n || BigInt(input) > 525600n) {
    throw new Error("到期时间请填写 1 至 525600 的整数分钟");
  }
  return timestamp + BigInt(input) * 60n;
}

export type PaymentPort = {
  readOrder: () => Promise<Order>;
  assertWallet: () => void;
  allowance: (order: Order) => Promise<bigint>;
  balance: (order: Order) => Promise<bigint>;
  approve: (order: Order) => Promise<void>;
  deposit: () => Promise<void>;
};

// Both write callbacks resolve only after a successful on-chain receipt.
export async function payOrder(account: string, port: PaymentPort) {
  port.assertWallet();
  const order = await port.readOrder();
  if (!isBuyer(order, account)) throw new Error("只有该订单买家可以付款");
  if (order.status !== 0) throw new Error("订单已不是 Created，请刷新订单");
  const [balance, allowance] = await Promise.all([port.balance(order), port.allowance(order)]);
  if (balance < order.amount) throw new Error("代币余额不足，请联系买家检查余额");
  if (allowance < order.amount) {
    port.assertWallet();
    await port.approve(order);
  }
  port.assertWallet();
  const latest = await port.readOrder();
  if (!isBuyer(latest, account) || latest.status !== 0) throw new Error("订单状态已变化，请刷新后再操作");
  await port.deposit();
}

export async function confirmOrder(
  account: string,
  port: Pick<PaymentPort, "readOrder" | "assertWallet"> & {
    confirm: () => Promise<void>;
  },
) {
  port.assertWallet();
  const order = await port.readOrder();
  if (!isBuyer(order, account) || (order.status !== 1 && order.status !== 5))
    throw new Error("只有该订单买家可确认已付款或已发货订单");
  port.assertWallet();
  await port.confirm();
}
