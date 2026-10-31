export type ChartViewportSyncRole = "independent" | "peer";

export type ChartViewportSnapshot = {
  groupId: string;
  sourceChartId: string;
  instrument: string;
  timeframe: string;
  visibleTimeRange: { from: number; to: number };
  visibleLogicalRange: { from: number; to: number };
  sourceDataLength: number;
  sourceLastTimestamp?: number;
  /** Real native-axis coordinates; candle counts are not comparable across feeds. */
  timeScaleAnchors?: { timestamp: number; logical: number }[];
  replayScope?: string;
  priceRange: { from: number; to: number };
  anchorPrice: number;
  /** The common candle instant used for vertical comparison across peers. */
  anchorTimestamp?: number;
  updatedAt: number;
};

/** Never compare one instrument's latest quote with another's older candle.
 * A clock gap has no valid price anchor; time synchronization can still run. */
export function linkedPriceAnchorAt(
  candles: readonly { timestamp: number; close: number }[],
  timestamp?: number,
  intervalMs: number | null = null,
) {
  if (!candles.length || (timestamp !== undefined && !Number.isFinite(timestamp))) return null;
  let index = candles.length - 1;
  if (timestamp !== undefined) {
    let low = 0, high = candles.length;
    while (low < high) { const middle = (low + high) >>> 1; if (candles[middle].timestamp <= timestamp) low = middle + 1; else high = middle; }
    index = low - 1;
  }
  const candle = candles[index];
  if (!candle || !Number.isFinite(candle.close) || candle.close <= 0
    || (timestamp !== undefined && intervalMs && timestamp - candle.timestamp >= intervalMs)) return null;
  return { timestamp: candle.timestamp, price: candle.close };
}

/**
 * Align a viewport through real native-axis timestamp anchors. Legacy packets
 * without anchors retain the former tail-relative fallback below.
 *
 * Lightweight Charts clips getVisibleRange() to available timestamps. When a
 * user pans near either edge, copying that clipped time range makes a follower
 * pin one side and stretch the other. Logical ranges include whitespace, so
 * preserving both their span and their offset from the latest bar keeps a pan
 * as a translation and reserves span changes for real zoom gestures.
 */
export function resolveLinkedLogicalRange(
  snapshot: Pick<ChartViewportSnapshot, "visibleLogicalRange" | "sourceDataLength" | "timeScaleAnchors">,
  linkedDataLength: number,
  logicalAtTimestamp?: (timestamp: number) => number | null,
) {
  const from = Number(snapshot.visibleLogicalRange.from);
  const to = Number(snapshot.visibleLogicalRange.to);
  const sourceLength = Math.max(0, Math.trunc(Number(snapshot.sourceDataLength)));
  const targetLength = Math.max(0, Math.trunc(Number(linkedDataLength)));
  if (
    !Number.isFinite(from)
    || !Number.isFinite(to)
    || to <= from
    || sourceLength === 0
    || targetLength === 0
  ) return null;

  if (snapshot.timeScaleAnchors?.length && logicalAtTimestamp) {
    const anchors = snapshot.timeScaleAnchors.flatMap((anchor) => {
      const target = logicalAtTimestamp(anchor.timestamp);
      return Number.isFinite(anchor.logical) && target !== null && Number.isFinite(target)
        ? [{ source: anchor.logical, target }] : [];
    });
    if (!anchors.length) return null;
    const first = anchors[0], last = anchors.at(-1)!;
    const scale = last.source > first.source ? (last.target - first.target) / (last.source - first.source) : 1;
    if (!(scale > 0) || !Number.isFinite(scale)) return null;
    return { from: first.target + (from - first.source) * scale, to: first.target + (to - first.source) * scale };
  }

  const span = to - from;
  const rightOffset = to - (sourceLength - 1);
  const targetTo = (targetLength - 1) + rightOffset;
  return { from: targetTo - span, to: targetTo };
}

/** Resolve real time on the recipient's native axis, including fractional bars
 * and edge whitespace. Never assume that its candle index is its native index. */
export function linkedLogicalAtTimestamp(
  timestamp: number,
  candles: readonly { timestamp: number }[],
  nativeIndexAt: (timestamp: number) => number | null,
  intervalMs: number | null,
) {
  if (!Number.isFinite(timestamp) || !candles.length) return null;
  const exact = nativeIndexAt(timestamp);
  if (exact !== null && Number.isFinite(exact)) return exact;
  let lo = 0, hi = candles.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (candles[mid].timestamp < timestamp) lo = mid + 1; else hi = mid; }
  const left = candles[Math.max(0, lo - 1)], right = candles[Math.min(lo, candles.length - 1)];
  const a = nativeIndexAt(left.timestamp), b = nativeIndexAt(right.timestamp);
  if (a === null || b === null) return null;
  if (right.timestamp > left.timestamp) return a + (b - a) * (timestamp - left.timestamp) / (right.timestamp - left.timestamp);
  // Outside history, a time chart's whitespace advances in real intervals.
  // Irregular event charts use their observed edge cadence instead.
  const neighbor = lo === 0 ? candles[1] : candles.at(-2);
  const cadence = intervalMs && intervalMs > 0 ? intervalMs : neighbor ? Math.abs(neighbor.timestamp - left.timestamp) : 0;
  return cadence > 0 ? a + (timestamp - left.timestamp) / cadence : a;
}

const replayDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
export function chartViewportReplayScope(timestamp: number | null | undefined) {
  return timestamp == null ? "live" : !Number.isFinite(timestamp) ? "replay:invalid" : "replay:" + replayDay.format(timestamp);
}

/** A live-edge view seeded with old replay data must advance once live history
 * arrives. A deliberately historical live view must retain its chosen time. */
export function shouldAdvanceLinkedLiveViewport(snapshot: ChartViewportSnapshot, latestTimestamp: number | undefined, intervalMs: number | null) {
  const prior = snapshot.sourceLastTimestamp;
  return (snapshot.replayScope ?? "live") === "live" && Boolean(snapshot.timeScaleAnchors?.length)
    && Number.isFinite(prior) && Number.isFinite(latestTimestamp) && latestTimestamp! > prior!
    && chartViewportReplayScope(prior) !== chartViewportReplayScope(latestTimestamp)
    && snapshot.visibleTimeRange.to * 1_000 >= prior! - (intervalMs ?? 0);
}

const VIEWPORT_SYNC_EVENT = "kwantdesk:chart-viewport-sync";
const latestByGroup = new Map<string, ChartViewportSnapshot>();

export function publishChartViewport(snapshot: ChartViewportSnapshot) {
  latestByGroup.set(snapshot.groupId, snapshot);
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ChartViewportSnapshot>(VIEWPORT_SYNC_EVENT, { detail: snapshot }));
}

export function readLatestChartViewport(groupId: string) {
  return latestByGroup.get(groupId) ?? null;
}

export function clearChartViewportGroup(groupId: string) {
  latestByGroup.delete(groupId);
}

export function subscribeChartViewport(
  groupId: string,
  listener: (snapshot: ChartViewportSnapshot) => void,
) {
  if (typeof window === "undefined") return () => undefined;
  const handle = (event: Event) => {
    const snapshot = (event as CustomEvent<ChartViewportSnapshot>).detail;
    if (snapshot?.groupId === groupId) listener(snapshot);
  };
  window.addEventListener(VIEWPORT_SYNC_EVENT, handle);
  return () => window.removeEventListener(VIEWPORT_SYNC_EVENT, handle);
}

export function resolveLinkedPriceRange(
  snapshot: ChartViewportSnapshot,
  _linkedInstrument: string,
  linkedAnchorPrice: number,
) {
  if (
    !Number.isFinite(snapshot.anchorPrice)
    || snapshot.anchorPrice <= 0
    || !Number.isFinite(linkedAnchorPrice)
    || linkedAnchorPrice <= 0
  ) {
    return snapshot.priceRange;
  }
  const lowerOffset = (snapshot.priceRange.from - snapshot.anchorPrice) / snapshot.anchorPrice;
  const upperOffset = (snapshot.priceRange.to - snapshot.anchorPrice) / snapshot.anchorPrice;
  return {
    from: linkedAnchorPrice * (1 + lowerOffset),
    to: linkedAnchorPrice * (1 + upperOffset),
  };
}

export function centerPriceRangeOnAnchor(
  priceRange: { from: number; to: number },
  anchorPrice: number,
) {
  const from = Number(priceRange.from);
  const to = Number(priceRange.to);
  if (
    !Number.isFinite(from)
    || !Number.isFinite(to)
    || to <= from
    || !Number.isFinite(anchorPrice)
    || anchorPrice <= 0
  ) {
    return priceRange;
  }
  const halfSpan = (to - from) / 2;
  return {
    from: anchorPrice - halfSpan,
    to: anchorPrice + halfSpan,
  };
}
