export type ChartHydrationIdentity = {
  broker: string;
  symbol: string;
  timeframe: string;
  period: string;
  historicalRangeKey?: string | null;
};

export function chartHydrationKey(identity: ChartHydrationIdentity) {
  return [
    identity.broker,
    identity.symbol,
    identity.timeframe,
    identity.period,
    identity.historicalRangeKey ?? "live",
  ].join("::");
}

export function chartContinuityInspectionTime(now: number, timeframeMs: number) {
  if (!Number.isFinite(now) || !Number.isFinite(timeframeMs) || timeframeMs <= 0) return now;
  // The first packet in a newly-opened bucket is not guaranteed to arrive on
  // the exact wall-clock boundary. Inspect slightly behind real time so a
  // healthy chart is not quarantined during those first seconds, while the
  // packet-driven check still catches an internal gap immediately.
  const boundaryGraceMs = Math.min(15_000, Math.max(1_000, timeframeMs / 4));
  return now - boundaryGraceMs;
}

export function chartNeedsLoadingCover({
  requestKey,
  settledRequestKey,
  continuityRecoveryKey,
  loading,
  error,
  candleCount,
}: {
  requestKey: string;
  settledRequestKey: string | null;
  continuityRecoveryKey?: string | null;
  loading: boolean;
  error: string | null;
  candleCount: number;
}) {
  // Changing instrument, interval, period or replay window must synchronously
  // hide the previous series. React effects clear that data after paint, which
  // is too late for a trading chart: even one frame can show the wrong market.
  if (settledRequestKey !== requestKey) return true;
  // A chart can become invalid after it has already settled when the live feed
  // resumes beyond one or more missing time buckets. Keep that known-broken
  // series quarantined until the authoritative history/seam reconciliation
  // explicitly clears this exact request key. The ordinary loading flag is
  // insufficient because unrelated order-flow hydration may lower it.
  if (continuityRecoveryKey === requestKey) return true;
  return loading || (!error && candleCount === 0);
}
