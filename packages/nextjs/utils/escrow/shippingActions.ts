import type { Order } from "~~/app/escrow/_lib/orderWrites";

export function getShippingPermissions({
  account,
  order,
  chainTimestamp,
  supported,
}: {
  account?: string;
  order: Order;
  chainTimestamp?: bigint;
  supported: boolean;
}) {
  const buyer = !!account && account.toLowerCase() === order.buyer.toLowerCase();
  const seller = !!account && account.toLowerCase() === order.seller.toLowerCase();
  return {
    showShip: supported && seller && order.status === 1,
    showRefund: supported && buyer && order.status === 1,
    canShip:
      supported && seller && order.status === 1 && chainTimestamp !== undefined && chainTimestamp <= order.deadline,
    canRefund:
      supported && buyer && order.status === 1 && chainTimestamp !== undefined && chainTimestamp > order.deadline,
  };
}

type ShippingPort = {
  assertWallet: () => void;
  supportsShipping: () => Promise<boolean>;
  readOrder: () => Promise<Order>;
  chainTimestamp: () => Promise<bigint>;
};

export async function shipOrder(account: string, port: ShippingPort & { markShipped: () => Promise<void> }) {
  port.assertWallet();
  if (!(await port.supportsShipping())) throw new Error("当前合约不支持发货，请核对新版部署地址");
  const order = await port.readOrder();
  if (order.seller.toLowerCase() !== account.toLowerCase()) throw new Error("只有订单卖家可以标记发货");
  if (order.status !== 1) throw new Error("只有已付款且未发货的订单可以发货");
  if ((await port.chainTimestamp()) > order.deadline) throw new Error("订单已到期，不能再标记发货");
  port.assertWallet();
  await port.markShipped();
}

export async function refundUnshippedOrder(account: string, port: ShippingPort & { refund: () => Promise<void> }) {
  port.assertWallet();
  if (!(await port.supportsShipping())) throw new Error("当前合约尚未通过发货版本核验");
  const order = await port.readOrder();
  if (order.buyer.toLowerCase() !== account.toLowerCase()) throw new Error("只有订单买家可以申请超期退款");
  if (order.status !== 1) throw new Error("只有未发货的已付款订单可以超期退款");
  if ((await port.chainTimestamp()) <= order.deadline) throw new Error("订单尚未超过链上截止时间");
  // Shipping or another settlement may have completed while the latest block was loading.
  const latest = await port.readOrder();
  if (latest.status !== 1 || latest.buyer.toLowerCase() !== account.toLowerCase())
    throw new Error("订单状态已变化，请刷新后重试");
  port.assertWallet();
  await port.refund();
}
