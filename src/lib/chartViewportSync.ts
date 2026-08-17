export type ChartViewportSyncRole = "independent" | "king" | "follower";

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

export function resolveFollowerPriceRange(
  snapshot: ChartViewportSnapshot,
  followerInstrument: string,
  followerAnchorPrice: number,
) {
  if (
    snapshot.instrument.trim().toUpperCase() === followerInstrument.trim().toUpperCase()
    || !Number.isFinite(snapshot.anchorPrice)
    || snapshot.anchorPrice <= 0
    || !Number.isFinite(followerAnchorPrice)
    || followerAnchorPrice <= 0
  ) {
    return snapshot.priceRange;
  }
  const lowerOffset = (snapshot.priceRange.from - snapshot.anchorPrice) / snapshot.anchorPrice;
  const upperOffset = (snapshot.priceRange.to - snapshot.anchorPrice) / snapshot.anchorPrice;
  return {
    from: followerAnchorPrice * (1 + lowerOffset),
    to: followerAnchorPrice * (1 + upperOffset),
  };
}
