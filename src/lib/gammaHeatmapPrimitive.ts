import type {
  IChartApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import type { GammaHeatmapBin, GammaHeatmapLevel, GammaHeatmapSnapshot, GammaHeatmapViewMode } from "@/lib/gammaHeatmap";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];

export type GammaHeatmapPrimitiveData = {
  snapshots: GammaHeatmapSnapshot[];
  levels: GammaHeatmapLevel[];
  viewMode: GammaHeatmapViewMode;
  opacity: number;
  intensity: number;
  showHistorical: boolean;
  showLevels: boolean;
  carryForwardFade: boolean;
  positiveColor: string;
  negativeColor: string;
  neutralColor: string;
  backgroundColor: string;
  precision: number;
};

export type GammaHeatmapHit = {
  x: number;
  y: number;
  snapshot: GammaHeatmapSnapshot;
  bin: GammaHeatmapBin;
};

function hexToRgb(color: string) {
  const short = /^#([0-9a-f]{3})$/i.exec(color);
  const long = /^#([0-9a-f]{6})$/i.exec(color);
  const hex = long?.[1] ?? short?.[1].split("").map((part) => `${part}${part}`).join("");
  if (!hex) return { r: 255, g: 255, b: 255 };
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
}

function colorWithAlpha(color: string, alpha: number) {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

function binValue(bin: GammaHeatmapBin, mode: GammaHeatmapViewMode) {
  if (mode === "absolute") return bin.absolute;
  if (mode === "change") return bin.change;
  if (mode === "hedge-pressure") return -bin.net;
  return bin.net;
}

class GammaHeatmapRenderer implements ISeriesPrimitivePaneRenderer {
  // The exposure surface commonly holds 400-720 snapshots × ~300 bins. It was
  // repainted bin-by-bin on every chart invalidation — live ticks invalidate
  // several times a second — which saturated the main thread and allocated
  // hundreds of MB/minute of temporaries: the measured driver behind the
  // recurring browser out-of-memory crashes. The full surface is now rendered
  // once into an offscreen canvas and blitted per frame; it re-renders only
  // when the data, viewport, scale or size actually change.
  private surface: HTMLCanvasElement | null = null;
  private surfaceKey = "";
  dispose() { this.surface = null; this.surfaceKey = ""; }
  private maxValueKey = "";
  private maxValue = 1;

  constructor(private readonly primitive: GammaHeatmapPrimitive) {}

  private maxAbsValue(snapshots: GammaHeatmapSnapshot[], mode: GammaHeatmapViewMode) {
    const key = `${this.primitive.dataVersion()}|${mode}|${snapshots.length}`;
    if (this.maxValueKey === key) return this.maxValue;
    // A plain loop, never Math.max(...spread): the surface holds 100k+ bins
    // and spreading that many arguments overflows the V8 argument limit.
    let max = 1;
    for (const snapshot of snapshots) {
      for (const bin of snapshot.bins) {
        const value = Math.abs(binValue(bin, mode));
        if (value > max) max = value;
      }
    }
    this.maxValueKey = key;
    this.maxValue = max;
    return max;
  }

  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const series = this.primitive.series();
    const chart = this.primitive.chart();
    const data = this.primitive.data();
    if (!series || !chart || !data || !data.snapshots.length) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      if (mediaSize.width < 120 || mediaSize.height < 80) return;
      const snapshots = data.showHistorical ? data.snapshots : data.snapshots.slice(-1);
      const timeScale = chart.timeScale();

      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();
      if (data.viewMode !== "levels-only") {
        const range = timeScale.getVisibleLogicalRange();
        const latest = snapshots[snapshots.length - 1];
        const anchorTop = latest?.bins.length ? series.priceToCoordinate(latest.bins[0].price) : null;
        const anchorBottom = latest?.bins.length
          ? series.priceToCoordinate(latest.bins[latest.bins.length - 1].price)
          : null;
        const pixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const surfaceKey = [
          this.primitive.dataVersion(),
          snapshots.length,
          mediaSize.width,
          mediaSize.height,
          pixelRatio,
          range ? range.from.toFixed(3) : "",
          range ? range.to.toFixed(3) : "",
          anchorTop === null ? "" : Number(anchorTop).toFixed(2),
          anchorBottom === null ? "" : Number(anchorBottom).toFixed(2),
        ].join("|");
        if (!this.surface || this.surfaceKey !== surfaceKey) {
          this.surface = this.renderSurface(snapshots, data, series, timeScale, mediaSize.width, mediaSize.height, pixelRatio);
          this.surfaceKey = surfaceKey;
        }
        if (this.surface) {
          context.drawImage(this.surface, 0, 0, mediaSize.width, mediaSize.height);
        }
      }
      if (data.showLevels) {
        const occupied: number[] = [];
        for (const level of data.levels) {
          const y = series.priceToCoordinate(level.price);
          if (y === null || y < 2 || y > mediaSize.height - 2) continue;
          const positive = level.value >= 0;
          const color = level.kind === "VACUUM" || level.kind === "LOCAL_SIGN_TRANSITION"
            ? data.neutralColor
            : positive ? data.positiveColor : data.negativeColor;
          context.strokeStyle = colorWithAlpha(color, 0.78);
          context.lineWidth = level.kind.includes("WALL") || level.kind === "GAMMA_POC" ? 1.5 : 1;
          context.setLineDash(level.kind.includes("CLUSTER") ? [3, 4] : []);
          context.beginPath();
          context.moveTo(Math.max(0, mediaSize.width * 0.62), y + 0.5);
          context.lineTo(mediaSize.width, y + 0.5);
          context.stroke();
          let labelY = Number(y);
          while (occupied.some((used) => Math.abs(used - labelY) < 12)) labelY += 12;
          occupied.push(labelY);
          const label = `${level.label} ${level.price.toFixed(data.precision)}`;
          context.font = "600 9px 'JetBrains Mono', monospace";
          context.textAlign = "right";
          context.textBaseline = "middle";
          const width = context.measureText(label).width + 10;
          context.fillStyle = colorWithAlpha(data.backgroundColor, 0.9);
          context.fillRect(mediaSize.width - width - 6, labelY - 8, width, 16);
          context.strokeStyle = colorWithAlpha(color, 0.75);
          context.strokeRect(mediaSize.width - width - 6, labelY - 8, width, 16);
          context.fillStyle = color;
          context.fillText(label, mediaSize.width - 11, labelY);
        }
      }
      context.restore();
    });
  }

  private renderSurface(
    snapshots: GammaHeatmapSnapshot[],
    data: GammaHeatmapPrimitiveData,
    series: NonNullable<ReturnType<GammaHeatmapPrimitive["series"]>>,
    timeScale: ReturnType<IChartApi["timeScale"]>,
    width: number,
    height: number,
    pixelRatio: number,
  ): HTMLCanvasElement | null {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.scale(pixelRatio, pixelRatio);

    const maxValue = this.maxAbsValue(snapshots, data.viewMode);
    // Colour strings were rebuilt with a regex parse for every bin of every
    // frame. Parse the palette once per surface render instead.
    const positiveRgb = hexToRgb(data.positiveColor);
    const negativeRgb = hexToRgb(data.negativeColor);
    const rgba = (rgb: { r: number; g: number; b: number }, alpha: number) =>
      `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.max(0, Math.min(1, alpha))})`;

    const positionedRaw = snapshots.map((snapshot, index) => {
      const x = timeScale.timeToCoordinate(Math.floor(snapshot.timestamp / 1_000) as Time);
      if (x === null) return null;
      const next = snapshots[index + 1];
      const nextX = next ? timeScale.timeToCoordinate(Math.floor(next.timestamp / 1_000) as Time) : null;
      return { snapshot, x: Number(x), nextX: nextX === null ? null : Number(nextX) };
    }).filter((value): value is NonNullable<typeof value> => Boolean(value));
    // Multiple provider frames can resolve to the same screen pixel when the
    // user zooms out. Paint only the latest one for that pixel to keep the
    // chart responsive without changing the underlying history.
    const byPixel = new Map<number, (typeof positionedRaw)[number]>();
    positionedRaw.forEach((value) => byPixel.set(Math.round(value.x), value));
    const positioned = [...byPixel.values()].sort((left, right) => left.x - right.x);

    positioned.forEach(({ snapshot, x, nextX }, snapshotIndex) => {
      // Columns that fall outside the rendered viewport cost the same as
      // visible ones in fill work; skip them entirely.
      if (x < -40 || x > width + 40) return;
      const ageFade = data.carryForwardFade && snapshot.status !== "LIVE" ? 0.55 : 1;
      const historyFade = positioned.length > 1 ? 0.42 + 0.58 * ((snapshotIndex + 1) / positioned.length) : 1;
      const columnWidth = Math.max(2, Math.min(28, nextX === null ? 10 : Math.abs(nextX - x) + 1));
      const bins = snapshot.bins;
      bins.forEach((bin, binIndex) => {
        const y = series.priceToCoordinate(bin.price);
        if (y === null || y < -20 || y > height + 20) return;
        const adjacent = bins[binIndex + 1] ?? bins[binIndex - 1];
        const adjacentY = adjacent ? series.priceToCoordinate(adjacent.price) : null;
        const binHeight = Math.max(2, Math.min(22, adjacentY === null ? 5 : Math.abs(Number(adjacentY) - Number(y))));
        const value = binValue(bin, data.viewMode);
        const magnitude = Math.min(1, Math.abs(value) / maxValue);
        const alpha = data.opacity * ageFade * historyFade * Math.pow(magnitude, Math.max(0.25, 1 / data.intensity));
        if (data.viewMode === "call-put") {
          const total = Math.max(1, Math.abs(bin.call) + Math.abs(bin.put));
          const split = columnWidth * Math.abs(bin.call) / total;
          context.fillStyle = rgba(positiveRgb, alpha);
          context.fillRect(x - columnWidth / 2, Number(y) - binHeight / 2, split, binHeight);
          context.fillStyle = rgba(negativeRgb, alpha);
          context.fillRect(x - columnWidth / 2 + split, Number(y) - binHeight / 2, columnWidth - split, binHeight);
        } else {
          context.fillStyle = rgba(value >= 0 ? positiveRgb : negativeRgb, alpha);
          context.fillRect(x - columnWidth / 2, Number(y) - binHeight / 2, columnWidth, binHeight);
        }
      });
    });
    return canvas;
  }
}

class GammaHeatmapView implements ISeriesPrimitivePaneView {
  private readonly paneRenderer: GammaHeatmapRenderer;
  constructor(primitive: GammaHeatmapPrimitive) { this.paneRenderer = new GammaHeatmapRenderer(primitive); }
  zOrder() { return "bottom" as const; }
  renderer() { return this.paneRenderer; }
  dispose() { this.paneRenderer.dispose(); }
}

export class GammaHeatmapPrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null;
  private chartApi: IChartApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderData: GammaHeatmapPrimitiveData | null = null;
  private renderDataVersion = 0;
  private readonly paneView = new GammaHeatmapView(this);

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) {
    this.candleSeries = param.series;
    this.chartApi = param.chart as IChartApi;
    this.requestRedraw = param.requestUpdate;
  }
  detached() {
    // Release the offscreen surface immediately (its backing store is ~13 MB
    // per pane at high-DPI) rather than waiting for GC.
    this.paneView.dispose();
    this.candleSeries = null;
    this.chartApi = null;
    this.requestRedraw = null;
  }
  update(data: GammaHeatmapPrimitiveData | null) {
    this.renderData = data;
    this.renderDataVersion += 1;
    this.requestRedraw?.();
  }
  series() { return this.candleSeries; }
  chart() { return this.chartApi; }
  data() { return this.renderData; }
  dataVersion() { return this.renderDataVersion; }
  queryHit(x: number, y: number): GammaHeatmapHit | null {
    if (!this.chartApi || !this.candleSeries || !this.renderData) return null;
    const snapshots = this.renderData.showHistorical ? this.renderData.snapshots : this.renderData.snapshots.slice(-1);
    let closest: { snapshot: GammaHeatmapSnapshot; x: number; distance: number } | null = null;
    for (const snapshot of snapshots) {
      const coordinate = this.chartApi.timeScale().timeToCoordinate(Math.floor(snapshot.timestamp / 1_000) as Time);
      if (coordinate === null) continue;
      const distance = Math.abs(Number(coordinate) - x);
      if (!closest || distance < closest.distance) closest = { snapshot, x: Number(coordinate), distance };
    }
    if (!closest || closest.distance > 18) return null;
    let binHit: { bin: GammaHeatmapBin; y: number; distance: number } | null = null;
    for (const bin of closest.snapshot.bins) {
      const coordinate = this.candleSeries.priceToCoordinate(bin.price);
      if (coordinate === null) continue;
      const distance = Math.abs(Number(coordinate) - y);
      if (!binHit || distance < binHit.distance) binHit = { bin, y: Number(coordinate), distance };
    }
    if (!binHit || binHit.distance > 14) return null;
    return { x: closest.x, y: binHit.y, snapshot: closest.snapshot, bin: binHit.bin };
  }
  paneViews() { return [this.paneView]; }
}
