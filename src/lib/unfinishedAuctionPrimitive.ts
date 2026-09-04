import type {
  IChartApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import type { UnfinishedAuctionFrame, UnfinishedAuctionSettings } from "@/lib/unfinishedAuction";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];

export type UnfinishedAuctionPrimitiveData = {
  frame: UnfinishedAuctionFrame;
  settings: UnfinishedAuctionSettings;
};

const rgba = (color: string, alpha: number) => {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const value = Number.parseInt(match[1], 16);
  return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${Math.max(0, Math.min(1, alpha))})`;
};

class Renderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: UnfinishedAuctionPrimitive) {}

  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const data = this.primitive.data();
    const chart = this.primitive.chart();
    const series = this.primitive.series();
    if (!data || !chart || !series) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const toX = (ms: number) => chart.timeScale().timeToCoordinate(Math.floor(ms / 1_000) as Time);
      const toY = (tick: number) => series.priceToCoordinate(tick * data.frame.tickSize);
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();
      for (const level of data.frame.levels) {
        const x1 = toX(level.sourceStartMs);
        const x2 = toX(level.sourceEndMs);
        const x3 = toX(level.extensionEndMs);
        const y = toY(level.priceTick);
        if (x1 === null || x2 === null || y === null) continue;
        const color = level.side === "high" ? data.settings.badHighColor : data.settings.badLowColor;
        const left = Number(x1);
        const right = Math.max(left + 2, Number(x2));
        const rowHeight = Math.max(3, Math.abs(Number(toY(level.priceTick + 1) ?? y) - Number(y)));
        context.lineWidth = Math.max(1, data.settings.lineWidth);
        context.strokeStyle = color;
        if (data.settings.showRectangle) {
          if (data.settings.showBackground) {
            context.fillStyle = rgba(color, data.settings.opacity / 100);
            context.fillRect(left, Number(y) - rowHeight / 2, right - left, rowHeight);
          }
          context.strokeRect(left, Number(y) - rowHeight / 2, right - left, rowHeight);
        }
        if (data.settings.extendLines && x3 !== null && Number(x3) > right) {
          context.setLineDash(level.state === "triggered" ? [3, 3] : []);
          context.globalAlpha = level.state === "triggered" ? 0.55 : 1;
          context.beginPath();
          context.moveTo(right, Number(y));
          context.lineTo(Number(x3), Number(y));
          context.stroke();
          context.setLineDash([]);
          context.globalAlpha = 1;
        }
      }
      context.restore();
    });
  }
}

class PaneView implements ISeriesPrimitivePaneView {
  private readonly rendererInstance: Renderer;
  constructor(primitive: UnfinishedAuctionPrimitive) { this.rendererInstance = new Renderer(primitive); }
  zOrder() { return "bottom" as const; }
  renderer() { return this.rendererInstance; }
}

export class UnfinishedAuctionPrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null;
  private chartApi: IChartApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderData: UnfinishedAuctionPrimitiveData | null = null;
  private readonly paneView = new PaneView(this);

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) {
    this.candleSeries = param.series;
    this.chartApi = param.chart as IChartApi;
    this.requestRedraw = param.requestUpdate;
  }
  detached() { this.candleSeries = null; this.chartApi = null; this.requestRedraw = null; }
  update(data: UnfinishedAuctionPrimitiveData | null) { this.renderData = data; this.requestRedraw?.(); }
  data() { return this.renderData; }
  series() { return this.candleSeries; }
  chart() { return this.chartApi; }
  paneViews() { return [this.paneView]; }
}

