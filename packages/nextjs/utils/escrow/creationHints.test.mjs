import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./creationHints.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { getCreationHintBlocks } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const address = "0x1111111111111111111111111111111111111111";
const selector = "0x02bd3421";
const item = block => ({ raw_input: selector + "00", block_number: block, to: { hash: address }, status: "ok" });

test("index hints locate yesterday's creation blocks without manufacturing order IDs", () => {
  assert.deepEqual(getCreationHintBlocks([item(90000), item("100"), item(90000)], address, selector, 100n, 100000n), [
    90000n,
    100n,
  ]);
});
test("failed calls, other contracts, other methods and out-of-range blocks are not creation hints", () => {
  const bad = [
    null,
    {},
    { ...item(100), status: "error" },
    { ...item(100), raw_input: "0xb6b55f25" },
    { ...item(100), to: { hash: "0x2222" } },
    item(99),
    item(201),
  ];
  assert.deepEqual(getCreationHintBlocks(bad, address, selector, 100n, 200n), []);
});
test("unsafe numbers and malformed heights are rejected while large decimal bigint strings remain exact", () => {
  assert.deepEqual(
    getCreationHintBlocks(
      [item(NaN), item(1.5), item("0x80"), item("bad"), item(9007199254740992), item("9007199254740993")],
      address,
      selector,
      0n,
      9007199254740993n,
    ),
    [9007199254740993n],
  );
});
