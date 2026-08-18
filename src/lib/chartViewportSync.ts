export type ChartViewportSyncRole = "independent" | "peer";

export type ChartViewportSnapshot = {
  groupId: string;
  sourceChartId: string;
  instrument: string;
  timeframe: string;
  visibleTimeRange: { from: number; to: number };
  visibleLogicalRange: { from: number; to: number };
  sourceDataLength: number;
  priceRange: { from: number; to: number };
  anchorPrice: number;
  updatedAt: number;
};

/**
 * Rebase a source chart's logical viewport onto another chart's data tail.
 *
 * Lightweight Charts clips getVisibleRange() to available timestamps. When a
 * user pans near either edge, copying that clipped time range makes a follower
 * pin one side and stretch the other. Logical ranges include whitespace, so
 * preserving both their span and their offset from the latest bar keeps a pan
 * as a translation and reserves span changes for real zoom gestures.
 */
export function resolveLinkedLogicalRange(
  snapshot: Pick<ChartViewportSnapshot, "visibleLogicalRange" | "sourceDataLength">,
  linkedDataLength: number,
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

  const span = to - from;
  const rightOffset = to - (sourceLength - 1);
  const targetTo = (targetLength - 1) + rightOffset;
  return { from: targetTo - span, to: targetTo };
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
