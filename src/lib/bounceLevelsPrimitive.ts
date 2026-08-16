import type {
  IChartApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import type { BounceExposureNode, BounceLevelsSnapshot } from "@/lib/bounceLevels";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];

export type BounceLevelsPrimitiveData = {
  snapshot: BounceLevelsSnapshot;
  timeAnchors: number[];
  opacity: number;
  intensity: number;
  minimumNodeHeight: number;
  maximumNodeHeight: number;
  minimumOpacity: number;
  glowStrength: number;
  positiveColor: string;
  negativeColor: string;
};

export type BounceLevelsHit = { x: number; y: number; node: BounceExposureNode; snapshot: BounceLevelsSnapshot };
type RenderedHit = BounceLevelsHit & { left: number; right: number; top: number; bottom: number };

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const rgb = (color: string) => {
  const value = color.replace("#", "");
  const full = value.length === 3 ? value.split("").map((part) => part + part).join("") : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) return { r: 255, g: 255, b: 255 };
  return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) };
};
const rgba = (color: string, opacity: number) => {
  const value = rgb(color);
  return `rgba(${value.r},${value.g},${value.b},${clamp(opacity, 0, 1)})`;
};
const percentile = (values: number[], fraction: number) => {
  if (!values.length) return 1;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))] || 1;
};

const coordinateForTimestamp = (
  chart: IChartApi,
  timestamp: number,
  anchors: number[],
  cache: Map<number, number | null>,
) => {
  const direct = chart.timeScale().timeToCoordinate(Math.floor(timestamp / 1_000) as Time);
  if (direct !== null) return Number(direct);
  if (anchors.length < 2) return null;
  const coordinateAt = (anchor: number) => {
    if (cache.has(anchor)) return cache.get(anchor) ?? null;
    const coordinate = chart.timeScale().timeToCoordinate(Math.floor(anchor / 1_000) as Time);
    const normalized = coordinate === null ? null : Number(coordinate);
    cache.set(anchor, normalized);
    return normalized;
  };
  let low = 0;
  let high = anchors.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (anchors[middle] < timestamp) low = middle + 1;
    else high = middle - 1;
  }
  const beforeIndex = high;
  const afterIndex = low;
  const interpolate = (leftIndex: number, rightIndex: number) => {
    const leftTime = anchors[leftIndex];
    const rightTime = anchors[rightIndex];
    const leftX = coordinateAt(leftTime);
    const rightX = coordinateAt(rightTime);
    if (leftX === null || rightX === null || rightTime <= leftTime) return null;
    return leftX + ((timestamp - leftTime) / (rightTime - leftTime)) * (rightX - leftX);
  };
  if (beforeIndex >= 0 && afterIndex < anchors.length) return interpolate(beforeIndex, afterIndex);
  const toleranceMs = 30 * 60_000;
  if (afterIndex >= anchors.length && timestamp - anchors.at(-1)! <= toleranceMs) {
    const leftX = coordinateAt(anchors[anchors.length - 2]);
    const rightX = coordinateAt(anchors[anchors.length - 1]);
    if (leftX === null || rightX === null) return null;
    const interval = anchors[anchors.length - 1] - anchors[anchors.length - 2];
    return rightX + ((timestamp - anchors[anchors.length - 1]) / Math.max(1, interval)) * (rightX - leftX);
  }
  if (beforeIndex < 0 && anchors[0] - timestamp <= toleranceMs) return interpolate(0, 1);
  return null;
};

function roundedRect(context: CanvasRenderingContext2D, left: number, top: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  context.beginPath();
  context.moveTo(left + safeRadius, top);
  context.arcTo(left + width, top, left + width, top + height, safeRadius);
  context.arcTo(left + width, top + height, left, top + height, safeRadius);
  context.arcTo(left, top + height, left, top, safeRadius);
  context.arcTo(left, top, left + width, top, safeRadius);
  context.closePath();
}

class BounceLevelsRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: BounceLevelsPrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const series = this.primitive.series();
    const chart = this.primitive.chart();
    const data = this.primitive.data();
    if (!series || !chart || !data?.snapshot.exposureField.length) { this.primitive.setHits([]); return; }
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      if (mediaSize.width < 80 || mediaSize.height < 80) { this.primitive.setHits([]); return; }
      const anchors = [...data.timeAnchors].sort((left, right) => left - right);
      const coordinateCache = new Map<number, number | null>();
      const slices = data.snapshot.exposureField
        .map((slice) => ({ ...slice, x: coordinateForTimestamp(chart, slice.timestamp, anchors, coordinateCache) }))
        .filter((slice): slice is typeof slice & { x: number } => slice.x !== null && slice.x > -80 && slice.x < mediaSize.width + 80)
        .sort((left, right) => left.timestamp - right.timestamp);
      if (!slices.length) { this.primitive.setHits([]); return; }

      const visibleNodes = slices.flatMap((slice) => slice.nodes.map((node) => ({ slice, node })));
      const scaleCeiling = percentile(visibleNodes.map(({ node }) => node.absoluteExposure).filter((value) => value > 0), 0.98);
      const hits: RenderedHit[] = [];
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();

      slices.forEach((slice, sliceIndex) => {
        const previousX = slices[sliceIndex - 1]?.x;
        const nextX = slices[sliceIndex + 1]?.x;
        const nominalWidth = nextX !== undefined
          ? Math.abs(nextX - slice.x)
          : previousX !== undefined ? Math.abs(slice.x - previousX) : 8;
        const left = previousX === undefined ? slice.x - nominalWidth / 2 : (previousX + slice.x) / 2;
        const right = nextX === undefined ? slice.x + nominalWidth / 2 : (slice.x + nextX) / 2;
        const width = Math.max(3, right - left + 0.75);
        for (const node of slice.nodes) {
          const coordinate = series.priceToCoordinate(node.mappedPrice);
          if (coordinate === null) continue;
          const y = Number(coordinate);
          if (y < -40 || y > mediaSize.height + 40) continue;
          const normalized = clamp((node.absoluteExposure * data.intensity) / Math.max(1, scaleCeiling), 0, 1);
          const visualStrength = Math.sqrt(normalized);
          const growth = clamp(node.rateOfChangePercent / 100, -0.55, 0.75);
          const persistenceBrightness = clamp(Math.sqrt(node.bucketShare * 5), 0.15, 1);
          const brightness = clamp(Math.max(visualStrength, persistenceBrightness * 0.72) * (1 + growth * 0.18), 0.08, 1);
          const height = data.minimumNodeHeight + (data.maximumNodeHeight - data.minimumNodeHeight) * visualStrength;
          const opacity = clamp(data.opacity * (data.minimumOpacity + (1 - data.minimumOpacity) * brightness), 0.02, 1);
          const color = node.signedExposure >= 0 ? data.positiveColor : data.negativeColor;

          const outerHeight = height + Math.max(2, data.glowStrength * 0.8);
          const outerGradient = context.createLinearGradient(left, 0, left + width, 0);
          outerGradient.addColorStop(0, rgba(color, opacity * 0.08));
          outerGradient.addColorStop(0.2, rgba(color, opacity * 0.24));
          outerGradient.addColorStop(0.8, rgba(color, opacity * 0.24));
          outerGradient.addColorStop(1, rgba(color, opacity * 0.08));
          roundedRect(context, left, y - outerHeight / 2, width, outerHeight, outerHeight / 2);
          context.fillStyle = outerGradient;
          context.fill();

          const coreGradient = context.createLinearGradient(left, 0, left + width, 0);
          coreGradient.addColorStop(0, rgba(color, opacity * 0.34));
          coreGradient.addColorStop(0.18, rgba(color, opacity));
          coreGradient.addColorStop(0.82, rgba(color, opacity));
          coreGradient.addColorStop(1, rgba(color, opacity * 0.34));
          roundedRect(context, left, y - height / 2, width, height, Math.min(4, height / 2));
          context.fillStyle = coreGradient;
          context.fill();

          if (visualStrength > 0.72) {
            roundedRect(context, left, y - Math.max(0.75, height * 0.12), width, Math.max(1.5, height * 0.24), 1);
            context.fillStyle = rgba(color, opacity);
            context.fill();
          }
          hits.push({ x: slice.x, y, node, snapshot: data.snapshot, left, right: left + width, top: y - outerHeight / 2, bottom: y + outerHeight / 2 });
        }
      });
      context.restore();
      this.primitive.setHits(hits);
    });
  }
}

class BounceLevelsView implements ISeriesPrimitivePaneView {
  private readonly paneRenderer: BounceLevelsRenderer;
  constructor(primitive: BounceLevelsPrimitive) { this.paneRenderer = new BounceLevelsRenderer(primitive); }
  zOrder() { return "bottom" as const; }
  renderer() { return this.paneRenderer; }
}

export class BounceLevelsPrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null;
  private chartApi: IChartApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderData: BounceLevelsPrimitiveData | null = null;
  private hits: RenderedHit[] = [];
  private readonly paneView = new BounceLevelsView(this);
  attached(param: SeriesAttachedParameter<Time, "Candlestick">) { this.candleSeries = param.series; this.chartApi = param.chart as IChartApi; this.requestRedraw = param.requestUpdate; }
  detached() { this.candleSeries = null; this.chartApi = null; this.requestRedraw = null; this.hits = []; }
  update(data: BounceLevelsPrimitiveData | null) { this.renderData = data; this.requestRedraw?.(); }
  series() { return this.candleSeries; }
  chart() { return this.chartApi; }
  data() { return this.renderData; }
  setHits(hits: RenderedHit[]) { this.hits = hits; }
  queryHit(x: number, y: number): BounceLevelsHit | null {
    let selected: RenderedHit | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const hit of this.hits) {
      if (x < hit.left - 3 || x > hit.right + 3 || y < hit.top - 3 || y > hit.bottom + 3) continue;
      const distance = Math.abs(hit.x - x) + Math.abs(hit.y - y) * 1.5;
      if (distance < best) { best = distance; selected = hit; }
    }
    return selected ? { x: selected.x, y: selected.y, node: selected.node, snapshot: selected.snapshot } : null;
  }
  paneViews() { return [this.paneView]; }
}
