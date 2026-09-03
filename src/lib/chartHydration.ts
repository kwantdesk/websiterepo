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

export function chartNeedsLoadingCover({
  requestKey,
  settledRequestKey,
  loading,
  error,
  candleCount,
}: {
  requestKey: string;
  settledRequestKey: string | null;
  loading: boolean;
  error: string | null;
  candleCount: number;
}) {
  // Changing instrument, interval, period or replay window must synchronously
  // hide the previous series. React effects clear that data after paint, which
  // is too late for a trading chart: even one frame can show the wrong market.
  if (settledRequestKey !== requestKey) return true;
  return loading || (!error && candleCount === 0);
}
