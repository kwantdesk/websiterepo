export type ExecutionStreamContinuity = "checking" | "continuous" | "broken";

export type ExecutionStreamReceipt = {
  streamId: string;
  batchSequence: number;
};

type ContinuityPayload = {
  streamId?: unknown;
  batchSequence?: unknown;
  continuity?: unknown;
};

export function hasExecutionStreamReceiptMetadata(payload: ContinuityPayload): boolean {
  return payload.streamId !== undefined
    || payload.batchSequence !== undefined
    || payload.continuity !== undefined;
}

export function acceptExecutionStreamSeed(payload: ContinuityPayload): ExecutionStreamReceipt | null {
  const streamId = String(payload.streamId ?? "").trim();
  const batchSequence = Number(payload.batchSequence);
  if (
    !streamId
    || payload.continuity !== "continuous"
    || !Number.isSafeInteger(batchSequence)
    || batchSequence !== 0
  ) return null;
  return { streamId, batchSequence };
}

export function advanceExecutionStreamReceipt(
  receipt: ExecutionStreamReceipt,
  payload: ContinuityPayload,
): ExecutionStreamReceipt | null {
  const streamId = String(payload.streamId ?? "").trim();
  const batchSequence = Number(payload.batchSequence);
  if (
    payload.continuity !== "continuous"
    || streamId !== receipt.streamId
    || !Number.isSafeInteger(batchSequence)
    || batchSequence !== receipt.batchSequence + 1
  ) return null;
  return { streamId, batchSequence };
}
