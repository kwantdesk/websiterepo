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
  microOrbTexture: boolean;
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

export type BounceNodeMomentum = "building" | "stable" | "weakening" | "dumped";

export function classifyBounceNodeMomentum(rateOfChangePercent: number): BounceNodeMomentum {
  if (rateOfChangePercent <= -45) return "dumped";
  if (rateOfChangePercent < -5) return "weakening";
  if (rateOfChangePercent > 5) return "building";
  return "stable";
}

type PreparedNode = {
  sliceIndex: number;
  x: number;
  left: number;
  right: number;
  y: number;
  height: number;
  opacity: number;
  strength: number;
  color: string;
  momentum: BounceNodeMomentum;
  node: BounceExposureNode;
};

const deterministicUnit = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
};

function traceRibbon(
  context: CanvasRenderingContext2D,
  points: PreparedNode[],
  heightScale: number,
  minimumHalfHeight: number,
) {
  const first = points[0];
  const last = points[points.length - 1];
  const halfHeight = (point: PreparedNode) => Math.max(minimumHalfHeight, point.height * heightScale * 0.5);
  const finalHalfHeight = halfHeight(last);
  const nominalWidth = Math.max(3, last.right - last.left);
  const edgeExtension = last.momentum === "building"
    ? clamp(nominalWidth * 0.5, 3, 18)
    : last.momentum === "weakening"
      ? clamp(nominalWidth * 0.35, 2, 12)
      : last.momentum === "dumped"
        ? clamp(nominalWidth * 0.24, 2, 8)
        : 0;
  const edgeX = last.right + edgeExtension;
  const edgeHalfHeight = last.momentum === "building"
    ? finalHalfHeight * 1.14
    : last.momentum === "weakening"
      ? Math.max(0.5, finalHalfHeight * 0.22)
      : last.momentum === "dumped"
        ? Math.max(0.35, finalHalfHeight * 0.08)
        : finalHalfHeight;

  context.beginPath();
  context.moveTo(first.left, first.y - halfHeight(first));
  for (const point of points) context.lineTo(point.right, point.y - halfHeight(point));
  if (edgeExtension > 0) {
    const controlX = last.right + edgeExtension * (last.momentum === "dumped" ? 0.18 : 0.55);
    context.quadraticCurveTo(controlX, last.y - finalHalfHeight, edgeX, last.y - edgeHalfHeight);
  }
  context.lineTo(edgeX, last.y + edgeHalfHeight);
  if (edgeExtension > 0) {
    const controlX = last.right + edgeExtension * (last.momentum === "dumped" ? 0.18 : 0.55);
    context.quadraticCurveTo(controlX, last.y + finalHalfHeight, last.right, last.y + finalHalfHeight);
  }
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    context.lineTo(point.left, point.y + halfHeight(point));
  }
  context.closePath();
  return { edgeX, edgeY: last.y, edgeHalfHeight };
}

function ribbonGradient(
  context: CanvasRenderingContext2D,
  points: PreparedNode[],
  edgeX: number,
  opacityScale: number,
) {
  const first = points[0];
  const last = points[points.length - 1];
  const gradient = context.createLinearGradient(first.left, 0, Math.max(first.left + 1, edgeX), 0);
  const span = Math.max(1, edgeX - first.left);
  const add = (offset: number, point: PreparedNode, multiplier = 1) => gradient.addColorStop(
    clamp(offset, 0, 1),
    rgba(point.color, point.opacity * opacityScale * multiplier),
  );
  add(0, first, 0.72);
  points.forEach((point) => add((point.x - first.left) / span, point));
  const edgeMultiplier = last.momentum === "building"
    ? 1
    : last.momentum === "stable"
      ? 0.9
      : last.momentum === "weakening"
        ? 0.38
        : 0.08;
  add(1, last, edgeMultiplier);
  return gradient;
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
      const prepared: PreparedNode[] = [];
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

          prepared.push({
            sliceIndex,
            x: slice.x,
            left,
            right: left + width,
            y,
            height,
            opacity,
            strength: visualStrength,
            color,
            momentum: classifyBounceNodeMomentum(node.rateOfChangePercent),
            node,
          });
        }
      });

      const grouped = new Map<string, PreparedNode[]>();
      for (const point of prepared) {
        const key = `${point.node.sourceStrike}:${point.node.signedExposure >= 0 ? "positive" : "negative"}`;
        const group = grouped.get(key) ?? [];
        group.push(point);
        grouped.set(key, group);
      }

      for (const groupedPoints of grouped.values()) {
        groupedPoints.sort((left, right) => left.sliceIndex - right.sliceIndex);
        const runs: PreparedNode[][] = [];
        for (const point of groupedPoints) {
          const current = runs.at(-1);
          if (!current || point.sliceIndex - current.at(-1)!.sliceIndex > 1) runs.push([point]);
          else current.push(point);
        }
        for (const points of runs) {
          const maximumStrength = Math.max(...points.map((point) => point.strength));
          const maximumOpacity = Math.max(...points.map((point) => point.opacity));
          const last = points.at(-1)!;

          const halo = traceRibbon(context, points, 1.72, 1.25 + data.glowStrength * 0.18);
          context.save();
          context.shadowColor = rgba(last.color, maximumOpacity * 0.52);
          context.shadowBlur = data.glowStrength + maximumStrength * 11;
          context.fillStyle = ribbonGradient(context, points, halo.edgeX, 0.2 + maximumStrength * 0.16);
          context.fill();
          context.restore();

          const body = traceRibbon(context, points, 1, 0.9);
          context.fillStyle = ribbonGradient(context, points, body.edgeX, 0.72 + maximumStrength * 0.24);
          context.fill();

          traceRibbon(context, points, 0.62, 0.7);
          context.fillStyle = ribbonGradient(context, points, body.edgeX, 0.36 + maximumStrength * 0.28);
          context.fill();

          context.beginPath();
          context.moveTo(points[0].left, points[0].y);
          for (const point of points) context.lineTo(point.right, point.y);
          if (body.edgeX > last.right) context.lineTo(body.edgeX, body.edgeY);
          context.strokeStyle = rgba(last.color, clamp(maximumOpacity * (0.76 + maximumStrength * 0.34), 0.2, 1));
          context.lineWidth = 0.9 + maximumStrength * 1.8;
          context.shadowColor = rgba(last.color, maximumOpacity * 0.8);
          context.shadowBlur = 1.5 + data.glowStrength * 0.4;
          context.stroke();
          context.shadowBlur = 0;

          if (data.microOrbTexture) {
            for (const point of points) {
              const density = Math.max(1, Math.round(1 + point.strength * 4));
              const halfHeight = Math.max(0.75, point.height * 0.42);
              for (let orbIndex = 0; orbIndex < density; orbIndex += 1) {
                const xSeed = deterministicUnit(`${point.node.id}:x:${orbIndex}`);
                const ySeed = deterministicUnit(`${point.node.id}:y:${orbIndex}`);
                const radiusSeed = deterministicUnit(`${point.node.id}:r:${orbIndex}`);
                const orbX = point.left + (point.right - point.left) * (0.1 + xSeed * 0.8);
                const orbY = point.y + (ySeed - 0.5) * halfHeight * 1.5;
                const radius = 0.35 + radiusSeed * (0.45 + point.strength * 0.75);
                context.beginPath();
                context.arc(orbX, orbY, radius, 0, Math.PI * 2);
                context.fillStyle = rgba(point.color, point.opacity * (0.28 + point.strength * 0.42));
                context.fill();
              }
            }
          }

          for (const point of points) {
            const haloHeight = point.height * 1.72 + Math.max(2.5, data.glowStrength * 0.36);
            hits.push({
              x: point.x,
              y: point.y,
              node: point.node,
              snapshot: data.snapshot,
              left: point.left,
              right: point === last ? body.edgeX : point.right,
              top: point.y - haloHeight / 2,
              bottom: point.y + haloHeight / 2,
            });
          }
        }
      }
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
