import type { Candle } from "@/lib/backtester";
import type { KwantStatsTable } from "@/lib/kwantStats";
import type { IChartApi, ISeriesPrimitive, ISeriesPrimitivePaneRenderer, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "@/lib/lightweightChartsCompat";

type LineSeriesApi = SeriesAttachedParameter<Time, "Line">["series"];

export type OnCandleStatsModel = {
  candles: Candle[];
  table: KwantStatsTable;
  tickSize: number;
  fontSize: number;
  smallerFontSize: number;
  autoTextFormat: boolean;
  absoluteSign: boolean;
  opacityBasedOnRatio: boolean;
  maxRatio: number;
  colorTextBasedOnDelta: boolean;
  tickOffset: number;
  pricePlot: "high" | "low" | "center" | "price-slope" | "delta-sign";
  backgroundColor: string;
};

function rgba(color: string, opacity: number) {
  const match = color.match(/^#([\da-f]{6})$/i);
  if (!match) return color;
  const value = Number.parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${Math.min(1, Math.max(0, opacity))})`;
}

function compact(value: number, absolute: boolean) {
  const next = absolute ? Math.abs(value) : value;
  const magnitude = Math.abs(next);
  if (magnitude >= 1_000_000) return `${(next / 1_000_000).toFixed(1)}M`;
  if (magnitude >= 1_000) return `${(next / 1_000).toFixed(1)}K`;
  return Number.isInteger(next) ? String(next) : next.toFixed(1);
}

function formatValue(value: number, absolute: boolean, auto: boolean) {
  const next = absolute ? Math.abs(value) : value;
  return auto ? compact(value, absolute) : next.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

class Renderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly owner: OnCandleStatsPrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const model = this.owner.model();
    const chart = this.owner.chart();
    const series = this.owner.series();
    if (!model || !chart || !series || !model.table.metrics.length) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const rows = new Map(model.table.bars.map((bar) => [bar.time, bar]));
      const points = model.candles.map((candle) => ({
        candle,
        row: rows.get(candle.timestamp / 1_000),
        x: chart.timeScale().timeToCoordinate(Math.floor(candle.timestamp / 1_000) as Time),
      })).filter((point) => point.row && point.x !== null);
      if (!points.length) return;
      const gaps: number[] = [];
      for (let index = 1; index < points.length; index += 1) {
        const gap = Number(points[index].x) - Number(points[index - 1].x);
        if (gap > 0 && gap < 120) gaps.push(gap);
      }
      gaps.sort((a, b) => a - b);
      const spacing = gaps[Math.floor(gaps.length / 2)] ?? 12;
      const fontSize = Math.max(model.smallerFontSize, Math.min(model.fontSize, spacing * 0.38));
      if (fontSize < model.smallerFontSize) return;
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();
      context.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      for (const point of points) {
        const row = point.row!;
        const metrics = model.table.metrics.flatMap((metric) => {
          const value = row.values[metric.key];
          if (value === null || !Number.isFinite(value)) return [];
          const formattedValue = formatValue(value, model.absoluteSign, model.autoTextFormat);
          const formatted = metric.format === "percent" ? `${formattedValue}%`
            : metric.format === "seconds" ? `${formattedValue}s`
              : metric.format === "ratio" ? `${formattedValue}x`
                : formattedValue;
          return [{ metric, value, text: `${metric.label} ${formatted}` }];
        });
        if (!metrics.length) continue;
        const delta = Number(point.candle.delta ?? (Number(point.candle.askVolume ?? 0) - Number(point.candle.bidVolume ?? 0)));
        const anchor = model.pricePlot === "high" ? point.candle.high
          : model.pricePlot === "low" ? point.candle.low
            : model.pricePlot === "center" ? (point.candle.high + point.candle.low) / 2
              : model.pricePlot === "delta-sign" ? delta >= 0 ? point.candle.low : point.candle.high
                : point.candle.close >= point.candle.open ? point.candle.low : point.candle.high;
        const below = anchor <= (point.candle.high + point.candle.low) / 2;
        const y = series.priceToCoordinate(anchor + (below ? -1 : 1) * model.tickOffset * model.tickSize);
        if (y === null) continue;
        const lineHeight = fontSize + 3;
        const strings = metrics.map((entry) => entry.text);
        let width = 0;
        for (const value of strings) width = Math.max(width, context.measureText(value).width);
        const boxHeight = strings.length * lineHeight + 5;
        const top = below ? Number(y) + 3 : Number(y) - boxHeight - 3;
        if (top + boxHeight < 0 || top > mediaSize.height) continue;
        const ratio = Math.min(model.maxRatio, Math.abs(delta) / Math.max(1, Number(point.candle.volume ?? 0)) * 100);
        const opacity = model.opacityBasedOnRatio ? 0.18 + 0.62 * ratio / Math.max(1, model.maxRatio) : 0.72;
        context.fillStyle = rgba(model.backgroundColor, opacity);
        context.fillRect(Number(point.x) - width / 2 - 4, top, width + 8, boxHeight);
        strings.forEach((value, index) => {
          context.fillStyle = model.colorTextBasedOnDelta
            ? delta >= 0 ? model.table.positiveColor : model.table.negativeColor
            : model.table.textColor;
          context.fillText(value, Number(point.x), top + 3 + lineHeight * (index + 0.5));
        });
      }
      context.restore();
    });
  }
}

class View implements ISeriesPrimitivePaneView {
  private readonly rendererValue: Renderer;
  constructor(owner: OnCandleStatsPrimitive) { this.rendererValue = new Renderer(owner); }
  zOrder() { return "top" as const; }
  renderer() { return this.rendererValue; }
}

export class OnCandleStatsPrimitive implements ISeriesPrimitive<Time> {
  private chartApi: IChartApi | null = null;
  private seriesApi: LineSeriesApi | null = null;
  private redraw: (() => void) | null = null;
  private renderModel: OnCandleStatsModel | null = null;
  private readonly view = new View(this);
  attached(parameter: SeriesAttachedParameter<Time, "Line">) { this.chartApi = parameter.chart as IChartApi; this.seriesApi = parameter.series; this.redraw = parameter.requestUpdate; }
  detached() { this.chartApi = null; this.seriesApi = null; this.redraw = null; }
  paneViews() { return [this.view]; }
  update(model: OnCandleStatsModel | null) { this.renderModel = model; this.redraw?.(); }
  model() { return this.renderModel; }
  chart() { return this.chartApi; }
  series() { return this.seriesApi; }
}
