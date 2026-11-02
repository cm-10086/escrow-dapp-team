"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useEscrowOrderTimeline } from "~~/hooks/useEscrowOrderTimeline";
import { OrderTimelineEvent, getTimelineEventLabel } from "~~/utils/escrow/orderTimeline";

function TimelineEntry({ event }: { event: OrderTimelineEvent }) {
  const { targetNetwork } = useTargetNetwork();
  const client = usePublicClient({ chainId: targetNetwork.id });
  const block = useQuery({
    queryKey: ["escrowTimelineBlock", targetNetwork.id, event.blockHash],
    queryFn: () => client!.getBlock({ blockHash: event.blockHash }),
    enabled: Boolean(client),
    staleTime: Infinity,
    retry: 1,
  });
  const transaction = useQuery({
    queryKey: ["escrowTimelineTransaction", targetNetwork.id, event.transactionHash],
    queryFn: () => client!.getTransaction({ hash: event.transactionHash }),
    enabled: Boolean(client),
    staleTime: Infinity,
    retry: 1,
  });
  const date = block.data ? new Date(Number(block.data.timestamp) * 1000) : undefined;
  const explorer = targetNetwork.blockExplorers?.default.url;

  return (
    <li className="relative border-l-2 border-primary/25 pl-5 pb-6 last:pb-0">
      <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-primary" aria-hidden="true" />
      <p className="m-0 font-semibold">{getTimelineEventLabel(event)}</p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm opacity-75">
        {date && Number.isFinite(date.getTime()) ? (
          <time dateTime={date.toISOString()}>{date.toLocaleString("zh-CN", { hour12: false })}</time>
        ) : (
          <span>{block.error ? "区块时间读取失败" : "区块时间读取中…"}</span>
        )}
        <span>区块 {event.blockNumber.toString()}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span>操作账户</span>
        {transaction.data ? (
          <Address address={transaction.data.from} size="xs" />
        ) : (
          <span>{transaction.error ? "账户读取失败" : "读取中…"}</span>
        )}
      </div>
      {(block.error || transaction.error) && (
        <button
          className="btn btn-ghost btn-xs mt-1"
          onClick={() => {
            if (block.error) void block.refetch();
            if (transaction.error) void transaction.refetch();
          }}
        >
          重新读取时间与账户
        </button>
      )}
      <p className="m-0 mt-2 break-all text-sm">
        {explorer ? (
          <a
            className="link link-primary"
            href={`${explorer}/tx/${event.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {event.transactionHash}
          </a>
        ) : (
          <span>{event.transactionHash}</span>
        )}
      </p>
    </li>
  );
}

export function EscrowOrderTimeline({
  orderId,
  status,
  createdAtBlock,
}: {
  orderId: bigint;
  status: number;
  createdAtBlock?: bigint;
}) {
  const timeline = useEscrowOrderTimeline(orderId, status, createdAtBlock);
  return (
    <section aria-label={`订单 #${orderId} 时间线`} className="rounded-xl bg-base-200/50 p-4 sm:p-6 whitespace-normal">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-bold">订单 #{orderId.toString()} 时间线</h2>
          <p className="m-0 mt-1 text-sm opacity-70">按链上执行顺序展示，点击交易哈希可核验详情。</p>
        </div>
        <button
          className="btn btn-outline btn-sm"
          disabled={timeline.isFetching || createdAtBlock === undefined}
          onClick={() => void timeline.refresh()}
        >
          刷新时间线
        </button>
      </div>
      {createdAtBlock === undefined ? (
        <p role="status">正在定位订单创建记录，请稍后重试。</p>
      ) : (
        <>
          {timeline.isFetching && (
            <p role="status" className="text-sm">
              <span className="loading loading-spinner loading-xs mr-2" aria-hidden="true" />
              正在读取订单记录，已找到 {timeline.foundCount} 条…
            </p>
          )}
          {timeline.error && (
            <p role="alert" className="text-error text-sm">
              时间线读取失败，已有订单不受影响，请点击“刷新时间线”重试。
            </p>
          )}
          {timeline.data && !timeline.data.complete && (
            <p role="alert" className="text-warning text-sm">
              尚未读取到完整订单记录，以下为已确认事件，请刷新重试。
            </p>
          )}
          {timeline.data && (
            <>
              <p className="text-sm mb-4" aria-live="polite">
                {timeline.data.complete
                  ? `已读取 ${timeline.data.events.length} 条链上记录`
                  : `已找到 ${timeline.data.events.length} 条记录`}
              </p>
              <ol className="ml-2">
                {timeline.data.events.map(event => (
                  <TimelineEntry key={`${event.blockHash}:${event.transactionHash}:${event.logIndex}`} event={event} />
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </section>
  );
}
