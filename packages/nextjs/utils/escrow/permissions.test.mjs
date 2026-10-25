import { getEscrowPermissions } from "./permissions.ts";
import assert from "node:assert/strict";
import test from "node:test";

const buyer = "0x5a11A430A712486394708358fa76a6688FFA6275";
const seller = "0x84707E0f5d7d22486818eb3b3F9fAda2D5Dd909e";
const arbiter = "0xDD22eDe4D64E611519099bAF7813B5b10294b20B";

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
