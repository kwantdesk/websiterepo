import type {ISeriesApi} from "lightweight-charts";
import type { Candle } from "./backtester";
import { chartTimeBucketStartMs } from "./chartTimeBucket";

/** Classified live prices share chart ingress without network calls or React
 * commits. Only real prints/index observations may advance candle display. */
export type ChartLivePrice = {
  key: string; symbol: string; contractSymbol?: string;
  price: number; sourceTimestampMs: number; receivedAt: number;
  /** A quote midpoint is not an executed candle close. */
  priceType?: "trade" | "quote" | "index";
};

/** Fast display of a verified print in an already established clock candle.
 * The lossless tape still owns bar creation, volume, delta and full history. */
export function advanceCandleFromLivePrice(candle: Candle | null, quote: ChartLivePrice, timeframe: string): Candle | null {
  if (!candle || (quote.priceType !== "trade" && quote.priceType !== "index")
    || !Number.isFinite(quote.price) || quote.price <= 0 || !Number.isFinite(quote.sourceTimestampMs)
    || ![candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)
    || chartTimeBucketStartMs(quote.sourceTimestampMs, timeframe) !== candle.timestamp
    || quote.sourceTimestampMs < (candle.sourceEndTimestamp ?? candle.timestamp)) return null;
  return { ...candle, close: quote.price, high: Math.max(candle.high, quote.price),
    low: Math.min(candle.low, quote.price), sourceEndTimestamp: quote.sourceTimestampMs };
}
type Listener = { symbol: string; contractSymbol?: string; receive: (quote: ChartLivePrice) => void };
const latest = new Map<string, ChartLivePrice>();
const listeners = new Map<string, Set<Listener>>();
export const chartQuoteKey = (watchlistKey: string) => `quote:${watchlistKey}`;
const matches = (listener: Pick<Listener, "symbol" | "contractSymbol">, quote: ChartLivePrice) =>
  listener.symbol === quote.symbol && (!listener.contractSymbol || listener.contractSymbol === quote.contractSymbol);

export function publishChartLivePrice(quote: ChartLivePrice) {
  // This bus now paints last price and candle together. BBO midpoints still
  // update the separate watchlist store, but are not executed candle prices
  // and must not advance the trade watermark ahead of a delayed real print.
  if (quote.priceType === "quote") return;
  if (!quote.key || !quote.symbol || !Number.isFinite(quote.price) || quote.price <= 0
    || !Number.isFinite(quote.sourceTimestampMs) || quote.sourceTimestampMs <= 0
    || !Number.isFinite(quote.receivedAt)) return;
  const previous = latest.get(quote.key);
  if (previous && previous.symbol === quote.symbol && previous.contractSymbol === quote.contractSymbol
    && quote.sourceTimestampMs < previous.sourceTimestampMs) return;
  latest.delete(quote.key); latest.set(quote.key, quote);
  while (latest.size > 256) latest.delete(latest.keys().next().value!);
  listeners.get(quote.key)?.forEach(listener => {
    if (matches(listener, quote)) { try { listener.receive(quote); } catch { /* Isolate a chart being disposed. */ } }
  });
}

export function subscribeChartLivePrice(
  key: string, symbol: string, contractSymbol: string | undefined,
  receive: Listener["receive"],
) {
  const listener = { symbol, contractSymbol, receive };
  const set = listeners.get(key) ?? new Set<Listener>(); set.add(listener); listeners.set(key, set);
  const retained = latest.get(key);
  if (retained && Date.now() - retained.receivedAt < 10_000 && matches(listener, retained)) {
    try { receive(retained); } catch { /* A later quote can retry after chart setup. */ }
  }
  return () => { set.delete(listener); if (!set.size) listeners.delete(key); };
}

/** Subscribe at the shared quote ingress, before pane validation, trading UI
 * callbacks and execution studies. Pane prints remain a fallback; the same
 * packet returning through the pane must not cause a second canvas repaint. */
export function subscribeChartDisplayPrice(
  key: string, symbol: string, contractSymbol: string | undefined,
  broker: string | undefined, receive: Listener["receive"],
) {
  let last: ChartLivePrice | undefined;
  const forward = (quote: ChartLivePrice) => {
    if (last && (quote.sourceTimestampMs < last.sourceTimestampMs
      || (quote.sourceTimestampMs === last.sourceTimestampMs && quote.price === last.price))) return;
    last = quote;
    receive(quote);
  };
  const stopPane = subscribeChartLivePrice(key, symbol, contractSymbol, forward);
  const stopShared = broker ? subscribeChartLivePrice(
    chartQuoteKey(`${broker}::${symbol}`), symbol, contractSymbol, forward,
  ) : () => {};
  return () => { stopPane(); stopShared(); };
}

type PriceSeries = Pick<ISeriesApi<"Candlestick">, "options" | "applyOptions" | "createPriceLine" | "removePriceLine">;
type PriceLine = ReturnType<PriceSeries["createPriceLine"]>;

export function createLiveQuotePriceLine(series: PriceSeries, color: string) {
  const options = series.options();
  const original = {...options, ...(options.priceFormat ? {priceFormat: {...options.priceFormat}} : {})};
  let line: PriceLine | null = null, closed = false;
  return {
    update(quote: ChartLivePrice) {
      if (closed) return;
      if (!line) {
        line = series.createPriceLine({price: quote.price, color, title: "",
          lineStyle: original.priceLineStyle, lineWidth: original.priceLineWidth,
          lineVisible: original.priceLineVisible, axisLabelVisible: original.lastValueVisible});
        // Real bid/ask midpoints can fall between execution ticks. Preserve the
        // contract's axis increment, but format the quote to its displayed
        // precision instead of snapping its label onto a different trade tick.
        const format = original.priceFormat;
        series.applyOptions({priceLineVisible: false, lastValueVisible: false,
          ...(format && format.type !== "custom" ? {priceFormat: {type: "custom", minMove: format.minMove,
            formatter: (price: number) => price.toFixed(("precision" in format ? format.precision : 2))}} : {})});
      } else line.applyOptions({price: quote.price});
    },
    dispose() {
      closed = true;
      try {
        if (line) series.removePriceLine(line);
        series.applyOptions({priceLineVisible: original.priceLineVisible, lastValueVisible: original.lastValueVisible,
          ...(original.priceFormat ? {priceFormat: original.priceFormat} : {})});
      } catch { /* The chart lifecycle may already have removed this series. */ }
      line = null;
    },
  };
}
