export type ChartViewportSyncRole = "independent" | "peer";

export type ChartViewportSnapshot = {
  groupId: string;
  sourceChartId: string;
  instrument: string;
  timeframe: string;
  visibleTimeRange: { from: number; to: number };
  priceRange: { from: number; to: number };
  anchorPrice: number;
  updatedAt: number;
};

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
  linkedInstrument: string,
  linkedAnchorPrice: number,
) {
  if (
    snapshot.instrument.trim().toUpperCase() === linkedInstrument.trim().toUpperCase()
    || !Number.isFinite(snapshot.anchorPrice)
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
