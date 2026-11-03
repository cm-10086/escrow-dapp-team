import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./orderTimeline.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { normalizeOrderTimeline, readOrderTimeline, isOrderTimelineComplete, getTimelineEventLabel } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const hash = n => `0x${BigInt(n).toString(16).padStart(64, "0")}`;
const log = (eventName, blockNumber, extra = {}) => ({
  eventName,
  args: { id: 7n },
  blockNumber,
  blockHash: hash(blockNumber),
  transactionHash: hash(blockNumber * 10n),
  transactionIndex: 0,
  logIndex: 0,
  ...extra,
});
const read = (events, status, options = {}) => {
  const ranges = [];
  return {
    ranges,
    result: readOrderTimeline({
      orderId: 7n,
      fromBlock: 100n,
      toBlock: 90100n,
      status,
      readBatch: async (from, to) => {
        ranges.push([from, to]);
        return events.filter(event => event.blockNumber >= from && event.blockNumber <= to);
      },
      ...options,
    }),
  };
};

test("a completed order stops at its own completion instead of scanning 90,000 empty blocks", async () => {
  const run = read([log("OrderCreated", 100n), log("OrderPaid", 111n), log("OrderCompleted", 125n)], 2);
  const result = await run.result;
  assert.deepEqual(run.ranges, [
    [100n, 109n],
    [110n, 119n],
    [120n, 129n],
  ]);
  assert.equal(result.complete, true);
  assert.equal(result.events.length, 3);
});

test("arbitration refund is complete with OrderResolved(false), without inventing OrderRefunded", async () => {
  const run = read(
    [
      log("OrderCreated", 100n),
      log("OrderPaid", 101n),
      log("OrderDisputed", 111n),
      log("OrderResolved", 115n, { args: { id: 7n, sellerWins: false } }),
    ],
    3,
  );
  const result = await run.result;
  assert.equal(result.complete, true);
  assert.equal(result.events.at(-1).eventName, "OrderResolved");
  assert.equal(getTimelineEventLabel(result.events.at(-1)), "仲裁退款给买家");
  assert.equal(
    result.events.some(event => event.eventName === "OrderRefunded"),
    false,
  );
});

test("seller-winning arbitration and timeout refund follow their respective real events", async () => {
  const prefix = [log("OrderCreated", 100n), log("OrderPaid", 101n)];
  const seller = await read(
    [...prefix, log("OrderDisputed", 102n), log("OrderResolved", 103n, { args: { id: 7n, sellerWins: true } })],
    2,
  ).result;
  assert.equal(seller.complete, true);
  assert.equal(getTimelineEventLabel(seller.events.at(-1)), "仲裁放款给卖家");
  const refund = await read([...prefix, log("OrderRefunded", 103n)], 3).result;
  assert.equal(refund.complete, true);
  assert.equal(getTimelineEventLabel(refund.events.at(-1)), "超期退款");
});

test("created, paid and disputed orders stop at the matching snapshot event", async () => {
  const events = [log("OrderCreated", 100n), log("OrderPaid", 111n), log("OrderDisputed", 122n)];
  for (const [status, count, calls] of [
    [0, 1, 1],
    [1, 2, 2],
    [4, 3, 3],
  ]) {
    const run = read(events, status);
    assert.equal((await run.result).events.length, count);
    assert.equal(run.ranges.length, calls);
  }
});

test("events sort by block, transaction index and log index, retaining separate logs in one transaction", () => {
  const a = log("OrderCreated", 100n, { transactionIndex: 0, logIndex: 1 });
  const b = log("OrderPaid", 100n, { transactionIndex: 1, logIndex: 0 });
  const c = log("OrderDisputed", 100n, { transactionIndex: 1, logIndex: 2 });
  const d = log("OrderResolved", 101n, { args: { id: 7n, sellerWins: false } });
  assert.deepEqual(normalizeOrderTimeline([d, c, b, a, a, d], 7n), [a, b, c, d]);
});

test("other orders, removed logs, unsupported events and pending logs do not enter the timeline", () => {
  const created = log("OrderCreated", 100n);
  const ignored = [
    log("OrderPaid", 101n, { args: { id: 8n } }),
    log("OrderPaid", 101n, { removed: true }),
    log("Approval", 101n),
    log("OrderPaid", 101n, { transactionHash: null }),
    log("OrderPaid", 101n, { blockNumber: null }),
  ];
  assert.deepEqual(normalizeOrderTimeline([created, ...ignored], 7n), [created]);
});

test("a final event with missing prerequisites is reported as incomplete and does not trigger a huge scan", async () => {
  const run = read([log("OrderCreated", 100n), log("OrderCompleted", 101n)], 2);
  assert.equal((await run.result).complete, false);
  assert.equal(run.ranges.length, 1);
  const arbitration = normalizeOrderTimeline(
    [
      log("OrderCreated", 100n),
      log("OrderPaid", 101n),
      log("OrderResolved", 102n, { args: { id: 7n, sellerWins: false } }),
    ],
    7n,
  );
  assert.equal(isOrderTimelineComplete(arbitration, 3), false);
});

test("no matching final event returns partial history through the explicit snapshot boundary", async () => {
  const run = read([log("OrderCreated", 100n)], 1, { toBlock: 124n });
  const result = await run.result;
  assert.equal(result.complete, false);
  assert.equal(result.throughBlock, 124n);
  assert.deepEqual(run.ranges, [
    [100n, 109n],
    [110n, 119n],
    [120n, 124n],
  ]);
});

test("a failed or unavailable batch rejects without marking the timeline complete", async () => {
  for (const readBatch of [
    async () => undefined,
    async () => {
      throw new Error("RPC unavailable");
    },
  ]) {
    await assert.rejects(readOrderTimeline({ orderId: 7n, fromBlock: 100n, toBlock: 124n, status: 2, readBatch }));
  }
});

test("cancelling an expanded timeline stops additional RPC batches and progress updates", async () => {
  const controller = new AbortController();
  let progressCalls = 0;
  let requests = 0;
  await assert.rejects(
    readOrderTimeline({
      orderId: 7n,
      fromBlock: 100n,
      toBlock: 90100n,
      status: 2,
      signal: controller.signal,
      readBatch: async () => {
        requests++;
        controller.abort();
        return [];
      },
      onProgress: () => progressCalls++,
    }),
    { name: "AbortError" },
  );
  assert.equal(requests, 1);
  assert.equal(progressCalls, 0);
});

test("block zero and large bigint heights retain inclusive 10-block boundaries", async () => {
  for (const start of [0n, 9007199254740993n]) {
    const run = read([log("OrderCreated", start), log("OrderPaid", start + 10n)], 1, {
      fromBlock: start,
      toBlock: start + 25n,
    });
    assert.equal((await run.result).complete, true);
    assert.deepEqual(run.ranges, [
      [start, start + 9n],
      [start + 10n, start + 19n],
    ]);
  }
});

test("invalid creation ranges and unknown statuses reject rather than claiming an empty complete history", async () => {
  for (const options of [{ fromBlock: -1n }, { fromBlock: 200n, toBlock: 100n }, { status: 5 }]) {
    await assert.rejects(
      readOrderTimeline({
        orderId: 7n,
        fromBlock: 100n,
        toBlock: 110n,
        status: 0,
        readBatch: async () => [],
        ...options,
      }),
    );
  }
});
