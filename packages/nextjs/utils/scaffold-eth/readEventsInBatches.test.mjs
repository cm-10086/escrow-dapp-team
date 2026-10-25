import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Keep these tests runnable on the project's Node 20 baseline without a new loader.
const source = await readFile(new URL("./readEventsInBatches.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { readEventsInBatches } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("25 new blocks are read as 10 + 10 + 5 even when the RPC silently truncates wider ranges", async () => {
  const ranges = [];
  const events = await readEventsInBatches({
    fromBlock: 101n,
    toBlock: 125n,
    blocksBatchSize: 10,
    readBatch: async (from, to) => {
      ranges.push([from, to]);
      const end = to < from + 9n ? to : from + 9n;
      const batch = [];
      for (let block = from; block <= end; block++) batch.push(block);
      return batch;
    },
  });
  assert.deepEqual(ranges, [
    [101n, 110n],
    [111n, 120n],
    [121n, 125n],
  ]);
  assert.deepEqual(
    events,
    Array.from({ length: 25 }, (_, index) => 101n + BigInt(index)),
  );
});

test("inclusive boundaries cover block zero and exact batch multiples without gaps or duplicates", async () => {
  const ranges = [];
  await readEventsInBatches({
    fromBlock: 0n,
    toBlock: 19n,
    blocksBatchSize: 10,
    readBatch: async (from, to) => {
      ranges.push([from, to]);
      return [];
    },
  });
  assert.deepEqual(ranges, [
    [0n, 9n],
    [10n, 19n],
  ]);
  assert.deepEqual(
    await readEventsInBatches({
      fromBlock: 0n,
      toBlock: 0n,
      blocksBatchSize: 10,
      readBatch: async (from, to) => {
        assert.equal(from, 0n);
        assert.equal(to, 0n);
        return ["genesis"];
      },
    }),
    ["genesis"],
  );
});

test("a configurable batch size and bigint block heights retain exact boundaries", async () => {
  const start = BigInt(Number.MAX_SAFE_INTEGER) + 100n;
  const ranges = [];
  await readEventsInBatches({
    fromBlock: start,
    toBlock: start + 7n,
    blocksBatchSize: 3,
    readBatch: async (from, to) => {
      ranges.push([from, to]);
      return [];
    },
  });
  assert.deepEqual(ranges, [
    [start, start + 2n],
    [start + 3n, start + 5n],
    [start + 6n, start + 7n],
  ]);
});

test("an empty block interval does not send a request", async () => {
  const result = await readEventsInBatches({
    fromBlock: 11n,
    toBlock: 10n,
    blocksBatchSize: 10,
    readBatch: async () => {
      assert.fail("No RPC should be sent");
    },
  });
  assert.deepEqual(result, []);
});

test("empty event batches do not stop scanning later blocks", async () => {
  const ranges = [];
  const result = await readEventsInBatches({
    fromBlock: 1n,
    toBlock: 25n,
    blocksBatchSize: 10,
    readBatch: async (from, to) => {
      ranges.push([from, to]);
      return from === 21n ? ["late order"] : [];
    },
  });
  assert.equal(ranges.length, 3);
  assert.deepEqual(result, ["late order"]);
});

test("a failed middle batch rejects without querying later blocks or returning partial events", async () => {
  const ranges = [];
  const failure = new Error("RPC unavailable");
  await assert.rejects(
    readEventsInBatches({
      fromBlock: 1n,
      toBlock: 25n,
      blocksBatchSize: 10,
      readBatch: async (from, to) => {
        ranges.push([from, to]);
        if (from === 11n) throw failure;
        return ["first batch"];
      },
    }),
    error => error === failure,
  );
  assert.deepEqual(ranges, [
    [1n, 10n],
    [11n, 20n],
  ]);
});

test("an unavailable batch is a failure rather than a successful empty result", async () => {
  await assert.rejects(
    readEventsInBatches({ fromBlock: 1n, toBlock: 10n, blocksBatchSize: 10, readBatch: async () => undefined }),
    /could not be read/,
  );
});

test("invalid batch sizes reject instead of looping forever or truncating the range", async () => {
  for (const blocksBatchSize of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(
      readEventsInBatches({
        fromBlock: 1n,
        toBlock: 25n,
        blocksBatchSize,
        readBatch: async () => {
          assert.fail("Invalid sizes must not issue an RPC");
        },
      }),
      /positive safe integer/,
    );
  }
});
