import type {
  IChartApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import { formatDarkPoolNotional, type DarkPoolGexCluster, type DarkPoolGexEvent, type DarkPoolGexFrame, type DarkPoolGexSettings } from "@/lib/darkPoolGex";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];

export type DarkPoolGexPrimitiveData = {
  frame: DarkPoolGexFrame;
  settings: DarkPoolGexSettings;
  neutralColor: string;
  positiveGexColor: string;
  negativeGexColor: string;
  backgroundColor: string;
  currentPrice: number | null;
  timelineMs: number[];
};

export type DarkPoolGexHit = {
  x: number;
  y: number;
  event?: DarkPoolGexEvent;
  cluster?: DarkPoolGexCluster;
  frame: DarkPoolGexFrame;
};

type RenderedHit = DarkPoolGexHit & { left: number; right: number; top: number; bottom: number };
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function rgba(color: string, opacity: number) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return color;
  return `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${clamp01(opacity)})`;
}

function timeCoordinate(chart: IChartApi, timestampMs: number, timelineMs: number[]) {
  const exact = chart.timeScale().timeToCoordinate(Math.floor(timestampMs / 1_000) as Time);
  if (exact !== null) return exact;
  let low = 0;
  let high = timelineMs.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (timelineMs[middle] < timestampMs) low = middle + 1;
    else high = middle;
  }
  const visibleStart = timelineMs[Math.min(low, timelineMs.length - 1)];
  return Number.isFinite(visibleStart) ? chart.timeScale().timeToCoordinate(Math.floor(visibleStart / 1_000) as Time) : null;
}

class DarkPoolGexRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: DarkPoolGexPrimitive) {}

  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const data = this.primitive.data();
    const chart = this.primitive.chart();
    const series = this.primitive.series();
    if (!data || !chart || !series) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      if (mediaSize.width < 80 || mediaSize.height < 60) return;
      const settings = data.settings;
      const hits: RenderedHit[] = [];
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();

      if (settings.displayMode !== "raw" && settings.clusterEnabled) {
        for (const cluster of data.frame.clusters) {
          const y = series.priceToCoordinate(cluster.weightedPrice);
          const start = timeCoordinate(chart, cluster.firstTimestampMs, data.timelineMs);
          if (y === null || start === null || Number(y) < -30 || Number(y) > mediaSize.height + 30) continue;
          const height = 3 + settings.bandThickness * cluster.visualStrength;
          const opacity = settings.bandOpacity / 100 * (0.35 + 0.65 * cluster.visualStrength);
          const gradient = context.createLinearGradient(Number(start), 0, mediaSize.width, 0);
          gradient.addColorStop(0, rgba(data.neutralColor, opacity * 0.82));
          gradient.addColorStop(1, rgba(data.neutralColor, opacity * 0.16));
          context.fillStyle = gradient;
          context.fillRect(Number(start), Number(y) - height / 2, mediaSize.width - Number(start), height);
          context.strokeStyle = rgba(data.neutralColor, 0.3 + cluster.visualStrength * 0.35);
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(Number(start), Number(y) + 0.5);
          context.lineTo(mediaSize.width, Number(y) + 0.5);
          context.stroke();
          hits.push({ x: Number(start), y: Number(y), cluster, frame: data.frame, left: Number(start), right: mediaSize.width, top: Number(y) - Math.max(6, height), bottom: Number(y) + Math.max(6, height) });
        }
      }

      if (settings.displayMode !== "clusters") {
        for (const event of data.frame.rawEvents) {
          const x = timeCoordinate(chart, event.observableTimestampMs, data.timelineMs);
          const y = series.priceToCoordinate(event.price);
          if (x === null || y === null || Number(y) < -30 || Number(y) > mediaSize.height + 30) continue;
          const originX = Number(x);
          const originY = Number(y);
          const strength = event.visualStrength * event.ageFade;
          const confluence = event.primaryConfluence;
          const gammaColor = confluence?.signedExposure && confluence.signedExposure >= 0 ? data.positiveGexColor : data.negativeGexColor;
          const kingMultiplier = confluence?.role === "KING" ? 1 + settings.kingBoost / 100 : 1;
          const halo = confluence ? (3 + 13 * confluence.confluence) * settings.haloIntensity / 100 * kingMultiplier : 0;
          const coreHeight = settings.precisionMode ? Math.max(1, settings.bandThickness) : 1 + settings.bandThickness * (0.35 + 0.65 * strength);
          const proximity = settings.proximityEmphasis && data.currentPrice !== null
            ? clamp01(1 - Math.abs(data.currentPrice - event.price) / Math.max(1e-9, settings.proximityDistance))
            : 0;
          if (confluence && halo > 0) {
            const haloGradient = context.createLinearGradient(originX, 0, mediaSize.width, 0);
            haloGradient.addColorStop(0, rgba(gammaColor, 0.30 * confluence.confluence));
            haloGradient.addColorStop(0.55, rgba(gammaColor, 0.16 * confluence.confluence));
            haloGradient.addColorStop(1, rgba(gammaColor, 0.02));
            context.shadowBlur = halo;
            context.shadowColor = rgba(gammaColor, 0.7);
            context.fillStyle = haloGradient;
            context.fillRect(originX, originY - halo / 2, Math.max(1, mediaSize.width - originX), halo);
            context.shadowBlur = 0;
          }
          if (settings.showForwardMemory) {
            const memory = context.createLinearGradient(originX, 0, mediaSize.width, 0);
            memory.addColorStop(0, rgba(data.neutralColor, settings.bandOpacity / 100 * strength));
            memory.addColorStop(1, rgba(data.neutralColor, settings.bandOpacity / 100 * strength * 0.28));
            context.fillStyle = memory;
            context.fillRect(originX, originY - coreHeight / 2, Math.max(1, mediaSize.width - originX), coreHeight);
          }
          if (settings.showExactLine) {
            context.save();
            context.setLineDash(settings.precisionMode ? [5, 4] : []);
            context.strokeStyle = rgba(data.neutralColor, 0.72 + 0.2 * strength + 0.08 * proximity);
            context.lineWidth = settings.precisionMode ? 1 : 0.8 + 2.2 * strength;
            context.beginPath();
            context.moveTo(originX, originY);
            context.lineTo(mediaSize.width, originY);
            context.stroke();
            context.restore();
          }
          const radius = settings.originMarkerSize * (0.55 + 0.75 * strength);
          if (settings.showOriginMarker) {
            const pulse = context.createRadialGradient(originX, originY, 0, originX, originY, radius * 1.8);
            pulse.addColorStop(0, rgba(data.neutralColor, 0.95));
            pulse.addColorStop(0.32, rgba(data.neutralColor, 0.72));
            pulse.addColorStop(1, rgba(data.neutralColor, 0));
            context.fillStyle = pulse;
            context.beginPath();
            context.arc(originX, originY, radius * 1.8, 0, Math.PI * 2);
            context.fill();
            context.fillStyle = data.neutralColor;
            context.beginPath();
            context.arc(originX, originY, Math.max(1.5, radius * 0.38), 0, Math.PI * 2);
            context.fill();
          }
          if (settings.showLabels) {
            const date = new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric", timeZone: "America/New_York" }).format(new Date(event.executionTimestampMs));
            const label = settings.labelExtended
              ? `DP ${formatDarkPoolNotional(event.notional)} · ${date} · ${event.price}`
              : `DP ${formatDarkPoolNotional(event.notional)} · ${date}`;
            context.save();
            context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
            context.textBaseline = "middle";
            const width = Math.ceil(context.measureText(label).width) + 10;
            const left = Math.max(originX + 6, mediaSize.width - width - 4);
            context.fillStyle = rgba(data.backgroundColor, 0.9);
            context.fillRect(left, originY - 8, width, 16);
            context.strokeStyle = rgba(data.neutralColor, 0.72);
            context.lineWidth = 1;
            context.strokeRect(left + 0.5, originY - 7.5, width - 1, 15);
            context.fillStyle = data.neutralColor;
            context.fillText(label, left + 5, originY);
            context.restore();
          }
          hits.push({ x: originX, y: originY, event, frame: data.frame, left: originX - radius * 2, right: mediaSize.width, top: originY - Math.max(8, halo / 2), bottom: originY + Math.max(8, halo / 2) });
        }
      }
      context.restore();
      this.primitive.setHits(hits);
    });
  }
}

class DarkPoolGexView implements ISeriesPrimitivePaneView {
  private readonly paneRenderer: DarkPoolGexRenderer;
  constructor(primitive: DarkPoolGexPrimitive) { this.paneRenderer = new DarkPoolGexRenderer(primitive); }
  zOrder() { return "bottom" as const; }
  renderer() { return this.paneRenderer; }
}

export class DarkPoolGexPrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null;
  private chartApi: IChartApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderData: DarkPoolGexPrimitiveData | null = null;
  private renderedHits: RenderedHit[] = [];
  private readonly paneView = new DarkPoolGexView(this);

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) { this.candleSeries = param.series; this.chartApi = param.chart as IChartApi; this.requestRedraw = param.requestUpdate; }
  detached() { this.candleSeries = null; this.chartApi = null; this.requestRedraw = null; this.renderedHits = []; }
  update(data: DarkPoolGexPrimitiveData | null) { this.renderData = data; if (!data) this.renderedHits = []; this.requestRedraw?.(); }
  series() { return this.candleSeries; }
  chart() { return this.chartApi; }
  data() { return this.renderData; }
  paneViews() { return [this.paneView]; }
  setHits(hits: RenderedHit[]) { this.renderedHits = hits; }
  queryHit(x: number, y: number): DarkPoolGexHit | null {
    const matches = this.renderedHits.filter((hit) => x >= hit.left && x <= hit.right && y >= hit.top && y <= hit.bottom);
    if (!matches.length) return null;
    return matches.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
  }
}
