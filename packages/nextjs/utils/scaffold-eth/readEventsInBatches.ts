/** Read an inclusive block range without exceeding the RPC's per-request limit.
 * Results are returned only after every batch succeeds, so callers can then
 * advance their cursor without skipping a failed batch.
 */
export async function readEventsInBatches<T>({
  fromBlock,
  toBlock,
  blocksBatchSize,
  readBatch,
}: {
  fromBlock: bigint;
  toBlock: bigint;
  blocksBatchSize: number;
  readBatch: (fromBlock: bigint, toBlock: bigint) => Promise<readonly T[] | undefined>;
}): Promise<T[]> {
  if (!Number.isSafeInteger(blocksBatchSize) || blocksBatchSize <= 0) {
    throw new Error("blocksBatchSize must be a positive safe integer");
  }

  const events: T[] = [];
  const batchSize = BigInt(blocksBatchSize);
  for (let start = fromBlock; start <= toBlock; start += batchSize) {
    const end = start + batchSize - 1n;
    const batch = await readBatch(start, end < toBlock ? end : toBlock);
    if (batch === undefined) throw new Error("Event batch could not be read");
    for (const event of batch) events.push(event);
  }
  return events;
}
