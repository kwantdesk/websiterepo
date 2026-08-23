/**
 * Return the exact, timestamp-ordered execution window visible at a replay
 * clock. Historical order-flow tapes can contain hundreds of thousands of
 * prints; filtering the complete tape on every replay frame stalls every
 * chart sharing the browser main thread. Binary bounds keep the lookup
 * logarithmic while preserving every classified execution inside the window.
 */
export function sliceReplayExecutionWindow<T extends { timestamp: number }>(
  records: readonly T[],
  clock: number | null,
  lookbackMs: number,
): T[] {
  if (clock === null || !Number.isFinite(clock) || !records.length) return [];
  const start = Math.max(0, clock - Math.max(0, lookbackMs));

  let low = 0;
  let high = records.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (records[middle].timestamp < start) low = middle + 1;
    else high = middle;
  }
  const startIndex = low;

  low = startIndex;
  high = records.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (records[middle].timestamp <= clock) low = middle + 1;
    else high = middle;
  }

  return records.slice(startIndex, low);
}

/**
 * Eight hours spans a full RTH session with room either side, and at
 * one-second flow resolution stays inside the 30,000-bucket cap the event
 * history keeps per request (28,800 of 30,000).
 */
export const REPLAY_EVENT_FLOW_WINDOW_MS = 8 * 60 * 60_000;

/**
 * Which slice of the archive an event-interval order-flow tape should cover.
 *
 * Live, the useful window is the one ENDING at the request — the trader is
 * watching the right-hand edge. A replay is the opposite: the candle window
 * deliberately reaches five sessions back and a day forward so the profiles
 * behind the cursor have history, so a tape anchored to that window's end
 * lands most of a day AFTER the moment playback begins. Order-flow studies
 * then stay empty through the entire session being replayed.
 *
 * Passing `anchorMs` switches to the forward window starting there.
 */
export function replayEventFlowWindow(args: {
  requestedStart: number;
  executionEnd: number;
  /** Where playback begins. Omit for a live chart's trailing window. */
  anchorMs?: number | null;
  trailingLookbackMs: number;
  forwardWindowMs?: number;
}): { start: number; end: number } | null {
  const { requestedStart, executionEnd, trailingLookbackMs } = args;
  if (!Number.isFinite(requestedStart) || !Number.isFinite(executionEnd)) return null;
  const anchor = Number(args.anchorMs);
  const anchored = Number.isFinite(anchor) && anchor > 0
    ? Math.max(requestedStart, anchor)
    : null;
  const forwardWindowMs = Number.isFinite(Number(args.forwardWindowMs))
    ? Number(args.forwardWindowMs)
    : REPLAY_EVENT_FLOW_WINDOW_MS;
  const start = anchored === null
    ? Math.max(requestedStart, executionEnd - Math.max(0, trailingLookbackMs))
    : anchored;
  const end = anchored === null
    ? executionEnd
    // Never past the archive edge the caller resolved, however long the
    // forward window is.
    : Math.min(executionEnd, anchored + Math.max(0, forwardWindowMs));
  return end <= start ? null : { start, end };
}
