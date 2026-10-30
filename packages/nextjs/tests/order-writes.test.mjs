import { amountToUnits, confirmOrder, deadlineFromMinutes, isBuyer, payOrder } from "../app/escrow/_lib/orderWrites.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const buyer = "0x00000000000000000000000000000000000000ab";
const seller = "0x00000000000000000000000000000000000000cd";
const order = { buyer, seller, token: seller, amount: 30n, deadline: 100n, status: 0, description: "test" };
function payment(overrides = {}) {
  const events = [];
  const port = {
    readOrder: async () => order,
    assertWallet: () => {},
    allowance: async () => 0n,
    balance: async () => 30n,
    approve: async current => {
      assert.equal(current.amount, 30n);
      events.push("approve confirmed");
    },
    deposit: async () => {
      events.push("deposit");
    },
    ...overrides,
  };
  return { events, port };
}

test("amount uses exact bigint beyond Number precision", () => {
  assert.equal(amountToUnits("9007199254740993.123456789012345678", 18), 9007199254740993123456789012345678n);
  assert.equal(amountToUnits("0.000001", 6), 1n);
  assert.equal(amountToUnits("30", 0), 30n);
});
test("invalid, rounded, zero and overflowing amounts are rejected", () => {
  for (const input of ["1e3", "-1", "0", "0.0000001", "1.001", "NaN", "Infinity", "1.", "", "2".repeat(80)]) {
    assert.throws(() => amountToUnits(input, 2));
  }
});
test("deadline uses chain timestamp and whole minutes", () => {
  assert.equal(deadlineFromMinutes("30", 123456n), 125256n);
  for (const input of ["0", "1.5", "-2", "1e3", "525601"]) assert.throws(() => deadlineFromMinutes(input, 1n));
});
test("buyer comparison ignores address casing", () => {
  assert.equal(isBuyer(order, buyer.toUpperCase()), true);
  assert.equal(isBuyer(order, seller), false);
  assert.equal(isBuyer(order), false);
});
test("deposit waits for successful approval receipt", async () => {
  let release;
  const wait = new Promise(resolve => {
    release = resolve;
  });
  const p = payment({
    approve: async () => {
      await wait;
      p.events.push("approve confirmed");
    },
  });
  const flow = payOrder(buyer, p.port);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(p.events, []);
  release();
  await flow;
  assert.deepEqual(p.events, ["approve confirmed", "deposit"]);
});
test("rejected or reverted approval stops deposit", async () => {
  const p = payment({
    approve: async () => {
      throw new Error("approval rejected");
    },
  });
  await assert.rejects(payOrder(buyer, p.port), /approval rejected/);
  assert.deepEqual(p.events, []);
});
test("existing allowance avoids a redundant approval on retry", async () => {
  const p = payment({ allowance: async () => 30n });
  await payOrder(buyer, p.port);
  assert.deepEqual(p.events, ["deposit"]);
});
test("non-buyer, stale status and insufficient balance cannot write", async () => {
  for (const [account, overrides] of [
    [seller, {}],
    [buyer, { readOrder: async () => ({ ...order, status: 1 }) }],
    [buyer, { balance: async () => 29n }],
  ]) {
    const p = payment(overrides);
    await assert.rejects(payOrder(account, p.port));
    assert.deepEqual(p.events, []);
  }
});
test("account or network switch after approval stops deposit", async () => {
  let checks = 0;
  const p = payment({
    assertWallet: () => {
      if (++checks === 3) throw new Error("wallet changed");
    },
  });
  await assert.rejects(payOrder(buyer, p.port), /wallet changed/);
  assert.deepEqual(p.events, ["approve confirmed"]);
});
test("status change after approval stops deposit", async () => {
  let reads = 0;
  const p = payment({ readOrder: async () => ({ ...order, status: ++reads === 1 ? 0 : 1 }) });
  await assert.rejects(payOrder(buyer, p.port), /订单状态已变化/);
  assert.deepEqual(p.events, ["approve confirmed"]);
});
test("deposit rejection is reported and never retried automatically", async () => {
  let calls = 0;
  const p = payment({
    deposit: async () => {
      calls++;
      throw new Error("deposit rejected");
    },
  });
  await assert.rejects(payOrder(buyer, p.port), /deposit rejected/);
  assert.equal(calls, 1);
});
test("confirm only accepts the buyer of a Paid order", async () => {
  let writes = 0;
  for (const status of [0, 1, 2, 3, 4]) {
    for (const account of [buyer, seller]) {
      const flow = () =>
        confirmOrder(account, {
          assertWallet: () => {},
          readOrder: async () => ({ ...order, status }),
          confirm: async () => {
            writes++;
          },
        });
      if (status === 1 && account === buyer) await flow();
      else await assert.rejects(flow());
    }
  }
  assert.equal(writes, 1);
});
