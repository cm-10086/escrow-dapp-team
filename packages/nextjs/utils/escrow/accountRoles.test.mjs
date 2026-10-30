import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./accountRoles.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { getEscrowAccountRoles } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const buyer = "0xAb11111111111111111111111111111111111111";
const seller = "0xCd22222222222222222222222222222222222222";
const arbiter = "0xEf33333333333333333333333333333333333333";
const stranger = "0x9944444444444444444444444444444444444444";
const order = { buyer, seller };

test("a disconnected wallet has no assigned identities", () => {
  assert.deepEqual(getEscrowAccountRoles({ arbiter, orders: [order] }), []);
});

test("the on-chain arbiter is recognized even when there are no orders", () => {
  assert.deepEqual(getEscrowAccountRoles({ account: arbiter.toLowerCase(), arbiter, orders: [] }), ["仲裁人"]);
});

test("buyer matching ignores address case", () => {
  assert.deepEqual(getEscrowAccountRoles({ account: buyer.toUpperCase(), arbiter, orders: [order] }), ["买家"]);
});

test("seller matching ignores address case", () => {
  assert.deepEqual(getEscrowAccountRoles({ account: seller.toLowerCase(), arbiter, orders: [order] }), ["卖家"]);
});

test("one wallet can be buyer and seller in different orders", () => {
  const orders = [order, { buyer: stranger, seller: buyer }];
  assert.deepEqual(getEscrowAccountRoles({ account: buyer, arbiter, orders }), ["买家", "卖家"]);
});

test("an arbiter can also participate in orders without losing those identities", () => {
  const orders = [
    { buyer: arbiter, seller },
    { buyer, seller: arbiter },
  ];
  assert.deepEqual(getEscrowAccountRoles({ account: arbiter, arbiter, orders }), ["仲裁人", "买家", "卖家"]);
});

test("repeated or reordered events do not duplicate or reorder role labels", () => {
  const orders = [{ buyer: stranger, seller: buyer }, order, order];
  assert.deepEqual(getEscrowAccountRoles({ account: buyer, arbiter, orders }), ["买家", "卖家"]);
});

test("an unrelated connected wallet has no order identities", () => {
  assert.deepEqual(getEscrowAccountRoles({ account: stranger, arbiter, orders: [order] }), []);
});

test("missing event participants or arbiter data do not invent an identity", () => {
  assert.deepEqual(getEscrowAccountRoles({ account: buyer, orders: [{}, { seller }, { buyer: stranger }] }), []);
});
