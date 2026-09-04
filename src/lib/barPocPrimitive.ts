import type {
  IChartApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import type { BarPocFrame, BarPocSettings } from "./barPocIndicator";

type RenderData = { frame: BarPocFrame; settings: BarPocSettings };
type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];

const rgba = (hex: string, alpha: number) => {
  const source = hex.replace("#", "");
  const value = source.length === 3 ? source.split("").map((part) => part + part).join("") : source;
  const red = Number.parseInt(value.slice(0, 2), 16) || 0;
  const green = Number.parseInt(value.slice(2, 4), 16) || 0;
  const blue = Number.parseInt(value.slice(4, 6), 16) || 0;
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, alpha))})`;
};

function durationLabel(milliseconds: number) {
  const minutes = Math.max(0, Math.floor(milliseconds / 60_000));
  if (minutes >= 1_440) return `${Math.floor(minutes / 1_440)}d ${Math.floor((minutes % 1_440) / 60)}h`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
}

class BarPocRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: BarPocPrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const data = this.primitive.data();
    const chart = this.primitive.chart();
    const series = this.primitive.series();
    if (!data || !chart || !series) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const { frame, settings } = data;
      const toX = (timestamp: number) => chart.timeScale().timeToCoordinate(Math.floor(timestamp / 1_000) as Time);
      const toY = (tick: number) => series.priceToCoordinate(tick * frame.tickSize);
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();
      for (const level of frame.levels) {
        const x1 = toX(level.barStartMs);
        const x2 = toX(level.barEndMs);
        const y = toY(level.priceTick);
        if (x1 === null || y === null) continue;
        const right = x2 === null ? Number(x1) + 6 : Math.max(Number(x1) + 3, Number(x2));
        const nextY = toY(level.priceTick + 1);
        const rowHeight = Math.max(3, Math.abs(Number(nextY ?? Number(y) - 5) - Number(y)));
        const color = level.direction === "ask" ? settings.askColor : settings.bidColor;
        if (settings.showRectangle) {
          if (settings.showBackground) {
            context.fillStyle = rgba(color, settings.backgroundOpacity / 100);
            context.fillRect(Number(x1), Number(y) - rowHeight / 2, right - Number(x1), rowHeight);
          }
          context.strokeStyle = rgba(color, 0.95);
          context.lineWidth = settings.rectangleLineWidth;
          context.strokeRect(Number(x1), Number(y) - rowHeight / 2, right - Number(x1), rowHeight);
        }
        if (!settings.extendPoc || (level.triggered && settings.hideLineOnBreakout)) continue;
        const extensionX = level.triggered || settings.maxBarsExtension > 0 ? toX(level.extensionEndMs) : mediaSize.width;
        const lineRight = extensionX === null ? mediaSize.width : Number(extensionX);
        context.strokeStyle = rgba(color, level.triggered ? 0.5 : 0.88);
        context.lineWidth = settings.extensionLineWidth;
        context.setLineDash(level.triggered ? [3, 3] : []);
        context.beginPath();
        context.moveTo(right, Number(y));
        context.lineTo(Math.max(right, lineRight), Number(y));
        context.stroke();
        context.setLineDash([]);
        if (settings.showDuration && lineRight - right > 26) {
          context.fillStyle = rgba(settings.durationTextColor, 0.95);
          context.font = `600 ${settings.durationFontSize}px JetBrains Mono, monospace`;
          context.textAlign = "right";
          context.textBaseline = "bottom";
          context.fillText(durationLabel(level.extensionEndMs - level.barEndMs), Math.min(mediaSize.width - 3, lineRight - 3), Number(y) - 2);
        }
      }
      context.restore();
    });
  }
}

class BarPocPaneView implements ISeriesPrimitivePaneView {
  private readonly rendererValue: BarPocRenderer;
  constructor(primitive: BarPocPrimitive) { this.rendererValue = new BarPocRenderer(primitive); }
  zOrder() { return "bottom" as const; }
  renderer() { return this.rendererValue; }
}

export class BarPocPrimitive implements ISeriesPrimitive<Time> {
  private chartApi: IChartApi | null = null;
  private seriesApi: CandleSeriesApi | null = null;
  private redraw: (() => void) | null = null;
  private renderData: RenderData | null = null;
  private readonly view = new BarPocPaneView(this);
  attached(parameter: SeriesAttachedParameter<Time, "Candlestick">) { this.chartApi = parameter.chart as IChartApi; this.seriesApi = parameter.series; this.redraw = parameter.requestUpdate; }
  detached() { this.chartApi = null; this.seriesApi = null; this.redraw = null; }
  paneViews() { return [this.view]; }
  update(data: RenderData | null) { this.renderData = data; this.redraw?.(); }
  data() { return this.renderData; }
  chart() { return this.chartApi; }
  series() { return this.seriesApi; }
}
