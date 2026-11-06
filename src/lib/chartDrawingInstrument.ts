import type { DrawPoint, Drawing, DrawingPriceBasis } from "./chartDrawTools";
import { futuresInstrumentRoot } from "./futuresInstrumentIdentity";

type PriceBar = { timestamp: number; open: number };
export type DrawingMarket = {
  instrument: string;
  candles: readonly PriceBar[];
  intervalMs: number;
  tickSize: number;
};

const sharedPriceRoots: Record<string, string> = {
  MNQ: "NQ", MES: "ES", MYM: "YM", M2K: "RTY", MGC: "GC", MCL: "CL",
  SIL: "SI", MHG: "HG", MBT: "BTC", MET: "ETH",
  M6E: "6E", M6B: "6B", MJY: "6J", M6A: "6A", M6C: "6C", M6M: "6M",
};

function priceRoot(instrument: string) {
  const root = futuresInstrumentRoot(instrument);
  return sharedPriceRoots[root] ?? root;
}

function barAtOrBefore(candles: readonly PriceBar[], timeMs: number) {
  let left = 0;
  let right = candles.length;
  while (left < right) {
    const mid = (left + right) >>> 1;
    if (candles[mid].timestamp <= timeMs) left = mid + 1;
    else right = mid;
  }
  return candles[left - 1];
}

export function drawingPriceBasis(points: readonly DrawPoint[], market: DrawingMarket): DrawingPriceBasis {
  const firstAnchorMs = points[0]?.time * 1_000;
  const anchor = barAtOrBefore(market.candles, firstAnchorMs);
  const reference = anchor && firstAnchorMs - anchor.timestamp < market.intervalMs
    ? anchor
    : market.candles.at(-1);
  return {
    instrument: market.instrument,
    reference: reference && Number.isFinite(reference.open)
      ? { timestamp: reference.timestamp, price: reference.open }
      : undefined,
  };
}

const timeAnchoredTools = new Set<Drawing["tool"]>([
  "fixedRangeVolumeProfile", "anchoredVolumeProfile", "anchoredVwap", "verticalLine",
]);

export function projectChartDrawing(drawing: Drawing, market: DrawingMarket): Drawing | null {
  const basis = drawing.priceBasis;
  if (!basis || priceRoot(basis.instrument) === priceRoot(market.instrument)) return drawing;

  const reference = basis.reference;
  const target = reference && barAtOrBefore(market.candles, reference.timestamp);
  const matched = reference && target && reference.timestamp - target.timestamp < market.intervalMs
    && Number.isFinite(target.open);
  if (!matched && !timeAnchoredTools.has(drawing.tool)) return null;

  // One basis for the whole drawing keeps the angles, distances and risk
  // geometry coherent. The source points stay full precision in storage.
  const scale = matched && reference.price > 0 && target.open > 0 ? target.open / reference.price : 1;
  const tick = market.tickSize;
  const snap = (price: number) => Number((Math.round(price / tick) * tick).toPrecision(15));
  const points = drawing.points.map(point => {
    const price = matched
      ? target.open + (point.price - reference.price) * scale
      : barAtOrBefore(market.candles, point.time * 1_000)?.open ?? market.candles[0]?.open;
    return { ...point, price: price == null ? NaN : snap(price) };
  });
  if (!points.every(point => Number.isFinite(point.price))) return null;

  // A small stop or target can round onto the entry when mapping down to a
  // lower-priced product. Preserve the side and an intentional break-even.
  if (drawing.tool === "longPosition" || drawing.tool === "shortPosition") {
    for (let index = 1; index < Math.min(3, points.length); index++) {
      const side = Math.sign(drawing.points[index].price - drawing.points[0].price);
      if (side && points[index].price === points[0].price) {
        points[index].price = snap(points[0].price + side * tick);
      }
    }
  }
  return { ...drawing, points };
}

export function commitChartDrawingProjection(
  stored: readonly Drawing[],
  rendered: readonly Drawing[],
  next: readonly Drawing[],
  market: DrawingMarket,
): Drawing[] {
  const originalById = new Map(stored.map(drawing => [drawing.id, drawing]));
  const renderedById = new Map(rendered.map(drawing => [drawing.id, drawing]));
  const edited = next.map(drawing => {
    const before = renderedById.get(drawing.id);
    const original = originalById.get(drawing.id);
    if (before && original && drawing.points.length === before.points.length
        && drawing.points.every((point, index) =>
          point.time === before.points[index].time && point.price === before.points[index].price)) {
      return { ...drawing, points: original.points, priceBasis: original.priceBasis ?? drawingPriceBasis(original.points, market) };
    }
    return { ...drawing, priceBasis: drawingPriceBasis(drawing.points, market) };
  });
  // A different instrument can lack a comparable bar. Such drawings remain
  // in the document when the user edits or deletes a visible drawing.
  return [...edited, ...stored.filter(drawing => !renderedById.has(drawing.id))];
}
