import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./permissions.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { getEscrowPermissions } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

const buyer = "0x5a11A430A712486394708358fa76a6688FFA6275";
const seller = "0x84707E0f5d7d22486818eb3b3F9fAda2D5Dd909e";
const arbiter = "0xDD22eDe4D64E611519099bAF7813B5b10294b20B";

test("已发货后买家可确认，买卖双方可争议，旁观者不能操作", () => {
  for (const account of [buyer, seller, arbiter, undefined]) {
    const p = getEscrowPermissions({ account, buyer, seller, arbiter, status: 5 });
    assert.equal(p.canConfirm, account === buyer);
    assert.equal(p.canDispute, account === buyer || account === seller);
    assert.equal(p.canResolve, false);
  }
});

test("付款后买家可确认或争议，不能仲裁", () => {
  assert.deepEqual(getEscrowPermissions({ account: buyer, buyer, seller, arbiter, status: 1 }), {
    role: "买家",
    canConfirm: true,
    canDispute: true,
    canResolve: false,
  });
});

test("地址大小写不影响卖家的争议权限", () => {
  assert.deepEqual(getEscrowPermissions({ account: seller.toLowerCase(), buyer, seller, arbiter, status: 1 }), {
    role: "卖家",
    canConfirm: false,
    canDispute: true,
    canResolve: false,
  });
});

test("只有仲裁人在争议状态下可以裁决", () => {
  assert.deepEqual(getEscrowPermissions({ account: arbiter, buyer, seller, arbiter, status: 4n }), {
    role: "仲裁人",
    canConfirm: false,
    canDispute: false,
    canResolve: true,
  });
  assert.equal(getEscrowPermissions({ account: arbiter, buyer, seller, arbiter, status: 1 }).canResolve, false);
  assert.equal(getEscrowPermissions({ account: seller, buyer, seller, arbiter, status: 4 }).canResolve, false);
});

test("未连接钱包和旁观者都看不到操作按钮", () => {
  assert.deepEqual(getEscrowPermissions({ buyer, seller, arbiter, status: 1 }), {
    role: "未连接",
    canConfirm: false,
    canDispute: false,
    canResolve: false,
  });
  assert.deepEqual(
    getEscrowPermissions({ account: "0x0000000000000000000000000000000000000001", buyer, seller, arbiter, status: 1 }),
    { role: "旁观者", canConfirm: false, canDispute: false, canResolve: false },
  );
});
