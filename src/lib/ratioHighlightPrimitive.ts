import type {
  IChartApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import type { RatioHighlightFrame, RatioHighlightSettings } from "@/lib/ratioHighlight";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];
type RenderData = { frame: RatioHighlightFrame; settings: RatioHighlightSettings };

const rgba = (color: string, alpha: number) => {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const value = Number.parseInt(match[1], 16);
  return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${Math.max(0, Math.min(1, alpha))})`;
};

class Renderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: RatioHighlightPrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const data = this.primitive.data();
    const chart = this.primitive.chart();
    if (!data || !chart) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();
      for (const marker of data.frame.markers) {
        const start = chart.timeScale().timeToCoordinate(Math.floor(marker.startTime / 1_000) as Time);
        const end = chart.timeScale().timeToCoordinate(Math.floor(marker.endTime / 1_000) as Time);
        if (start === null) continue;
        const barSpacing = Math.abs(Number(end ?? start) - Number(start));
        const width = Math.max(3, Math.min(18, barSpacing > 0 ? barSpacing * 0.78 : 8));
        const color = marker.side === "high" ? data.settings.askColor : data.settings.bidColor;
        context.fillStyle = rgba(color, data.settings.opacity / 100);
        context.fillRect(Number(start) - width / 2, 0, width, mediaSize.height);
      }
      context.restore();
    });
  }
}

class PaneView implements ISeriesPrimitivePaneView {
  private readonly rendererInstance: Renderer;
  constructor(primitive: RatioHighlightPrimitive) { this.rendererInstance = new Renderer(primitive); }
  zOrder() { return "bottom" as const; }
  renderer() { return this.rendererInstance; }
}

export class RatioHighlightPrimitive implements ISeriesPrimitive<Time> {
  private chartApi: IChartApi | null = null;
  private seriesApi: CandleSeriesApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderData: RenderData | null = null;
  private readonly view = new PaneView(this);
  attached(parameter: SeriesAttachedParameter<Time, "Candlestick">) { this.chartApi = parameter.chart as IChartApi; this.seriesApi = parameter.series; this.requestRedraw = parameter.requestUpdate; }
  detached() { this.chartApi = null; this.seriesApi = null; this.requestRedraw = null; }
  paneViews() { return [this.view]; }
  update(data: RenderData | null) { this.renderData = data; this.requestRedraw?.(); }
  data() { return this.renderData; }
  chart() { return this.chartApi; }
  series() { return this.seriesApi; }
}
