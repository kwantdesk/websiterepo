import type {
  IChartApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import type { ChartOverlaySeries } from "./chartOverlays";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];
type Palette = { upColor: string; downColor: string };

function alpha(color: string, opacity: number) {
  if (!color.startsWith("#")) return color;
  const raw = color.slice(1);
  const value = raw.length === 3 ? raw.split("").map((part) => part + part).join("") : raw;
  return `rgba(${parseInt(value.slice(0, 2), 16)},${parseInt(value.slice(2, 4), 16)},${parseInt(value.slice(4, 6), 16)},${opacity})`;
}

class Renderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: OverlayVolumeWidthPrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const model = this.primitive.model();
    const chart = this.primitive.chart();
    const series = this.primitive.series();
    if (!model || !chart || !series || !model.overlay.widthBasedOnVolume) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const { overlay, palette } = model;
      const candles = overlay.candles.filter((candle) => Number.isFinite(candle.timestamp));
      if (!candles.length) return;
      const volumes = candles.map((candle) => Math.max(0, Number(candle.volume ?? 0)));
      const maxVolume = Math.max(1, ...volumes);
      const points = candles.map((candle) => ({
        candle,
        x: chart.timeScale().timeToCoordinate(Math.floor(candle.timestamp / 1_000) as Time),
      })).filter((point) => point.x !== null);
      const spacings: number[] = [];
      for (let index = 1; index < points.length; index += 1) {
        const gap = Number(points[index].x) - Number(points[index - 1].x);
        if (gap > 0 && gap < 80) spacings.push(gap);
      }
      spacings.sort((left, right) => left - right);
      const barSpace = spacings[Math.floor(spacings.length / 2)] ?? 8;
      const maximumWidth = Math.max(1, barSpace * 0.82 * overlay.maxVolumeWidthPercent / 100);
      const opacity = overlay.opacity / 100;
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();
      points.forEach(({ candle, x }, pointIndex) => {
        const open = series.priceToCoordinate(candle.open);
        const high = series.priceToCoordinate(candle.high);
        const low = series.priceToCoordinate(candle.low);
        const close = series.priceToCoordinate(candle.close);
        if ([open, high, low, close].some((value) => value === null)) return;
        const delta = Number(candle.delta ?? ((candle.askVolume ?? 0) - (candle.bidVolume ?? 0)));
        const isUp = overlay.colorBasedOnDelta ? delta >= 0 : candle.close >= candle.open;
        const color = overlay.useThemeColors
          ? (isUp ? palette.upColor : palette.downColor)
          : (isUp ? overlay.upColor : overlay.downColor);
        const width = Math.max(1, maximumWidth * Math.sqrt(volumes[pointIndex] / maxVolume));
        const center = Number(x);
        context.strokeStyle = alpha(color, opacity);
        context.fillStyle = alpha(color, opacity);
        context.lineWidth = overlay.borderWidth;
        if (overlay.style !== "candlebody") {
          context.beginPath();
          context.moveTo(center, Number(high));
          context.lineTo(center, Number(low));
          context.stroke();
        }
        if (overlay.style === "ohlc") {
          context.beginPath();
          context.moveTo(center, Number(high));
          context.lineTo(center, Number(low));
          context.moveTo(center - width / 2, Number(open));
          context.lineTo(center, Number(open));
          context.moveTo(center, Number(close));
          context.lineTo(center + width / 2, Number(close));
          context.stroke();
          return;
        }
        const top = Math.min(Number(open), Number(close));
        const height = Math.max(1, Math.abs(Number(close) - Number(open)));
        if (overlay.filled) context.fillRect(center - width / 2, top, width, height);
        if (overlay.openCloseBorder || !overlay.filled) context.strokeRect(center - width / 2, top, width, height);
      });
      context.restore();
    });
  }
}

class View implements ISeriesPrimitivePaneView {
  private readonly rendererValue: Renderer;
  constructor(primitive: OverlayVolumeWidthPrimitive) { this.rendererValue = new Renderer(primitive); }
  zOrder() { return "normal" as const; }
  renderer() { return this.rendererValue; }
}

export class OverlayVolumeWidthPrimitive implements ISeriesPrimitive<Time> {
  private chartApi: IChartApi | null = null;
  private seriesApi: CandleSeriesApi | null = null;
  private redraw: (() => void) | null = null;
  private renderModel: { overlay: ChartOverlaySeries; palette: Palette } | null = null;
  private readonly view = new View(this);
  attached(parameter: SeriesAttachedParameter<Time, "Candlestick">) {
    this.chartApi = parameter.chart as IChartApi;
    this.seriesApi = parameter.series;
    this.redraw = parameter.requestUpdate;
  }
  detached() { this.chartApi = null; this.seriesApi = null; this.redraw = null; }
  paneViews() { return [this.view]; }
  update(model: { overlay: ChartOverlaySeries; palette: Palette } | null) { this.renderModel = model; this.redraw?.(); }
  model() { return this.renderModel; }
  chart() { return this.chartApi; }
  series() { return this.seriesApi; }
}
