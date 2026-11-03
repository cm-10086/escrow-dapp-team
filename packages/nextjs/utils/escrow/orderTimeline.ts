import type { Hash } from "viem";

export type OrderTimelineLog = {
  eventName?: string;
  args?: Record<string, unknown>;
  blockNumber: bigint | null;
  blockHash: Hash | null;
  transactionHash: Hash | null;
  transactionIndex: number | null;
  logIndex: number | null;
  removed?: boolean;
};

export type OrderTimelineEvent = OrderTimelineLog & {
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  blockHash: Hash;
  transactionHash: Hash;
  transactionIndex: number;
  logIndex: number;
};

const EVENT_NAMES = new Set([
  "OrderCreated",
  "OrderPaid",
  "OrderDisputed",
  "OrderCompleted",
  "OrderRefunded",
  "OrderResolved",
  "OrderShipped",
]);

/** Keep only confirmed events for this order, in their actual execution order. */
export function normalizeOrderTimeline(logs: readonly OrderTimelineLog[], orderId: bigint): OrderTimelineEvent[] {
  const unique = new Map<string, OrderTimelineEvent>();
  for (const log of logs) {
    if (
      log.removed ||
      !log.eventName ||
      !EVENT_NAMES.has(log.eventName) ||
      log.args?.id !== orderId ||
      log.blockNumber === null ||
      !log.blockHash ||
      !log.transactionHash ||
      log.transactionIndex === null ||
      log.logIndex === null
    )
      continue;
    unique.set(`${log.blockHash}:${log.transactionHash}:${log.logIndex}`, log as OrderTimelineEvent);
  }
  return [...unique.values()].sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
    return a.transactionIndex - b.transactionIndex || a.logIndex - b.logIndex;
  });
}

export function hasTimelineTarget(events: readonly OrderTimelineEvent[], status: number): boolean {
  return events.some(event => {
    if (status === 0) return event.eventName === "OrderCreated";
    if (status === 1) return event.eventName === "OrderPaid";
    if (status === 4) return event.eventName === "OrderDisputed";
    if (status === 5) return event.eventName === "OrderShipped";
    if (status === 2) {
      return (
        event.eventName === "OrderCompleted" || (event.eventName === "OrderResolved" && event.args.sellerWins === true)
      );
    }
    if (status === 3) {
      return (
        event.eventName === "OrderRefunded" || (event.eventName === "OrderResolved" && event.args.sellerWins === false)
      );
    }
    return false;
  });
}

export function isOrderTimelineComplete(events: readonly OrderTimelineEvent[], status: number): boolean {
  const has = (name: string) => events.some(event => event.eventName === name);
  if (!has("OrderCreated") || !hasTimelineTarget(events, status)) return false;
  if (status === 0) return true;
  if (!has("OrderPaid")) return false;
  if (events.some(event => event.eventName === "OrderResolved") && !has("OrderDisputed")) return false;
  return true;
}

export function getTimelineEventLabel(event: OrderTimelineEvent): string {
  switch (event.eventName) {
    case "OrderCreated":
      return "创建订单";
    case "OrderPaid":
      return "付款入托管";
    case "OrderShipped":
      return "卖家已发货";
    case "OrderDisputed":
      return "发起争议";
    case "OrderCompleted":
      return "确认收货并放款";
    case "OrderRefunded":
      return "超期退款";
    case "OrderResolved":
      return event.args.sellerWins === true ? "仲裁放款给卖家" : "仲裁退款给买家";
    default:
      return event.eventName;
  }
}

export type OrderTimelineResult = {
  events: OrderTimelineEvent[];
  complete: boolean;
  status: number;
  throughBlock: bigint;
};

/** Stop at the state-changing event, rather than scanning empty blocks up to today's head. */
export async function readOrderTimeline({
  orderId,
  fromBlock,
  toBlock,
  status,
  readBatch,
  signal,
  onProgress,
}: {
  orderId: bigint;
  fromBlock: bigint;
  toBlock: bigint;
  status: number;
  readBatch: (from: bigint, to: bigint) => Promise<readonly OrderTimelineLog[] | undefined>;
  signal?: AbortSignal;
  onProgress?: (eventCount: number, throughBlock: bigint) => void;
}): Promise<OrderTimelineResult> {
  if (fromBlock < 0n || toBlock < fromBlock) throw new Error("订单创建区块尚未确认，请稍后刷新");
  if (![0, 1, 2, 3, 4, 5].includes(status)) throw new Error("当前订单状态尚不支持此时间线");
  let events: OrderTimelineEvent[] = [];
  let throughBlock = fromBlock;
  for (let from = fromBlock; from <= toBlock; from += 10n) {
    signal?.throwIfAborted();
    const to = from + 9n < toBlock ? from + 9n : toBlock;
    const batch = await readBatch(from, to);
    signal?.throwIfAborted();
    if (batch === undefined) throw new Error("订单事件读取失败，请重试");
    events = normalizeOrderTimeline([...events, ...batch], orderId);
    throughBlock = to;
    onProgress?.(events.length, throughBlock);
    if (hasTimelineTarget(events, status)) break;
  }
  return { events, complete: isOrderTimelineComplete(events, status), status, throughBlock };
}
