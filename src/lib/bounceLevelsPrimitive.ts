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
  coreThicknessMin: number;
  coreThicknessMax: number;
  bodyRadiusMin: number;
  bodyRadiusMax: number;
  haloRadiusMin: number;
  haloRadiusMax: number;
  minimumOpacity: number;
  maximumOpacity: number;
  coreBrightness: number;
  innerHaloStrength: number;
  outerHaloStrength: number;
  glowStrength: number;
  glowRadius: number;
  kingContrastBoost: number;
  historicalFade: number;
  liveEdgeBrightness: number;
  textureEnabled: boolean;
  textureDensity: number;
  textureSize: number;
  textureStyle: "micro-orbs" | "micro-bars" | "pulse" | "fine-grain";
  visualMode: "advanced-heat-field" | "clean-heat" | "orb-field" | "microbar-energy" | "minimal" | "legacy-lines";
  temporalInterpolation: "continuous" | "stepped" | "discrete";
  strengthCurve: "linear" | "square-root" | "logarithmic";
  temporalSmoothing: number;
  buildExpansionSensitivity: number;
  weakeningContractionSensitivity: number;
  dumpFadeSpeed: number;
  reappearanceFadeIn: number;
  performanceQuality: "auto" | "ultra" | "high" | "medium" | "low";
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
export function transformBounceStrength(value: number, curve: BounceLevelsPrimitiveData["strengthCurve"]) {
  const normalized = clamp(value, 0, 1);
  if (curve === "square-root") return Math.sqrt(normalized);
  if (curve === "logarithmic") return Math.log1p(normalized * 9) / Math.log(10);
  return normalized;
}

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
  coreThickness: number;
  bodyRadius: number;
  haloRadius: number;
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
  radius: (point: PreparedNode) => number,
  interpolation: BounceLevelsPrimitiveData["temporalInterpolation"],
  terminal: boolean,
  buildExpansionSensitivity: number,
  weakeningContractionSensitivity: number,
  dumpFadeSpeed: number,
) {
  const first = points[0];
  const last = points[points.length - 1];
  const halfHeight = (point: PreparedNode) => Math.max(0.35, radius(point));
  const finalHalfHeight = halfHeight(last);
  const edgeExtension = 0;
  const edgeX = last.right;
  const edgeHalfHeight = terminal
    ? Math.max(0.25, finalHalfHeight * 0.06)
    : last.momentum === "building"
    ? finalHalfHeight * (1 + 0.14 * clamp(buildExpansionSensitivity, 0, 2))
    : last.momentum === "weakening"
      ? Math.max(0.5, finalHalfHeight * (1 - 0.78 * clamp(weakeningContractionSensitivity, 0, 1.2)))
      : last.momentum === "dumped"
        ? Math.max(0.35, finalHalfHeight * (1 - 0.92 * clamp(dumpFadeSpeed, 0, 1.08)))
        : finalHalfHeight;

  context.beginPath();
  context.moveTo(first.left, first.y - halfHeight(first));
  for (const point of points) {
    if (interpolation === "stepped") {
      context.lineTo(point.left, point.y - halfHeight(point));
      context.lineTo(point.right, point.y - halfHeight(point));
    } else context.lineTo(point.right, point.y - halfHeight(point));
  }
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
    if (interpolation === "stepped") {
      context.lineTo(point.right, point.y + halfHeight(point));
      context.lineTo(point.left, point.y + halfHeight(point));
    } else context.lineTo(point.left, point.y + halfHeight(point));
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

      const hits: RenderedHit[] = [];
      const prepared: PreparedNode[] = [];
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();

      const qualityTextureMultiplier = data.performanceQuality === "ultra" ? 1.5 : data.performanceQuality === "high" ? 1.25 : data.performanceQuality === "medium" ? 0.75 : data.performanceQuality === "low" ? 0.35 : 1;
      const historicalSpan = Math.max(1, slices.length - 1);
      const previousStrengthByStrike = new Map<string, number>();
      const confirmedBoundaryMs = Math.min(Date.now(), data.snapshot.snapshotTimeMs + Math.max(1_000, data.snapshot.refreshAfterMs));
      const confirmedBoundaryX = coordinateForTimestamp(chart, confirmedBoundaryMs, anchors, coordinateCache);
      slices.forEach((slice, sliceIndex) => {
        const previousX = slices[sliceIndex - 1]?.x;
        const nextX = slices[sliceIndex + 1]?.x;
        const nominalWidth = nextX !== undefined
          ? Math.abs(nextX - slice.x)
          : previousX !== undefined ? Math.abs(slice.x - previousX) : 8;
        const left = previousX === undefined ? slice.x - nominalWidth / 2 : (previousX + slice.x) / 2;
        const nominalRight = nextX === undefined ? slice.x + nominalWidth / 2 : (slice.x + nextX) / 2;
        const right = sliceIndex === slices.length - 1 && confirmedBoundaryX !== null
          ? Math.max(slice.x, Math.min(nominalRight, confirmedBoundaryX))
          : nominalRight;
        const width = Math.max(3, right - left + 0.75);
        for (const node of slice.nodes) {
          const coordinate = series.priceToCoordinate(node.mappedPrice);
          if (coordinate === null) continue;
          const y = Number(coordinate);
          if (y < -40 || y > mediaSize.height + 40) continue;
          const rawStrength = clamp(node.percentOfKingAbsolute * data.intensity, 0, 1);
          const previousStrength = previousStrengthByStrike.get(`${node.sourceStrike}:${Math.sign(node.signedExposure)}`);
          const smoothing = clamp(data.temporalSmoothing, 0, 1);
          const smoothedStrength = previousStrength === undefined ? rawStrength : previousStrength * smoothing + rawStrength * (1 - smoothing);
          previousStrengthByStrike.set(`${node.sourceStrike}:${Math.sign(node.signedExposure)}`, smoothedStrength);
          const visualStrength = transformBounceStrength(smoothedStrength, data.strengthCurve);
          const ageFraction = sliceIndex / historicalSpan;
          const historicalMultiplier = 1 - (1 - ageFraction) * clamp(data.historicalFade, 0, 0.9);
          const liveMultiplier = sliceIndex === slices.length - 1 ? data.liveEdgeBrightness : 1;
          const kingMultiplier = node.role === "KING" ? data.kingContrastBoost : 1;
          const brightness = clamp(visualStrength * historicalMultiplier * liveMultiplier * kingMultiplier, 0, 1);
          const opacity = clamp(data.opacity * (data.minimumOpacity + (data.maximumOpacity - data.minimumOpacity) * brightness), 0.01, 1);
          const color = node.signedExposure >= 0 ? data.positiveColor : data.negativeColor;

          prepared.push({
            sliceIndex,
            x: slice.x,
            left,
            right: left + width,
            y,
            coreThickness: data.coreThicknessMin + (data.coreThicknessMax - data.coreThicknessMin) * visualStrength,
            bodyRadius: data.bodyRadiusMin + (data.bodyRadiusMax - data.bodyRadiusMin) * visualStrength,
            haloRadius: data.haloRadiusMin + (data.haloRadiusMax - data.haloRadiusMin) * visualStrength,
            opacity,
            strength: visualStrength,
            color,
            momentum: node.momentumState === "rapid-unwinding" ? "dumped"
              : node.momentumState === "weakening" ? "weakening"
                : node.momentumState === "accumulating" || node.momentumState === "rapid-accumulation" ? "building" : "stable",
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
        for (const originalPoints of runs) {
          const points = data.temporalInterpolation === "discrete" ? originalPoints.map((point) => [point]) : [originalPoints];
          for (const episode of points) {
          const terminal = episode.at(-1)!.sliceIndex < slices.length - 1;
          const maximumStrength = Math.max(...episode.map((point) => point.strength));
          const maximumOpacity = Math.max(...episode.map((point) => point.opacity));
          const last = episode.at(-1)!;

          const episodeStartedAfterGap = episode[0].sliceIndex > 0;
          const fadeIn = episodeStartedAfterGap ? clamp(data.reappearanceFadeIn, 0.08, 2) : 1;
          const radiusWithFadeIn = (radius: (point: PreparedNode) => number) => (point: PreparedNode) => point === episode[0] ? radius(point) * fadeIn : radius(point);
          const halo = traceRibbon(context, episode, radiusWithFadeIn((point) => point.haloRadius), data.temporalInterpolation, terminal, data.buildExpansionSensitivity, data.weakeningContractionSensitivity, data.dumpFadeSpeed);
          context.save();
          context.shadowColor = rgba(last.color, maximumOpacity * 0.52);
          context.shadowBlur = data.glowRadius + data.glowStrength * maximumStrength;
          context.fillStyle = ribbonGradient(context, episode, halo.edgeX, data.outerHaloStrength);
          context.fill();
          context.restore();

          const body = traceRibbon(context, episode, radiusWithFadeIn((point) => point.bodyRadius), data.temporalInterpolation, terminal, data.buildExpansionSensitivity, data.weakeningContractionSensitivity, data.dumpFadeSpeed);
          context.fillStyle = ribbonGradient(context, episode, body.edgeX, data.innerHaloStrength);
          context.fill();

          traceRibbon(context, episode, radiusWithFadeIn((point) => point.coreThickness / 2), data.temporalInterpolation, terminal, data.buildExpansionSensitivity, data.weakeningContractionSensitivity, data.dumpFadeSpeed);
          context.fillStyle = ribbonGradient(context, episode, body.edgeX, data.coreBrightness);
          context.fill();

          context.beginPath();
          context.moveTo(episode[0].left, episode[0].y);
          for (const point of episode) context.lineTo(point.right, point.y);
          if (body.edgeX > last.right) context.lineTo(body.edgeX, body.edgeY);
          context.strokeStyle = rgba(last.color, clamp(maximumOpacity * (0.76 + maximumStrength * 0.34), 0.2, 1));
          context.lineWidth = 0.9 + maximumStrength * 1.8;
          context.shadowColor = rgba(last.color, maximumOpacity * 0.8);
          context.shadowBlur = 1.5 + data.glowStrength * 0.4;
          context.stroke();
          context.shadowBlur = 0;

          if (data.textureEnabled && data.visualMode !== "clean-heat" && data.visualMode !== "minimal" && data.visualMode !== "legacy-lines") {
            for (const point of episode) {
              const density = Math.max(1, Math.round((1 + point.strength * data.textureDensity) * qualityTextureMultiplier));
              const halfHeight = Math.max(0.75, point.bodyRadius * 0.84);
              for (let orbIndex = 0; orbIndex < density; orbIndex += 1) {
                const xSeed = deterministicUnit(`${point.node.id}:x:${orbIndex}`);
                const ySeed = deterministicUnit(`${point.node.id}:y:${orbIndex}`);
                const radiusSeed = deterministicUnit(`${point.node.id}:r:${orbIndex}`);
                const orbX = point.left + (point.right - point.left) * (0.1 + xSeed * 0.8);
                const orbY = point.y + (ySeed - 0.5) * halfHeight * 1.5;
                const radius = data.textureSize * (0.3 + radiusSeed * (0.45 + point.strength * 0.75));
                context.beginPath();
                if (data.textureStyle === "micro-bars") context.rect(orbX, orbY - radius, Math.max(0.5, radius * 0.65), radius * 2);
                else if (data.textureStyle === "fine-grain") context.rect(orbX, orbY, Math.max(0.35, radius * 0.4), Math.max(0.35, radius * 0.4));
                else context.arc(orbX, orbY, data.textureStyle === "pulse" ? radius * (0.7 + point.strength * 0.45) : radius, 0, Math.PI * 2);
                context.fillStyle = rgba(point.color, point.opacity * (0.2 + point.strength * 0.36));
                context.fill();
              }
            }
          }

          for (const point of episode) {
            const haloHeight = point.haloRadius * 2 + Math.max(2.5, data.glowStrength * 0.36);
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
