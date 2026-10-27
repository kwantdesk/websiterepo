import type { PrecisionObject, PrecisionChartAdapter, PrecisionScreenPoint } from "./types";

export function objectScreenAnchors(object: PrecisionObject, adapter: PrecisionChartAdapter): PrecisionScreenPoint[] {
  return object.anchors.map((anchor) => ({ x: adapter.timeToX(anchor.time, anchor.logicalIndex) ?? NaN, y: adapter.priceToY(anchor.price) ?? NaN })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function tradeCalculatorResizeHandles(anchors: PrecisionScreenPoint[]): PrecisionScreenPoint[] {
  if (anchors.length < 3) return [];
  const left = Math.min(...anchors.map((anchor) => anchor.x));
  const right = Math.max(...anchors.map((anchor) => anchor.x), left + 80);
  const top = Math.min(...anchors.map((anchor) => anchor.y));
  const bottom = Math.max(...anchors.map((anchor) => anchor.y));
  return [
    { x: left, y: top },
    { x: (left + right) / 2, y: top },
    { x: right, y: top },
    { x: right, y: (top + bottom) / 2 },
    { x: right, y: bottom },
    { x: (left + right) / 2, y: bottom },
    { x: left, y: bottom },
    { x: left, y: (top + bottom) / 2 },
  ];
}


export function shapeHandles(a: PrecisionScreenPoint, b: PrecisionScreenPoint): PrecisionScreenPoint[] {
  const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x), top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y);
  return [{ x: left, y: top }, { x: (left + right) / 2, y: top }, { x: right, y: top }, { x: right, y: (top + bottom) / 2 }, { x: right, y: bottom }, { x: (left + right) / 2, y: bottom }, { x: left, y: bottom }, { x: left, y: (top + bottom) / 2 }];
}
