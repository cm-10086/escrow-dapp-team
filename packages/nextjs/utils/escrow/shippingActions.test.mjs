import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./shippingActions.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { getShippingPermissions, shipOrder, refundUnshippedOrder } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const buyer = "0x00000000000000000000000000000000000000ab";
const seller = "0x00000000000000000000000000000000000000cd";
const order = { buyer, seller, token: buyer, amount: 30n, deadline: 100n, status: 1, description: "unit test only" };
function port(overrides = {}) {
  const writes = [];
  return {
    writes,
    assertWallet: () => {},
    supportsShipping: async () => true,
    readOrder: async () => order,
    chainTimestamp: async () => 100n,
    markShipped: async () => {
      writes.push("ship");
    },
    refund: async () => {
      writes.push("refund");
    },
    ...overrides,
  };
}
test("role, status and chain time jointly gate shipping and timeout refunds", () => {
  for (const status of [0, 1, 2, 3, 4, 5])
    for (const account of [buyer, seller, undefined, "outsider"]) {
      for (const chainTimestamp of [undefined, 99n, 100n, 101n])
        for (const supported of [true, false]) {
          const p = getShippingPermissions({ account, order: { ...order, status }, chainTimestamp, supported });
          assert.equal(p.showShip, supported && account === seller && status === 1);
          assert.equal(p.showRefund, supported && account === buyer && status === 1);
          assert.equal(p.canShip, p.showShip && chainTimestamp !== undefined && chainTimestamp <= 100n);
          assert.equal(p.canRefund, p.showRefund && chainTimestamp !== undefined && chainTimestamp > 100n);
        }
    }
});
test("seller can ship at the exact deadline and address casing is ignored", async () => {
  const p = port();
  await shipOrder(seller.toUpperCase(), p);
  assert.deepEqual(p.writes, ["ship"]);
});
test("fresh contract capability, role, status and deadline failures prevent signing", async () => {
  for (const [account, overrides] of [
    [buyer, {}],
    [seller, { supportsShipping: async () => false }],
    ...[0, 2, 3, 4, 5].map(status => [seller, { readOrder: async () => ({ ...order, status }) }]),
    [seller, { chainTimestamp: async () => 101n }],
    [
      seller,
      {
        chainTimestamp: async () => {
          throw new Error("RPC down");
        },
      },
    ],
  ]) {
    const p = port(overrides);
    await assert.rejects(shipOrder(account, p));
    assert.deepEqual(p.writes, []);
  }
});
test("wallet change after asynchronous checks prevents shipping or refund", async () => {
  for (const [action, account] of [
    [shipOrder, seller],
    [refundUnshippedOrder, buyer],
  ]) {
    let checks = 0;
    const p = port({
      chainTimestamp: async () => (action === shipOrder ? 100n : 101n),
      assertWallet: () => {
        if (++checks === 2) throw new Error("wallet changed");
      },
    });
    await assert.rejects(action(account, p), /wallet changed/);
    assert.deepEqual(p.writes, []);
  }
});
test("refund requires buyer, Paid, supported contract and strictly expired chain time", async () => {
  for (const [account, overrides] of [
    [seller, { chainTimestamp: async () => 101n }],
    [buyer, { supportsShipping: async () => false }],
    [buyer, {}],
    [buyer, { chainTimestamp: async () => 99n }],
    ...[0, 2, 3, 4, 5].map(status => [
      buyer,
      { chainTimestamp: async () => 101n, readOrder: async () => ({ ...order, status }) },
    ]),
  ]) {
    const p = port(overrides);
    await assert.rejects(refundUnshippedOrder(account, p));
    assert.deepEqual(p.writes, []);
  }
  const p = port({ chainTimestamp: async () => 101n });
  await refundUnshippedOrder(buyer.toUpperCase(), p);
  assert.deepEqual(p.writes, ["refund"]);
});
test("shipping or settlement observed during a refund preflight stops the refund", async () => {
  for (const status of [2, 3, 4, 5]) {
    let reads = 0;
    const p = port({
      chainTimestamp: async () => 101n,
      readOrder: async () => ({ ...order, status: ++reads === 1 ? 1 : status }),
    });
    await assert.rejects(refundUnshippedOrder(buyer, p), /状态已变化/);
    assert.deepEqual(p.writes, []);
  }
});
test("actions wait for the transaction promise, propagate failure, and never retry a write", async () => {
  for (const [action, account, name] of [
    [shipOrder, seller, "markShipped"],
    [refundUnshippedOrder, buyer, "refund"],
  ]) {
    let release;
    let settled = false;
    const p = port({
      chainTimestamp: async () => (action === shipOrder ? 100n : 101n),
      [name]: () =>
        new Promise(resolve => {
          release = resolve;
        }),
    });
    const flow = action(account, p).then(() => {
      settled = true;
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(settled, false);
    release();
    await flow;
    assert.equal(settled, true);
    let calls = 0;
    const fail = port({
      chainTimestamp: p.chainTimestamp,
      [name]: async () => {
        calls++;
        throw new Error("rejected or reverted");
      },
    });
    await assert.rejects(action(account, fail), /rejected or reverted/);
    assert.equal(calls, 1);
  }
});
