import type {
  IChartApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import type { DarkPoolLevelAggregate, DarkPoolVisualMode, DarkPoolZone, MappedDarkPoolPrint } from "@/lib/darkPoolMap";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];

export type DarkPoolMapPrimitiveData = {
  prints: MappedDarkPoolPrint[];
  levels: DarkPoolLevelAggregate[];
  zones: DarkPoolZone[];
  visualMode: DarkPoolVisualMode;
  maximumVisibleCircles: number;
  maximumVisibleZones: number;
  minimumRadius: number;
  maximumRadius: number;
  opacity: number;
  zoneOpacity: number;
  showLevelLabels: boolean;
  neutralColor: string;
  askSideColor: string;
  bidSideColor: string;
  midColor: string;
  delayedColor: string;
  backgroundColor: string;
  precision: number;
};

export type DarkPoolMapHit = {
  x: number;
  y: number;
  print?: MappedDarkPoolPrint;
  level?: DarkPoolLevelAggregate;
  zone?: DarkPoolZone;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function rgb(color: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return { r: 255, g: 255, b: 255 };
  return { r: parseInt(match[1].slice(0, 2), 16), g: parseInt(match[1].slice(2, 4), 16), b: parseInt(match[1].slice(4, 6), 16) };
}

function alpha(color: string, opacity: number) {
  const value = rgb(color);
  return `rgba(${value.r},${value.g},${value.b},${clamp01(opacity)})`;
}

function printColor(print: MappedDarkPoolPrint, data: DarkPoolMapPrimitiveData) {
  if (print.isDelayedPrint) return data.delayedColor;
  if (print.tradeSide === "ASK" || print.tradeSide === "ABOVE_ASK") return data.askSideColor;
  if (print.tradeSide === "BID" || print.tradeSide === "BELOW_BID") return data.bidSideColor;
  if (print.tradeSide === "MID_MARKET") return data.midColor;
  return data.neutralColor;
}

function levelColor(level: DarkPoolLevelAggregate, data: DarkPoolMapPrimitiveData) {
  if (level.askSideNotional > level.bidSideNotional && level.askSideNotional > level.midMarketNotional) return data.askSideColor;
  if (level.bidSideNotional > level.askSideNotional && level.bidSideNotional > level.midMarketNotional) return data.bidSideColor;
  return data.midColor;
}

function compactMoney(value: number) {
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${Math.round(value)}`;
}

class Renderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: DarkPoolMapPrimitive) {}

  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const series = this.primitive.series();
    const chart = this.primitive.chart();
    const data = this.primitive.data();
    if (!series || !chart || !data) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      if (mediaSize.width < 100 || mediaSize.height < 80) return;
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();

      const showZones = data.visualMode === "zones" || data.visualMode === "circles-and-zones" || data.visualMode === "lines" || data.visualMode === "historical-ribbons";
      const showCircles = data.visualMode === "heat-circles" || data.visualMode === "circles-and-zones";
      const zones = data.zones.slice(0, data.maximumVisibleZones);
      if (showZones) {
        const occupied: number[] = [];
        zones.forEach((zone) => {
          const top = series.priceToCoordinate(zone.upperPrice);
          const bottom = series.priceToCoordinate(zone.lowerPrice);
          const center = series.priceToCoordinate(zone.weightedPrice);
          if (center === null) return;
          const representative = data.levels.find((level) => zone.memberLevelIds.includes(level.id));
          const color = representative ? levelColor(representative, data) : data.neutralColor;
          const y1 = Math.min(Number(top ?? center) - 2, Number(bottom ?? center) - 2);
          const y2 = Math.max(Number(top ?? center) + 2, Number(bottom ?? center) + 2);
          if (y2 < 0 || y1 > mediaSize.height) return;
          const startX = data.visualMode === "historical-ribbons" && zone.firstPrintTimeMs
            ? Number(chart.timeScale().timeToCoordinate(Math.floor(zone.firstPrintTimeMs / 1_000) as Time) ?? 0)
            : mediaSize.width * 0.08;
          if (data.visualMode !== "lines") {
            context.fillStyle = alpha(color, data.zoneOpacity * (0.4 + 0.6 * zone.strengthScore / 100));
            context.fillRect(startX, y1, mediaSize.width - startX, Math.max(3, y2 - y1));
          }
          context.strokeStyle = alpha(color, 0.52 + 0.35 * zone.strengthScore / 100);
          context.lineWidth = zone.strengthScore >= 75 ? 1.5 : 1;
          context.setLineDash([]);
          context.beginPath();
          context.moveTo(startX, Number(center) + 0.5);
          context.lineTo(mediaSize.width, Number(center) + 0.5);
          context.stroke();
          if (!data.showLevelLabels) return;
          let labelY = Number(center);
          while (occupied.some((used) => Math.abs(used - labelY) < 14)) labelY += 14;
          occupied.push(labelY);
          const label = `DP ${zone.weightedPrice.toFixed(data.precision)} · ${compactMoney(zone.totalNotional)} · ${Math.round(zone.strengthScore)}`;
          context.font = "600 9px 'JetBrains Mono', monospace";
          const labelWidth = context.measureText(label).width + 10;
          const labelX = Math.max(4, mediaSize.width - labelWidth - 7);
          context.fillStyle = alpha(data.backgroundColor, 0.94);
          context.fillRect(labelX, labelY - 8, labelWidth, 16);
          context.strokeStyle = alpha(color, 0.75);
          context.strokeRect(labelX, labelY - 8, labelWidth, 16);
          context.fillStyle = color;
          context.textAlign = "left";
          context.textBaseline = "middle";
          context.fillText(label, labelX + 5, labelY);
        });
      }

      if (showCircles) {
        const visible = data.prints.slice(-Math.max(1, data.maximumVisibleCircles));
        const notionals = visible.map((print) => Math.log1p(print.notionalValue));
        const minimum = Math.min(...notionals, 0);
        const maximum = Math.max(...notionals, 1);
        visible.forEach((print) => {
          const x = chart.timeScale().timeToCoordinate(Math.floor(print.tradeTimeMs / 1_000) as Time);
          const y = series.priceToCoordinate(print.mappedPrice);
          if (x === null || y === null || x < -30 || x > mediaSize.width + 30 || y < -30 || y > mediaSize.height + 30) return;
          const normalized = clamp01((Math.log1p(print.notionalValue) - minimum) / Math.max(1e-9, maximum - minimum));
          const radius = data.minimumRadius + (data.maximumRadius - data.minimumRadius) * Math.sqrt(normalized);
          const color = printColor(print, data);
          context.beginPath();
          context.ellipse(Number(x), Number(y), radius * 1.35, radius * 0.72, 0, 0, Math.PI * 2);
          context.fillStyle = alpha(color, data.opacity * (0.45 + 0.55 * normalized) * (print.isDelayedPrint ? 0.55 : 1));
          context.fill();
          context.strokeStyle = alpha(color, 0.62);
          context.lineWidth = 1;
          context.setLineDash(print.isDelayedPrint ? [3, 3] : []);
          context.stroke();
        });
      }
      context.restore();
    });
  }
}

class PaneView implements ISeriesPrimitivePaneView {
  private readonly paneRenderer: Renderer;
  constructor(primitive: DarkPoolMapPrimitive) { this.paneRenderer = new Renderer(primitive); }
  zOrder() { return "bottom" as const; }
  renderer() { return this.paneRenderer; }
}

export class DarkPoolMapPrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null;
  private chartApi: IChartApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderData: DarkPoolMapPrimitiveData | null = null;
  private readonly paneView = new PaneView(this);

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) { this.candleSeries = param.series; this.chartApi = param.chart as IChartApi; this.requestRedraw = param.requestUpdate; }
  detached() { this.candleSeries = null; this.chartApi = null; this.requestRedraw = null; }
  update(data: DarkPoolMapPrimitiveData | null) { this.renderData = data; this.requestRedraw?.(); }
  series() { return this.candleSeries; }
  chart() { return this.chartApi; }
  data() { return this.renderData; }
  paneViews() { return [this.paneView]; }

  queryHit(x: number, y: number): DarkPoolMapHit | null {
    if (!this.chartApi || !this.candleSeries || !this.renderData) return null;
    let closest: DarkPoolMapHit | null = null;
    let distance = Number.POSITIVE_INFINITY;
    for (const print of this.renderData.prints.slice(-this.renderData.maximumVisibleCircles)) {
      const px = this.chartApi.timeScale().timeToCoordinate(Math.floor(print.tradeTimeMs / 1_000) as Time);
      const py = this.candleSeries.priceToCoordinate(print.mappedPrice);
      if (px === null || py === null) continue;
      const next = Math.hypot(Number(px) - x, Number(py) - y);
      if (next < distance && next <= this.renderData.maximumRadius + 8) { distance = next; closest = { x: Number(px), y: Number(py), print }; }
    }
    if (closest) return closest;
    for (const zone of this.renderData.zones) {
      const py = this.candleSeries.priceToCoordinate(zone.weightedPrice);
      if (py === null) continue;
      const next = Math.abs(Number(py) - y);
      if (next < distance && next <= 10) { distance = next; closest = { x, y: Number(py), zone, level: this.renderData.levels.find((level) => zone.memberLevelIds.includes(level.id)) }; }
    }
    return closest;
  }
}
