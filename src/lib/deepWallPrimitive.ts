import type { IChartApi, ISeriesPrimitive, ISeriesPrimitivePaneRenderer, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "@/lib/lightweightChartsCompat";
import type { DeepWallFrame, DeepWallSettings } from "@/lib/deepWall";
type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];
type RenderData = { frame: DeepWallFrame; settings: DeepWallSettings };

class Renderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: DeepWallPrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const data = this.primitive.data(), chart = this.primitive.chart(), series = this.primitive.series();
    if (!data || !chart || !series) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save(); context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();
      context.globalAlpha = data.settings.opacity / 100; context.lineCap = "round"; context.lineWidth = data.settings.lineWidth;
      const spacing = Math.max(5, chart.timeScale().options().barSpacing ?? 6);
      const half = spacing * data.settings.markerWidthBars / 2;
      for (const marker of data.frame.markers) {
        const x = chart.timeScale().timeToCoordinate(Math.floor(marker.timestamp / 1_000) as Time);
        const y = series.priceToCoordinate(marker.priceTick * data.frame.tickSize);
        if (x === null || y === null) continue;
        context.strokeStyle = marker.side === "buy-wall" ? data.settings.buyWallColor : data.settings.sellWallColor;
        context.beginPath(); context.moveTo(Number(x) - half, Number(y)); context.lineTo(Number(x) + half, Number(y)); context.stroke();
      }
      context.restore();
    });
  }
}
class PaneView implements ISeriesPrimitivePaneView { private rendererValue: Renderer; constructor(primitive: DeepWallPrimitive) { this.rendererValue = new Renderer(primitive); } zOrder() { return "top" as const; } renderer() { return this.rendererValue; } }
export class DeepWallPrimitive implements ISeriesPrimitive<Time> {
  private chartApi: IChartApi | null = null; private seriesApi: CandleSeriesApi | null = null; private redraw: (() => void) | null = null; private renderData: RenderData | null = null; private view = new PaneView(this);
  attached(parameter: SeriesAttachedParameter<Time, "Candlestick">) { this.chartApi = parameter.chart as IChartApi; this.seriesApi = parameter.series; this.redraw = parameter.requestUpdate; }
  detached() { this.chartApi = null; this.seriesApi = null; this.redraw = null; }
  paneViews() { return [this.view]; } update(data: RenderData | null) { this.renderData = data; this.redraw?.(); } data() { return this.renderData; } chart() { return this.chartApi; } series() { return this.seriesApi; }
}
