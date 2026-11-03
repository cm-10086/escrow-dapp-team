import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./deployment.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const mod = { exports: {} };
new Function("require", "module", "exports", outputText)(createRequire(import.meta.url), mod, mod.exports);
const { selectEscrowDeployment } = mod.exports;
const legacy = { address: "0x1111111111111111111111111111111111111111", deployedOnBlock: 100 };
const bonus = "0x2222222222222222222222222222222222222222";
test("blank bonus configuration keeps the existing deployment", () => {
  assert.deepEqual(selectEscrowDeployment(legacy), { ...legacy, isBonus: false });
});
test("an explicit new address and deployment block select bonus mode together", () => {
  assert.deepEqual(selectEscrowDeployment(legacy, ` ${bonus} `, " 200 "), {
    address: bonus,
    deployedOnBlock: 200,
    isBonus: true,
  });
});
test("partial or invalid configuration never silently changes the target contract", () => {
  for (const [address, block] of [
    [bonus, ""],
    ["", "200"],
    [legacy.address, "200"],
    ["0x" + "0".repeat(40), "200"],
    ["invalid", "200"],
    ...["0", "-1", "1.5", "1e3", "9007199254740992"].map(block => [bonus, block]),
  ]) {
    assert.throws(() => selectEscrowDeployment(legacy, address, block));
  }
});
