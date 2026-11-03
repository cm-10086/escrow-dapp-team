import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./arbitrationActions.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { getArbitrationProgress, getVoteLabel, voteOnDispute, disputeBonusOrder } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const buyer = "buyer",
  seller = "seller",
  a = "0xAB",
  b = "0xCD";
const order = { buyer, seller, status: 4 };
const port = (overrides = {}) => {
  const writes = [];
  return {
    writes,
    assertWallet: () => {},
    supportsDualArbitration: async () => true,
    readOrder: async () => order,
    readArbiters: async () => [a, b],
    readVote: async () => 0,
    resolve: async () => {
      writes.push("vote");
    },
    dispute: async () => {
      writes.push("dispute");
    },
    ...overrides,
  };
};
test("no vote, a refund vote, disagreement and matching votes are different states", () => {
  assert.equal(getArbitrationProgress(4).phase, "loading");
  assert.equal(getArbitrationProgress(4, [0, 0]).phase, "none");
  assert.equal(getArbitrationProgress(4, [1, 0]).phase, "one");
  assert.equal(getArbitrationProgress(4, [2, 1]).phase, "disagree");
  assert.equal(getArbitrationProgress(4, [1, 1]).phase, "agreed");
  assert.equal(getArbitrationProgress(3, [1, 1]).phase, "settled");
  assert.equal(getArbitrationProgress(4, [9, 1]).known, false);
  assert.equal(getVoteLabel(0), "尚未投票");
  assert.equal(getVoteLabel(1), "退给买家");
  assert.equal(getVoteLabel(2), "判给卖家");
});
test("both on-chain arbiters can submit either choice, including false as their first vote", async () => {
  for (const account of [a.toLowerCase(), b.toLowerCase()])
    for (const choice of [false, true]) {
      const p = port();
      await voteOnDispute(account, choice, p);
      assert.deepEqual(p.writes, ["vote"]);
    }
});
test("same opinions cannot repeat; either arbiter may change a previous opinion", async () => {
  for (const choice of [false, true]) {
    const same = port({ readVote: async () => (choice ? 2 : 1) });
    await assert.rejects(voteOnDispute(a, choice, same), /相同意见/);
    assert.deepEqual(same.writes, []);
    const change = port({ readVote: async () => (choice ? 1 : 2) });
    await voteOnDispute(b, choice, change);
    assert.deepEqual(change.writes, ["vote"]);
  }
});
test("outsider, stale status, wrong version, invalid arbiters and failed vote reads cannot sign", async () => {
  const cases = [
    { supportsDualArbitration: async () => false },
    { readArbiters: async () => [a, a.toLowerCase()] },
    { readArbiters: async () => [a] },
    { readVote: async () => 9 },
    {
      readVote: async () => {
        throw new Error("RPC down");
      },
    },
    ...[0, 1, 2, 3, 5].map(status => ({ readOrder: async () => ({ ...order, status }) })),
  ];
  for (const overrides of cases) {
    const p = port(overrides);
    await assert.rejects(voteOnDispute(a, false, p));
    assert.deepEqual(p.writes, []);
  }
  const p = port();
  await assert.rejects(voteOnDispute(buyer, false, p), /指定仲裁人/);
  assert.deepEqual(p.writes, []);
});
test("a wallet change during checks prevents voting; signing failure is never auto-retried", async () => {
  let checks = 0;
  const changed = port({
    assertWallet: () => {
      if (++checks === 2) throw new Error("changed");
    },
  });
  await assert.rejects(voteOnDispute(a, false, changed), /changed/);
  assert.deepEqual(changed.writes, []);
  let calls = 0;
  const rejected = port({
    resolve: async () => {
      calls++;
      throw new Error("rejected");
    },
  });
  await assert.rejects(voteOnDispute(a, false, rejected), /rejected/);
  assert.equal(calls, 1);
});
test("dispute preflight accepts Paid and Shipped participants, rejects all other roles and states", async () => {
  for (const status of [0, 1, 2, 3, 4, 5])
    for (const account of [buyer, seller, a]) {
      const p = port({ readOrder: async () => ({ ...order, status }) });
      if ([1, 5].includes(status) && [buyer, seller].includes(account)) {
        await disputeBonusOrder(account, p);
        assert.deepEqual(p.writes, ["dispute"]);
      } else {
        await assert.rejects(disputeBonusOrder(account, p));
        assert.deepEqual(p.writes, []);
      }
    }
});
