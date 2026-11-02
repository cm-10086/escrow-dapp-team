/** Explorer data only locates blocks. The caller must read actual OrderCreated logs from RPC. */
export function getCreationHintBlocks(
  items: readonly unknown[],
  address: string,
  selector: string,
  deployment: bigint,
  head: bigint,
): bigint[] {
  const blocks = new Set<bigint>();
  for (const value of items) {
    if (!value || typeof value !== "object") continue;
    const item = value as { raw_input?: unknown; block_number?: unknown; to?: { hash?: unknown }; status?: unknown };
    if (
      typeof item.raw_input !== "string" ||
      !item.raw_input.startsWith(selector) ||
      typeof item.to?.hash !== "string" ||
      item.to.hash.toLowerCase() !== address.toLowerCase() ||
      item.status !== "ok"
    )
      continue;
    const raw = item.block_number;
    if (!(typeof raw === "number" && Number.isSafeInteger(raw)) && !(typeof raw === "string" && /^\d+$/.test(raw)))
      continue;
    const block = BigInt(raw);
    if (block >= deployment && block <= head) blocks.add(block);
  }
  return [...blocks].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
}
