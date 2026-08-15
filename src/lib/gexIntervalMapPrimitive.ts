import type {
  IChartApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import type { GexIntervalMapLevel, GexIntervalMapPoint, GexIntervalMapSnapshot, GexIntervalMapVisual } from "@/lib/gexIntervalMap";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];

export type GexIntervalMapPrimitiveData = {
  snapshot: GexIntervalMapSnapshot;
  visualMode: GexIntervalMapVisual;
  opacity: number;
  intensity: number;
  minimumRadius: number;
  maximumRadius: number;
  cellWidth: number;
  fixedDotRadius: number;
  minimumOpacity: number;
  maximumOpacity: number;
  scaleMode: "visible-maximum" | "visible-percentile" | "session-maximum" | "fixed-maximum";
  scalePercentile: number;
  scaleTransform: "linear" | "square-root" | "logarithmic";
  fixedMaximum: number;
  logStrength: number;
  highlightCurrentBucket: boolean;
  currentBucketScaleMultiplier: number;
  currentBucketOpacityMultiplier: number;
  showCurrentBucketOutline: boolean;
  hollowBubbles: boolean;
  bubbleStrokeWidth: number;
  bubbleFillStrength: number;
  showLevelTracks: boolean;
  showUnderlyingPriceLine: boolean;
  trackWidth: number;
  showLevels: boolean;
  showMaxPositive: boolean;
  showMaxNegative: boolean;
  showDominantAbsolute: boolean;
  showCallWall: boolean;
  showPutWall: boolean;
  mergeCoincidentLabels: boolean;
  mergeTolerancePoints: number;
  showValues: boolean;
  positiveColor: string;
  negativeColor: string;
  callColor: string;
  putColor: string;
  neutralColor: string;
  backgroundColor: string;
  precision: number;
};

export type GexIntervalMapHit = { x: number; y: number; point: GexIntervalMapPoint };

const rgb = (color: string) => {
  const value = color.replace("#", "");
  const full = value.length === 3 ? value.split("").map((part) => part + part).join("") : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) return { r: 255, g: 255, b: 255 };
  return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) };
};
const rgba = (color: string, alpha: number) => {
  const { r, g, b } = rgb(color);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
};
const percentile = (values: number[], fraction: number) => {
  if (!values.length) return 1;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))] || 1;
};

class Renderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: GexIntervalMapPrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const series = this.primitive.series();
    const chart = this.primitive.chart();
    const data = this.primitive.data();
    if (!series || !chart || !data || !data.snapshot.points.length) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      if (mediaSize.width < 80 || mediaSize.height < 80) return;
      const scale = chart.timeScale();
      const visible: Array<{ point: GexIntervalMapPoint; x: number; y: number }> = [];
      for (const point of data.snapshot.points) {
        const x = scale.timeToCoordinate(Math.floor(point.timestamp / 1_000) as Time);
        const y = series.priceToCoordinate(point.mappedPrice);
        if (x === null || y === null || x < -40 || x > mediaSize.width + 40 || y < -30 || y > mediaSize.height + 30) continue;
        visible.push({ point, x: Number(x), y: Number(y) });
      }
      if (!visible.length) return;
      const visibleMagnitudes = visible.map(({ point }) => Math.abs(point.value)).filter((value) => value > 0);
      const ceiling = data.scaleMode === "fixed-maximum"
        ? Math.max(1, data.fixedMaximum)
        : data.scaleMode === "session-maximum"
          ? Math.max(1, ...data.snapshot.points.map((point) => Math.abs(point.value)))
          : data.scaleMode === "visible-percentile"
            ? percentile(visibleMagnitudes, data.scalePercentile)
            : Math.max(1, ...visibleMagnitudes);
      const latestTimestamp = Math.max(...visible.map(({ point }) => point.timestamp));
      const normalize = (value: number) => {
        const normalized = Math.max(0, Math.min(1, (Math.abs(value) * data.intensity) / ceiling));
        if (data.scaleTransform === "linear") return normalized;
        if (data.scaleTransform === "logarithmic") return Math.log1p(data.logStrength * normalized) / Math.log1p(data.logStrength);
        return Math.sqrt(normalized);
      };
      context.save();
      context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();
      if (data.showLevelTracks) {
        this.drawTrack(context, data.snapshot.tracks?.maxPositive ?? [], chart, series, data.positiveColor, data.trackWidth, [5, 4]);
        this.drawTrack(context, data.snapshot.tracks?.maxNegative ?? [], chart, series, data.negativeColor, data.trackWidth, [5, 4]);
      }
      if (data.showUnderlyingPriceLine) {
        this.drawTrack(context, data.snapshot.tracks?.underlyingPrice ?? [], chart, series, data.neutralColor, Math.max(1, data.trackWidth * 0.8), []);
      }
      if (data.visualMode === "horizontal-ribbons" || data.visualMode === "hybrid") {
        const byPrice = new Map<number, typeof visible>();
        for (const item of visible) {
          const items = byPrice.get(item.point.mappedPrice) ?? [];
          items.push(item); byPrice.set(item.point.mappedPrice, items);
        }
        for (const items of byPrice.values()) {
          items.sort((a, b) => a.x - b.x);
          if (items.length < 2) continue;
          context.beginPath();
          items.forEach((item, index) => index ? context.lineTo(item.x, item.y) : context.moveTo(item.x, item.y));
          const average = items.reduce((sum, item) => sum + item.point.value, 0) / items.length;
          context.strokeStyle = rgba(average >= 0 ? data.positiveColor : data.negativeColor, data.opacity * 0.48);
          context.lineWidth = 1.25;
          context.stroke();
        }
      }
      for (const { point, x, y } of visible) {
        const magnitude = normalize(point.value);
        const isCurrent = data.highlightCurrentBucket && point.timestamp === latestTimestamp;
        const alpha = Math.min(1, data.opacity * (data.minimumOpacity + magnitude * (data.maximumOpacity - data.minimumOpacity)) * (isCurrent ? data.currentBucketOpacityMultiplier : 1));
        const color = point.value >= 0 ? data.positiveColor : data.negativeColor;
        if (data.visualMode === "heat-cells" || data.visualMode === "hybrid") {
          const height = Math.max(3, Math.min(18, data.maximumRadius));
          context.fillStyle = rgba(color, alpha * (data.visualMode === "hybrid" ? 0.32 : 0.72));
          context.fillRect(x - data.cellWidth / 2, y - height / 2, data.cellWidth, height);
        }
        if (data.visualMode === "bubbles" || data.visualMode === "fixed-dots" || data.visualMode === "hybrid") {
          const radius = data.visualMode === "fixed-dots"
            ? data.fixedDotRadius
            : Math.min(data.maximumRadius, (data.minimumRadius + (data.maximumRadius - data.minimumRadius) * magnitude) * (isCurrent ? data.currentBucketScaleMultiplier : 1));
          context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2);
          if (data.snapshot.content === "call-put-split") {
            context.save(); context.beginPath(); context.rect(x - radius, y - radius, radius, radius * 2); context.clip();
            context.fillStyle = rgba(data.callColor, alpha * data.bubbleFillStrength); context.fill(); context.restore();
            context.save(); context.beginPath(); context.rect(x, y - radius, radius, radius * 2); context.clip();
            context.fillStyle = rgba(data.putColor, alpha * data.bubbleFillStrength); context.fill(); context.restore();
          } else {
            context.fillStyle = rgba(color, alpha * (data.hollowBubbles ? data.bubbleFillStrength : 1));
            context.fill();
          }
          context.strokeStyle = rgba(color, Math.min(1, Math.max(0.34, alpha + 0.3)));
          context.lineWidth = data.bubbleStrokeWidth;
          context.stroke();
          if (isCurrent && data.showCurrentBucketOutline) {
            context.beginPath(); context.arc(x, y, radius + 1.5, 0, Math.PI * 2);
            context.strokeStyle = rgba(data.neutralColor, 0.9); context.lineWidth = 1; context.stroke();
          }
          if (data.showValues && radius >= 8) {
            context.fillStyle = "#fff"; context.font = "600 8px 'JetBrains Mono', monospace";
            context.textAlign = "center"; context.textBaseline = "middle";
            context.fillText(Math.abs(point.value) >= 1e9 ? `${(point.value / 1e9).toFixed(1)}B` : Math.abs(point.value) >= 1e6 ? `${(point.value / 1e6).toFixed(1)}M` : `${Math.round(point.value / 1e3)}K`, x, y);
          }
        }
      }
      if (data.showLevels) {
        const enabledKinds = new Set([
          ...(data.showMaxPositive ? ["MAX_POSITIVE"] : []),
          ...(data.showMaxNegative ? ["MAX_NEGATIVE"] : []),
          ...(data.showDominantAbsolute ? ["DOMINANT_ABSOLUTE"] : []),
          ...(data.showCallWall ? ["CALL_WALL"] : []),
          ...(data.showPutWall ? ["PUT_WALL"] : []),
        ]);
        this.drawLevels(context, mediaSize.width, mediaSize.height, data.snapshot.levels.filter((level) => enabledKinds.has(level.kind)), series, data);
      }
      context.restore();
    });
  }

  private drawTrack(
    context: CanvasRenderingContext2D,
    points: Array<{ timestamp: number; price: number }>,
    chart: IChartApi,
    series: CandleSeriesApi,
    color: string,
    width: number,
    dash: number[],
  ) {
    const coordinates = points.map((point) => ({
      x: chart.timeScale().timeToCoordinate(Math.floor(point.timestamp / 1_000) as Time),
      y: series.priceToCoordinate(point.price),
    })).filter((point): point is { x: NonNullable<typeof point.x>; y: NonNullable<typeof point.y> } => point.x !== null && point.y !== null);
    if (coordinates.length < 2) return;
    context.save();
    context.beginPath();
    coordinates.forEach((point, index) => index === 0
      ? context.moveTo(Number(point.x), Number(point.y))
      : context.lineTo(Number(point.x), Number(point.y)));
    context.strokeStyle = rgba(color, 0.82);
    context.lineWidth = width;
    context.setLineDash(dash);
    context.lineJoin = "round";
    context.lineCap = "round";
    context.stroke();
    context.restore();
  }

  private drawLevels(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    levels: GexIntervalMapLevel[],
    series: CandleSeriesApi,
    data: GexIntervalMapPrimitiveData,
  ) {
    const occupied: number[] = [];
    const grouped: Array<{ price: number; value: number; labels: string[] }> = [];
    for (const level of levels) {
      const existing = data.mergeCoincidentLabels ? grouped.find((item) => Math.abs(item.price - level.price) <= data.mergeTolerancePoints) : null;
      if (existing) existing.labels.push(level.label);
      else grouped.push({ price: level.price, value: level.value, labels: [level.label] });
    }
    for (const level of grouped) {
      const coordinate = series.priceToCoordinate(level.price);
      if (coordinate === null || coordinate < 0 || coordinate > height) continue;
      const y = Number(coordinate);
      const color = level.value >= 0 ? data.positiveColor : data.negativeColor;
      context.strokeStyle = rgba(color, 0.75); context.lineWidth = 1; context.setLineDash([3, 4]);
      context.beginPath(); context.moveTo(width * 0.68, y + 0.5); context.lineTo(width, y + 0.5); context.stroke();
      context.setLineDash([]);
      let labelY = y;
      while (occupied.some((value) => Math.abs(value - labelY) < 11)) labelY += 11;
      occupied.push(labelY);
      const label = `${level.labels.join(" · ")} ${level.price.toFixed(data.precision)}`;
      context.font = "600 8px 'JetBrains Mono', monospace";
      const labelWidth = context.measureText(label).width + 10;
      context.fillStyle = rgba(data.backgroundColor, 0.9); context.fillRect(width - labelWidth - 4, labelY - 7, labelWidth, 14);
      context.fillStyle = color; context.textAlign = "right"; context.textBaseline = "middle"; context.fillText(label, width - 9, labelY);
    }
  }
}

class PaneView implements ISeriesPrimitivePaneView {
  private readonly paneRenderer: Renderer;
  constructor(primitive: GexIntervalMapPrimitive) { this.paneRenderer = new Renderer(primitive); }
  zOrder() { return "bottom" as const; }
  renderer() { return this.paneRenderer; }
}

export class GexIntervalMapPrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null;
  private chartApi: IChartApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderData: GexIntervalMapPrimitiveData | null = null;
  private readonly paneView = new PaneView(this);
  attached(param: SeriesAttachedParameter<Time, "Candlestick">) { this.candleSeries = param.series; this.chartApi = param.chart as IChartApi; this.requestRedraw = param.requestUpdate; }
  detached() { this.candleSeries = null; this.chartApi = null; this.requestRedraw = null; }
  update(data: GexIntervalMapPrimitiveData | null) { this.renderData = data; this.requestRedraw?.(); }
  series() { return this.candleSeries; }
  chart() { return this.chartApi; }
  data() { return this.renderData; }
  queryHit(x: number, y: number): GexIntervalMapHit | null {
    if (!this.chartApi || !this.candleSeries || !this.renderData) return null;
    let hit: GexIntervalMapHit | null = null;
    let best = 18;
    for (const point of this.renderData.snapshot.points) {
      const pointX = this.chartApi.timeScale().timeToCoordinate(Math.floor(point.timestamp / 1_000) as Time);
      const pointY = this.candleSeries.priceToCoordinate(point.mappedPrice);
      if (pointX === null || pointY === null) continue;
      const distance = Math.hypot(Number(pointX) - x, Number(pointY) - y);
      if (distance < best) { best = distance; hit = { x: Number(pointX), y: Number(pointY), point }; }
    }
    return hit;
  }
  paneViews() { return [this.paneView]; }
}
