import type { IChartApi, ISeriesPrimitive, ISeriesPrimitivePaneRenderer, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "@/lib/lightweightChartsCompat";
import type { StopSpotterFrame, StopSpotterSettings } from "@/lib/stopSpotter";
type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];
type RenderData = { frame: StopSpotterFrame; settings: StopSpotterSettings };

class Renderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: StopSpotterPrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const data = this.primitive.data(), chart = this.primitive.chart(), series = this.primitive.series();
    if (!data || !chart || !series) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save(); context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();
      context.lineWidth = data.settings.lineWidth;
      context.setLineDash(data.settings.lineStyle === "dashed" ? [5, 3] : data.settings.lineStyle === "dotted" ? [2, 2] : []);
      for (const marker of data.frame.markers) {
        const x = chart.timeScale().timeToCoordinate(Math.floor(marker.timestamp / 1_000) as Time);
        const y = series.priceToCoordinate(marker.priceTick * data.frame.tickSize);
        if (x === null || y === null) continue;
        const color = marker.side === "buy" ? data.settings.buyColor : data.settings.sellColor;
        const size = Math.max(5, 4 + data.settings.lineWidth * 2);
        const cx = Number(x), cy = Number(y);
        context.strokeStyle = color; context.fillStyle = color; context.globalAlpha = marker.developing ? 0.65 : 1;
        context.beginPath();
        if (data.settings.markerStyle === "circle") context.arc(cx, cy, size / 2, 0, Math.PI * 2);
        else if (data.settings.markerStyle === "diamond") { context.moveTo(cx, cy - size / 2); context.lineTo(cx + size / 2, cy); context.lineTo(cx, cy + size / 2); context.lineTo(cx - size / 2, cy); context.closePath(); }
        else if (data.settings.markerStyle === "triangle") { context.moveTo(cx, marker.side === "buy" ? cy + size / 2 : cy - size / 2); context.lineTo(cx + size / 2, marker.side === "buy" ? cy - size / 2 : cy + size / 2); context.lineTo(cx - size / 2, marker.side === "buy" ? cy - size / 2 : cy + size / 2); context.closePath(); }
        else if (data.settings.markerStyle === "cross") { context.moveTo(cx - size / 2, cy - size / 2); context.lineTo(cx + size / 2, cy + size / 2); context.moveTo(cx + size / 2, cy - size / 2); context.lineTo(cx - size / 2, cy + size / 2); }
        else context.rect(cx - size / 2, cy - size / 2, size, size);
        if (data.settings.markerStyle === "cross") context.stroke(); else { context.fill(); context.stroke(); }
        const labels = [data.settings.showNameLabel ? data.settings.shortName || "Stop Run" : "", data.settings.showValueLabel ? Math.round(marker.volume).toLocaleString() : ""].filter(Boolean);
        if (marker.contracts !== null) labels.push(`${marker.contracts} contracts`);
        if (labels.length) {
          const text = labels.join(" · ");
          context.font = `${marker.contracts !== null ? data.settings.contractFontSize : 9}px monospace`;
          context.textAlign = "center";
          context.textBaseline = marker.side === "buy" ? "bottom" : "top";
          const labelY = cy + (marker.side === "buy" ? -size : size);
          const width = context.measureText(text).width + 6;
          if (data.settings.nameBackground || data.settings.valueBackground || marker.contracts !== null) {
            context.fillStyle = marker.contracts !== null ? data.settings.contractBackgroundColor : "rgba(0,0,0,0.58)";
            context.fillRect(cx - width / 2, marker.side === "buy" ? labelY - 13 : labelY, width, 13);
          }
          context.fillStyle = marker.contracts !== null ? (marker.side === "buy" ? data.settings.contractBuyTextColor : data.settings.contractSellTextColor) : color;
          context.fillText(text, cx, marker.side === "buy" ? labelY - 1 : labelY + 1);
        }
      }
      context.globalAlpha = 1; context.restore();
    });
  }
}
class PaneView implements ISeriesPrimitivePaneView { private rendererValue: Renderer; constructor(primitive: StopSpotterPrimitive) { this.rendererValue = new Renderer(primitive); } zOrder() { return "top" as const; } renderer() { return this.rendererValue; } }
export class StopSpotterPrimitive implements ISeriesPrimitive<Time> {
  private chartApi: IChartApi | null = null; private seriesApi: CandleSeriesApi | null = null; private redraw: (() => void) | null = null; private renderData: RenderData | null = null; private view = new PaneView(this);
  attached(parameter: SeriesAttachedParameter<Time, "Candlestick">) { this.chartApi = parameter.chart as IChartApi; this.seriesApi = parameter.series; this.redraw = parameter.requestUpdate; }
  detached() { this.chartApi = null; this.seriesApi = null; this.redraw = null; }
  paneViews() { return [this.view]; } update(data: RenderData | null) { this.renderData = data; this.redraw?.(); } data() { return this.renderData; } chart() { return this.chartApi; } series() { return this.seriesApi; }
}
