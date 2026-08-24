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
  showHeader: boolean;
  showLabels: boolean;
  showValues: boolean;
  showTouchCount: boolean;
  showAirPockets: boolean;
  showRolls: boolean;
  neutralColor: string;
  roleColors: Record<string, string>;
  positiveColor: string;
  negativeColor: string;
  /** Continue every level line from its last observation to the right edge. */
  extendRight: boolean;
};

export type BounceLevelsHit = { x: number; y: number; node: BounceExposureNode; snapshot: BounceLevelsSnapshot };
type RenderedHit = BounceLevelsHit & { left: number; right: number; top: number; bottom: number };
type BounceRenderViewport = {
  width: number;
  height: number;
  firstX: number | null;
  lastX: number | null;
  firstY: number | null;
  lastY: number | null;
};

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
export const BOUNCE_LEVELS_HEAT_THICKNESS_SCALE = 0.75;

export function calculateBounceNodeHeight(minimum: number, maximum: number, visualStrength: number) {
  return (minimum + (maximum - minimum) * clamp(visualStrength, 0, 1)) * BOUNCE_LEVELS_HEAT_THICKNESS_SCALE;
}

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

export type BounceNodeVisualStructure = {
  strength: number;
  brightness: number;
  fade: number;
  momentum: BounceNodeMomentum;
};

/**
 * Ranks a node against the strongest node on its own side at this exact
 * snapshot. The positive and negative leaders each receive full authority;
 * the rest fall away quickly instead of all becoming similarly thick bands.
 */
export function calculateSameSideLeaderStrength({
  absoluteExposure,
  sameSideLeaderExposure,
  providerStrength,
}: {
  absoluteExposure: number;
  sameSideLeaderExposure: number;
  providerStrength: number;
}) {
  const ratio = sameSideLeaderExposure > 0
    ? clamp(Math.abs(absoluteExposure) / sameSideLeaderExposure, 0, 1)
    : 0;
  if (ratio >= 0.999999) return 1;
  // The fourth-power curve deliberately separates a genuine leader from a
  // cluster of merely large nodes while retaining a faint structural trace.
  const competitiveStrength = Math.pow(ratio, 4) * 0.78;
  return clamp(0.025 + competitiveStrength + clamp(providerStrength, 0, 1) * 0.08, 0.025, 0.62);
}

const compactExposure = (value: number) => {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : value > 0 ? "+" : "";
  if (absolute >= 1_000_000_000) return `${sign}${(absolute / 1_000_000_000).toFixed(1)}B`;
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${sign}${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}${absolute.toFixed(0)}`;
};

export function calculateBounceNodeVisualStructure({
  visualStrength,
  bucketShare,
  rateOfChangePercent,
  retirementCount,
  intensity,
}: {
  visualStrength: number;
  bucketShare: number;
  rateOfChangePercent: number;
  retirementCount: number;
  intensity: number;
}): BounceNodeVisualStructure {
  const normalizedMagnitude = clamp(visualStrength * intensity, 0, 1);
  // Do not inflate weak nodes with a square-root curve. Strong nodes should
  // dominate while low-exposure nodes become genuinely thin and faint.
  const magnitude = Math.pow(normalizedMagnitude, 1.08);
  const shareSupport = Math.pow(clamp(bucketShare * 8, 0, 1), 0.7);
  const structuralStrength = clamp(magnitude * 0.86 + shareSupport * 0.14, 0, 1);
  const momentum = classifyBounceNodeMomentum(rateOfChangePercent);
  const momentumScale = momentum === "building"
    ? 1 + Math.min(0.34, Math.max(0, rateOfChangePercent) / 240)
    : momentum === "weakening"
      ? Math.max(0.3, 1 - Math.abs(rateOfChangePercent) / 155)
      : momentum === "dumped"
        ? 0.16
        : 1;
  // Each confirmed weak observation halves the remaining authority. That
  // leaves a readable decay trail without allowing stale exposure to look as
  // important as the strike where the book is now rebuilding.
  const retirementFade = clamp(Math.pow(0.5, Math.max(0, retirementCount)), 0.06, 1);
  const fade = clamp(momentumScale * retirementFade, 0.04, 1.34);
  return {
    strength: clamp(structuralStrength * fade, 0, 1),
    brightness: clamp((0.08 + Math.pow(structuralStrength, 0.78) * 0.92) * Math.min(1, fade), 0.025, 1),
    fade,
    momentum,
  };
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
  brightness: number;
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

  const entryExtension = first.sliceIndex > 0 ? clamp(Math.max(3, first.right - first.left) * 0.38, 2, 12) : 0;
  const entryX = first.left - entryExtension;
  const entryHalfHeight = entryExtension > 0 ? Math.max(0.25, halfHeight(first) * 0.08) : halfHeight(first);

  context.beginPath();
  context.moveTo(entryX, first.y - entryHalfHeight);
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
  if (entryExtension > 0) context.lineTo(entryX, first.y + entryHalfHeight);
  context.closePath();
  return { edgeX, edgeY: last.y, edgeHalfHeight };
}

function ribbonGradient(
  context: CanvasRenderingContext2D,
  points: PreparedNode[],
  edgeX: number,
  opacityScale: number,
  maximumStops = 48,
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
  // Canvas gradients become extremely expensive with hundreds of colour
  // stops. Preserve the temporal shape while bounding the GPU/CPU work.
  const stopStride = Math.max(1, Math.ceil(points.length / maximumStops));
  for (let index = 0; index < points.length; index += stopStride) {
    const point = points[index];
    add((point.x - first.left) / span, point);
  }
  if (points.length > 1) add((last.x - first.left) / span, last);
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
    target.useMediaCoordinateSpace(({ context: targetContext, mediaSize }) => {
      if (mediaSize.width < 80 || mediaSize.height < 80) { this.primitive.setHits([]); return; }
      const anchors = data.timeAnchors;
      const firstAnchor = anchors[0] ?? 0;
      const lastAnchor = anchors.at(-1) ?? firstAnchor;
      const firstX = firstAnchor ? chart.timeScale().timeToCoordinate(Math.floor(firstAnchor / 1_000) as Time) : null;
      const lastX = lastAnchor ? chart.timeScale().timeToCoordinate(Math.floor(lastAnchor / 1_000) as Time) : null;
      const firstLevelPrice = data.snapshot.levels[0]?.mappedPrice ?? data.snapshot.exposureField[0]?.nodes[0]?.mappedPrice ?? 0;
      const lastLevelPrice = data.snapshot.levels.at(-1)?.mappedPrice ?? data.snapshot.exposureField.at(-1)?.nodes.at(-1)?.mappedPrice ?? firstLevelPrice;
      const firstY = firstLevelPrice ? series.priceToCoordinate(firstLevelPrice) : null;
      const lastY = lastLevelPrice ? series.priceToCoordinate(lastLevelPrice) : null;
      const viewport: BounceRenderViewport = {
        width: mediaSize.width,
        height: mediaSize.height,
        firstX: firstX === null ? null : Number(firstX),
        lastX: lastX === null ? null : Number(lastX),
        firstY: firstY === null ? null : Number(firstY),
        lastY: lastY === null ? null : Number(lastY),
      };
      const layerKey = this.primitive.renderLayerKey(viewport);
      const cachedLayer = this.primitive.cachedLayer(layerKey);
      if (cachedLayer) {
        targetContext.drawImage(
          cachedLayer,
          0,
          0,
          cachedLayer.width,
          cachedLayer.height,
          0,
          0,
          mediaSize.width,
          mediaSize.height,
        );
        return;
      }
      const transformedLayer = this.primitive.transformedLayer(viewport);
      if (transformedLayer) {
        targetContext.save();
        targetContext.beginPath();
        targetContext.rect(0, 0, mediaSize.width, mediaSize.height);
        targetContext.clip();
        targetContext.translate(transformedLayer.translateX, transformedLayer.translateY);
        targetContext.scale(transformedLayer.scaleX, transformedLayer.scaleY);
        targetContext.drawImage(
          transformedLayer.canvas,
          0,
          0,
          transformedLayer.canvas.width,
          transformedLayer.canvas.height,
          0,
          0,
          transformedLayer.sourceViewport.width,
          transformedLayer.sourceViewport.height,
        );
        targetContext.restore();
        // Hit regions belong to the precise coordinate pass. Suppress stale
        // tooltips during a gesture, then restore them with the settled draw.
        this.primitive.setHits([]);
        this.primitive.scheduleRefinement(layerKey);
        return;
      }
      const layer = this.primitive.createLayer(mediaSize.width, mediaSize.height);
      const context = layer.context;
      const activePanelCount = this.primitive.activePanelCount();
      const coordinateCache = new Map<number, number | null>();
      let slices = data.snapshot.exposureField
        .map((slice) => ({ ...slice, x: coordinateForTimestamp(chart, slice.timestamp, anchors, coordinateCache) }))
        .filter((slice): slice is typeof slice & { x: number } => slice.x !== null && slice.x > -80 && slice.x < mediaSize.width + 80)
        .sort((left, right) => left.timestamp - right.timestamp);
      if (!slices.length) { this.primitive.setHits([]); return; }

      // Level-of-detail is based on available pixels, not an arbitrary history
      // cutoff. A compact four-panel workspace cannot display 1,440 distinct
      // temporal slices, so sampling them all only burns the interaction thread
      // without adding visible information.
      const maximumVisibleSlices = activePanelCount >= 4
        ? Math.max(72, Math.min(180, Math.floor(mediaSize.width / 5)))
        : activePanelCount >= 2
          ? Math.max(84, Math.min(240, Math.floor(mediaSize.width / 4)))
          : Math.max(96, Math.min(360, Math.floor(mediaSize.width / 3)));
      if (slices.length > maximumVisibleSlices) {
        const source = slices;
        const lastIndex = source.length - 1;
        const selected = new Set<number>([0, lastIndex]);
        for (let index = 1; index < maximumVisibleSlices - 1; index += 1) {
          selected.add(Math.round((index / (maximumVisibleSlices - 1)) * lastIndex));
        }
        slices = [...selected].sort((left, right) => left - right).map((index) => source[index]);
      }

      const hits: RenderedHit[] = [];
      const prepared: PreparedNode[] = [];
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();

      if (data.showAirPockets) {
        for (const pocket of data.snapshot.airPockets) {
          const upper = series.priceToCoordinate(pocket.upperPrice);
          const lower = series.priceToCoordinate(pocket.lowerPrice);
          if (upper === null || lower === null) continue;
          const top = Math.min(Number(upper), Number(lower));
          const height = Math.max(1, Math.abs(Number(lower) - Number(upper)));
          context.fillStyle = rgba(data.neutralColor, clamp(0.025 + (1 - pocket.magnitudeRatio) * 0.055, 0.025, 0.08));
          context.fillRect(0, top, mediaSize.width, height);
        }
      }

      slices.forEach((slice, sliceIndex) => {
        const previousX = slices[sliceIndex - 1]?.x;
        const nextX = slices[sliceIndex + 1]?.x;
        const nominalWidth = nextX !== undefined
          ? Math.abs(nextX - slice.x)
          : previousX !== undefined ? Math.abs(slice.x - previousX) : 8;
        const left = previousX === undefined ? slice.x - nominalWidth / 2 : (previousX + slice.x) / 2;
        const right = nextX === undefined ? slice.x + nominalWidth / 2 : (slice.x + nextX) / 2;
        const width = Math.max(3, right - left + 0.75);
        let positiveLeaderExposure = 0;
        let negativeLeaderExposure = 0;
        for (const node of slice.nodes) {
          if (node.signedExposure >= 0) positiveLeaderExposure = Math.max(positiveLeaderExposure, Math.abs(node.signedExposure));
          else negativeLeaderExposure = Math.max(negativeLeaderExposure, Math.abs(node.signedExposure));
        }
        for (const node of slice.nodes) {
          const coordinate = series.priceToCoordinate(node.mappedPrice);
          if (coordinate === null) continue;
          const y = Number(coordinate);
          if (y < -40 || y > mediaSize.height + 40) continue;
          const sameSideLeaderExposure = node.signedExposure >= 0 ? positiveLeaderExposure : negativeLeaderExposure;
          const leaderRelativeStrength = calculateSameSideLeaderStrength({
            absoluteExposure: Math.abs(node.signedExposure),
            sameSideLeaderExposure,
            providerStrength: node.visualStrength,
          });
          // Every historical slice is ranked independently, so leadership
          // changes begin painting at the actual switch timestamp rather than
          // retroactively widening an entire old ribbon.
          const structure = calculateBounceNodeVisualStructure({
            visualStrength: leaderRelativeStrength,
            bucketShare: node.bucketShare,
            rateOfChangePercent: node.rateOfChangePercent,
            retirementCount: node.retirementCount,
            intensity: data.intensity,
          });
          const height = calculateBounceNodeHeight(data.minimumNodeHeight, data.maximumNodeHeight, structure.strength);
          const opacity = clamp(data.opacity * (data.minimumOpacity + (1 - data.minimumOpacity) * structure.brightness), 0.012, 1);
          const color = data.roleColors[String(node.sourceStrike)]
            || (node.signedExposure >= 0 ? data.positiveColor : data.negativeColor);

          prepared.push({
            sliceIndex,
            x: slice.x,
            left,
            right: left + width,
            y,
            height,
            opacity,
            strength: structure.strength,
            brightness: structure.brightness,
            color,
            momentum: structure.momentum,
            node,
          });
        }
      });

      const grouped = new Map<string, PreparedNode[]>();
      for (const point of prepared) {
        // A strike owns one immutable temporal geometry even if its sign changes.
        const key = point.node.nodeKey;
        const group = grouped.get(key) ?? [];
        group.push(point);
        grouped.set(key, group);
      }

      for (const groupedPoints of grouped.values()) {
        groupedPoints.sort((left, right) => left.sliceIndex - right.sliceIndex);
        const runs: PreparedNode[][] = [];
        for (const point of groupedPoints) {
          const current = runs.at(-1);
          if (
            !current
            || point.sliceIndex - current.at(-1)!.sliceIndex > 1
            || Math.sign(point.node.signedExposure) !== Math.sign(current.at(-1)!.node.signedExposure)
          ) runs.push([point]);
          else current.push(point);
        }
        for (const points of runs) {
          const lastPoint = points.at(-1)!;
          // If the node vanishes before the latest exposure frame, render a
          // real collapse rather than leaving a blunt, permanent heat band.
          if (lastPoint.sliceIndex < slices.length - 1) lastPoint.momentum = "dumped";
          let maximumStrength = 0;
          let maximumOpacity = 0;
          for (const point of points) {
            maximumStrength = Math.max(maximumStrength, point.strength);
            maximumOpacity = Math.max(maximumOpacity, point.opacity);
          }
          const last = points.at(-1)!;

          const halo = traceRibbon(
            context,
            points,
            1.72,
            (1.25 + data.glowStrength * 0.18) * BOUNCE_LEVELS_HEAT_THICKNESS_SCALE,
          );
          const detailedRendering = activePanelCount <= 2 && prepared.length <= 2_200;
          const maximumGradientStops = activePanelCount >= 4 ? 20 : activePanelCount >= 2 ? 32 : 48;
          context.save();
          if (detailedRendering) {
            context.shadowColor = rgba(last.color, maximumOpacity * 0.52);
            context.shadowBlur = (data.glowStrength + maximumStrength * 11) * BOUNCE_LEVELS_HEAT_THICKNESS_SCALE;
          }
          context.fillStyle = ribbonGradient(context, points, halo.edgeX, 0.2 + maximumStrength * 0.16, maximumGradientStops);
          context.fill();
          context.restore();

          const body = traceRibbon(context, points, 1, 0.9 * BOUNCE_LEVELS_HEAT_THICKNESS_SCALE);
          context.fillStyle = ribbonGradient(context, points, body.edgeX, 0.72 + maximumStrength * 0.24, maximumGradientStops);
          context.fill();

          traceRibbon(context, points, 0.62, 0.7 * BOUNCE_LEVELS_HEAT_THICKNESS_SCALE);
          context.fillStyle = ribbonGradient(context, points, body.edgeX, 0.36 + maximumStrength * 0.28, maximumGradientStops);
          context.fill();

          // Local cells are high-detail texture. At compact zoom the continuous
          // core/body/halo remains authoritative and avoids thousands of
          // invisible ellipses on every live repaint.
          if (detailedRendering) for (const point of points) {
            const sampleWidth = Math.max(2, point.right - point.left);
            const momentumWidth = point.momentum === "building"
              ? 1.18
              : point.momentum === "weakening"
                ? 0.72
                : point.momentum === "dumped"
                  ? 0.42
                  : 1;
            const radiusX = Math.max(0.8, sampleWidth * (0.2 + point.strength * 0.34) * momentumWidth);
            const radiusY = Math.max(0.3, point.height * (0.2 + point.brightness * 0.3));
            context.beginPath();
            context.ellipse(point.x, point.y, radiusX * 1.5, radiusY * 1.65, 0, 0, Math.PI * 2);
            context.fillStyle = rgba(point.color, point.opacity * (0.1 + point.brightness * 0.18));
            context.fill();
            context.beginPath();
            context.ellipse(point.x, point.y, radiusX, radiusY, 0, 0, Math.PI * 2);
            context.fillStyle = rgba(point.color, point.opacity * (0.42 + point.brightness * 0.44));
            context.fill();
            context.beginPath();
            context.ellipse(
              point.x,
              point.y,
              Math.max(0.35, radiusX * 0.48),
              Math.max(0.22, radiusY * 0.34),
              0,
              0,
              Math.PI * 2,
            );
            context.fillStyle = rgba(point.color, point.opacity * (0.58 + point.brightness * 0.38));
            context.fill();
          }

          context.beginPath();
          context.moveTo(points[0].left, points[0].y);
          for (const point of points) context.lineTo(point.right, point.y);
          if (body.edgeX > last.right) context.lineTo(body.edgeX, body.edgeY);
          context.strokeStyle = rgba(last.color, clamp(maximumOpacity * (0.76 + maximumStrength * 0.34), 0.2, 1));
          context.lineWidth = 0.9 + maximumStrength * 1.8;
          context.shadowColor = rgba(last.color, maximumOpacity * 0.8);
          context.shadowBlur = (1.5 + data.glowStrength * 0.4) * BOUNCE_LEVELS_HEAT_THICKNESS_SCALE;
          context.stroke();
          context.shadowBlur = 0;

          if (data.extendRight && body.edgeX < mediaSize.width) {
            // Project the level's final price to the right edge as a quiet
            // dashed continuation — the ribbon stays anchored to when the
            // level actually existed; the projection is presentation only.
            context.beginPath();
            context.moveTo(body.edgeX, body.edgeY);
            context.lineTo(mediaSize.width, body.edgeY);
            context.setLineDash([6, 5]);
            context.strokeStyle = rgba(last.color, clamp(maximumOpacity * 0.7, 0.18, 0.9));
            context.lineWidth = Math.max(1, 0.9 + maximumStrength * 1.2);
            context.stroke();
            context.setLineDash([]);
          }

          if (data.microOrbTexture && activePanelCount === 1 && prepared.length <= 1_600) {
            for (const point of points) {
              const density = Math.max(1, Math.round(1 + point.strength * 4));
              const halfHeight = Math.max(0.75 * BOUNCE_LEVELS_HEAT_THICKNESS_SCALE, point.height * 0.42);
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

          const hitStride = Math.max(1, Math.ceil(points.length / 120));
          for (let hitIndex = 0; hitIndex < points.length; hitIndex += hitStride) {
            const point = points[hitIndex];
            const haloHeight = point.height * 1.72
              + Math.max(2.5, data.glowStrength * 0.36) * BOUNCE_LEVELS_HEAT_THICKNESS_SCALE;
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
          if ((points.length - 1) % hitStride !== 0) {
            const point = points.at(-1)!;
            const haloHeight = point.height * 1.72
              + Math.max(2.5, data.glowStrength * 0.36) * BOUNCE_LEVELS_HEAT_THICKNESS_SCALE;
            hits.push({
              x: point.x,
              y: point.y,
              node: point.node,
              snapshot: data.snapshot,
              left: point.left,
              right: body.edgeX,
              top: point.y - haloHeight / 2,
              bottom: point.y + haloHeight / 2,
            });
          }
        }
      }

      if (data.showRolls) {
        context.save();
        context.setLineDash([4, 4]);
        for (const roll of data.snapshot.rolls) {
          const x = coordinateForTimestamp(chart, roll.timestamp, anchors, coordinateCache);
          if (x === null || x < 0 || x > mediaSize.width) continue;
          const fromPrice = data.snapshot.mapping.alpha + data.snapshot.mapping.beta * roll.fromStrike;
          const toPrice = data.snapshot.mapping.alpha + data.snapshot.mapping.beta * roll.toStrike;
          const fromY = series.priceToCoordinate(fromPrice);
          const toY = series.priceToCoordinate(toPrice);
          if (fromY === null || toY === null) continue;
          const color = roll.direction === "UP" ? data.positiveColor : data.negativeColor;
          context.beginPath();
          context.moveTo(x, Number(fromY));
          context.lineTo(x, Number(toY));
          context.strokeStyle = rgba(color, clamp(0.25 + roll.score / 180, 0.25, 0.72));
          context.lineWidth = 1;
          context.stroke();
          context.beginPath();
          context.moveTo(x - 3, Number(toY) + (roll.direction === "UP" ? 4 : -4));
          context.lineTo(x, Number(toY));
          context.lineTo(x + 3, Number(toY) + (roll.direction === "UP" ? 4 : -4));
          context.stroke();
        }
        context.restore();
      }

      const latestByStrike = new Map<number, PreparedNode>();
      for (const point of prepared) {
        const current = latestByStrike.get(point.node.sourceStrike);
        if (!current || point.node.timestamp > current.node.timestamp) latestByStrike.set(point.node.sourceStrike, point);
      }
      const levelByStrike = new Map(data.snapshot.levels.map((level) => [level.sourceStrike, level]));
      for (const point of latestByStrike.values()) {
        const level = levelByStrike.get(point.node.sourceStrike);
        if (!data.showLabels && !data.showValues) continue;
        const parts = [
          data.showLabels ? `${level?.role ?? "NODE"} ${point.node.mappedPrice.toFixed(2)}` : "",
          data.showValues ? compactExposure(point.node.signedExposure) : "",
          data.showTouchCount && level ? `${level.touches}T` : "",
        ].filter(Boolean);
        if (!parts.length) continue;
        const label = parts.join(" · ");
        context.font = "10px JetBrains Mono, monospace";
        const width = context.measureText(label).width + 8;
        const x = clamp(point.right + 10, 4, mediaSize.width - width - 4);
        context.fillStyle = rgba("#000000", 0.78);
        context.fillRect(x, point.y - 8, width, 16);
        context.fillStyle = rgba(point.color, 0.96);
        context.fillText(label, x + 4, point.y + 3.5);
      }

      if (data.showHeader) {
        const title = `${data.snapshot.displayInstrument} ${data.snapshot.greekMode} BOUNCE · ${data.snapshot.levels.length} ACTIVE`;
        context.font = "10px JetBrains Mono, monospace";
        const width = context.measureText(title).width + 12;
        context.fillStyle = rgba("#000000", 0.78);
        context.fillRect(8, 8, width, 20);
        context.fillStyle = rgba(data.positiveColor, 0.96);
        context.fillText(title, 14, 21.5);
      }
      context.restore();
      this.primitive.setHits(hits);
      this.primitive.storeLayer(layerKey, layer.canvas, viewport);
      targetContext.drawImage(
        layer.canvas,
        0,
        0,
        layer.canvas.width,
        layer.canvas.height,
        0,
        0,
        mediaSize.width,
        mediaSize.height,
      );
    });
  }
}

class BounceLevelsView implements ISeriesPrimitivePaneView {
  private readonly paneRenderer: BounceLevelsRenderer;
  constructor(primitive: BounceLevelsPrimitive) { this.paneRenderer = new BounceLevelsRenderer(primitive); }
  zOrder() { return "bottom" as const; }
  renderer() { return this.paneRenderer; }
}

const activeBouncePrimitives = new Set<BounceLevelsPrimitive>();

export class BounceLevelsPrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null;
  private chartApi: IChartApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderData: BounceLevelsPrimitiveData | null = null;
  private hits: RenderedHit[] = [];
  private renderRevision = 0;
  private layerKey = "";
  private layerCanvas: HTMLCanvasElement | null = null;
  private layerViewport: BounceRenderViewport | null = null;
  private layerRevision = -1;
  private layerPanelCount = 0;
  private refinementTimer: ReturnType<typeof setTimeout> | null = null;
  private refinementKey = "";
  private readonly paneView = new BounceLevelsView(this);
  attached(param: SeriesAttachedParameter<Time, "Candlestick">) { this.candleSeries = param.series; this.chartApi = param.chart as IChartApi; this.requestRedraw = param.requestUpdate; }
  private releaseLayer() {
    // Dropping the JS reference alone leaves the high-DPI backing store in
    // Chrome's GPU process until a later GC. Explicitly collapse it first so a
    // closed/replaced pane releases its graphics memory immediately.
    if (this.layerCanvas) {
      this.layerCanvas.width = 1;
      this.layerCanvas.height = 1;
    }
    this.layerCanvas = null;
    this.layerViewport = null;
    this.layerKey = "";
  }
  detached() {
    activeBouncePrimitives.delete(this);
    if (this.refinementTimer !== null) clearTimeout(this.refinementTimer);
    this.refinementTimer = null;
    this.refinementKey = "";
    this.candleSeries = null;
    this.chartApi = null;
    this.requestRedraw = null;
    this.hits = [];
    this.releaseLayer();
  }
  update(data: BounceLevelsPrimitiveData | null) {
    if (this.renderData !== data) {
      if (this.refinementTimer !== null) clearTimeout(this.refinementTimer);
      this.refinementTimer = null;
      this.refinementKey = "";
      this.renderRevision += 1;
      this.layerViewport = null;
      this.layerKey = "";
    }
    this.renderData = data;
    if (data) activeBouncePrimitives.add(this);
    else {
      activeBouncePrimitives.delete(this);
      this.releaseLayer();
    }
    this.requestRedraw?.();
  }
  activePanelCount() { return Math.max(1, activeBouncePrimitives.size); }
  renderLayerKey(viewport: BounceRenderViewport) {
    const rounded = (value: number | null) => value === null ? "x" : Math.round(value * 4) / 4;
    return [
      this.renderRevision,
      this.activePanelCount(),
      Math.round(viewport.width),
      Math.round(viewport.height),
      rounded(viewport.firstX),
      rounded(viewport.lastX),
      rounded(viewport.firstY),
      rounded(viewport.lastY),
    ].join(":");
  }
  cachedLayer(key: string) { return key === this.layerKey ? this.layerCanvas : null; }
  transformedLayer(viewport: BounceRenderViewport) {
    if (
      !this.layerCanvas
      || !this.layerViewport
      || this.layerRevision !== this.renderRevision
      || this.layerPanelCount !== this.activePanelCount()
    ) return null;
    const axisTransform = (sourceStart: number | null, sourceEnd: number | null, targetStart: number | null, targetEnd: number | null) => {
      if (sourceStart === null || targetStart === null) return { scale: 1, translate: 0 };
      const sourceSpan = sourceEnd === null ? 0 : sourceEnd - sourceStart;
      const targetSpan = targetEnd === null ? 0 : targetEnd - targetStart;
      const scale = Math.abs(sourceSpan) > 0.001 && Number.isFinite(targetSpan)
        ? targetSpan / sourceSpan
        : 1;
      if (!Number.isFinite(scale) || scale < 0.04 || scale > 25) return null;
      return { scale, translate: targetStart - sourceStart * scale };
    };
    const horizontal = axisTransform(this.layerViewport.firstX, this.layerViewport.lastX, viewport.firstX, viewport.lastX);
    const vertical = axisTransform(this.layerViewport.firstY, this.layerViewport.lastY, viewport.firstY, viewport.lastY);
    if (!horizontal || !vertical) return null;
    return {
      canvas: this.layerCanvas,
      sourceViewport: this.layerViewport,
      scaleX: horizontal.scale,
      scaleY: vertical.scale,
      translateX: horizontal.translate,
      translateY: vertical.translate,
    };
  }
  scheduleRefinement(key: string) {
    // Repeated chart paints at the same viewport (for example live ticks) must
    // not postpone the settled render forever. Only restart when the gesture
    // actually moves to a different viewport.
    if (this.refinementTimer !== null && this.refinementKey === key) return;
    if (this.refinementTimer !== null) clearTimeout(this.refinementTimer);
    this.refinementKey = key;
    this.refinementTimer = setTimeout(() => {
      this.refinementTimer = null;
      this.refinementKey = "";
      this.layerViewport = null;
      this.layerKey = "";
      this.requestRedraw?.();
    }, 120);
  }
  createLayer(width: number, height: number) {
    const devicePixelRatio = typeof window === "undefined" ? 1 : Math.max(1, window.devicePixelRatio || 1);
    const pixelBudgetRatio = Math.sqrt(4_000_000 / Math.max(1, width * height));
    const pixelRatio = Math.max(1, Math.min(2, devicePixelRatio, pixelBudgetRatio));
    // Live exposure frames invalidate this layer several times per second.
    // Reuse its backing surface instead of allocating a new multi-megabyte GPU
    // canvas for every frame (the live-session Aw, Snap/OOM root cause).
    const canvas = this.layerCanvas ?? document.createElement("canvas");
    const nextWidth = Math.max(1, Math.ceil(width * pixelRatio));
    const nextHeight = Math.max(1, Math.ceil(height * pixelRatio));
    if (canvas.width !== nextWidth) canvas.width = nextWidth;
    if (canvas.height !== nextHeight) canvas.height = nextHeight;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Bounce Levels could not allocate its render layer.");
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    return { canvas, context };
  }
  storeLayer(key: string, canvas: HTMLCanvasElement, viewport: BounceRenderViewport) {
    if (this.refinementTimer !== null) clearTimeout(this.refinementTimer);
    this.refinementTimer = null;
    this.refinementKey = "";
    this.layerKey = key;
    this.layerCanvas = canvas;
    this.layerViewport = viewport;
    this.layerRevision = this.renderRevision;
    this.layerPanelCount = this.activePanelCount();
  }
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
