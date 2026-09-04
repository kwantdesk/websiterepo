import type { IChartApi, ISeriesPrimitive, ISeriesPrimitivePaneRenderer, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "@/lib/lightweightChartsCompat";
import type { DeepVTrackerFrame, DeepVTrackerSettings } from "@/lib/deepVTracker";
type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];
type RenderData = { frame: DeepVTrackerFrame; settings: DeepVTrackerSettings };

const lineDash = (kind: "control" | "extreme") => kind === "control" ? [] : [5, 4];

class Renderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: DeepVTrackerPrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const data = this.primitive.data(), chart = this.primitive.chart(), series = this.primitive.series();
    if (!data || !chart || !series) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save(); context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();
      for (const pattern of data.frame.patterns) {
        const x = chart.timeScale().timeToCoordinate(Math.floor(pattern.timestamp / 1_000) as Time);
        const y1 = series.priceToCoordinate(pattern.highTick * data.frame.tickSize);
        const y2 = series.priceToCoordinate(pattern.lowTick * data.frame.tickSize);
        if (x === null || y1 === null || y2 === null) continue;
        const spacing = Math.max(4, chart.timeScale().options().barSpacing ?? 6);
        const color = pattern.kind === "acceleration" ? data.settings.accelerationColor : pattern.kind === "exhaustion" ? data.settings.exhaustionColor : data.settings.slowdownColor;
        context.globalAlpha = data.settings.patternOpacity / 100;
        context.fillStyle = color;
        context.fillRect(Number(x) - spacing * 0.46, Math.min(Number(y1), Number(y2)), spacing * 0.92, Math.max(2, Math.abs(Number(y2) - Number(y1))));
        context.globalAlpha = 1;
        if (pattern.kind !== "acceleration") {
          context.fillStyle = color;
          context.font = `${data.settings.textSize}px ui-monospace, monospace`;
          context.textAlign = "center";
          context.fillText(pattern.kind === "exhaustion" ? "E" : "S", Number(x), pattern.side === "buy" ? Math.min(Number(y1), Number(y2)) - 3 : Math.max(Number(y1), Number(y2)) + data.settings.textSize);
        }
      }
      for (const level of data.frame.levels) {
        const startX = chart.timeScale().timeToCoordinate(Math.floor(level.timestamp / 1_000) as Time);
        const endX = level.extendsToFarRight
          ? mediaSize.width
          : chart.timeScale().timeToCoordinate(Math.floor(level.endTimestamp / 1_000) as Time);
        const controlY = series.priceToCoordinate(level.controlTick * data.frame.tickSize);
        const extremeY = series.priceToCoordinate(level.extremeTick * data.frame.tickSize);
        if (startX === null || endX === null || controlY === null || extremeY === null) continue;
        const color = level.side === "ask" ? data.settings.askColor : data.settings.bidColor;
        const label = level.kind === "pressure" ? "P" : "A";
        context.strokeStyle = color; context.fillStyle = color; context.globalAlpha = 0.95;
        for (const [kind, y, width] of [["control", Number(controlY), data.settings.controlLineWidth], ["extreme", Number(extremeY), data.settings.extremeLineWidth]] as const) {
          if (width <= 0) continue;
          context.lineWidth = width; context.setLineDash(lineDash(kind)); context.beginPath(); context.moveTo(Number(startX), y); context.lineTo(Number(endX), y); context.stroke();
        }
        context.setLineDash([]); context.font = `${data.settings.textSize}px ui-monospace, monospace`; context.textAlign = "left";
        context.fillText(`${label}C`, Number(startX) + 3, Number(controlY) - 3);
        context.fillText(`${label}E`, Number(startX) + 3, Number(extremeY) - 3);
      }
      context.restore();
    });
  }
}
class PaneView implements ISeriesPrimitivePaneView { private rendererValue: Renderer; constructor(primitive: DeepVTrackerPrimitive) { this.rendererValue = new Renderer(primitive); } zOrder() { return "top" as const; } renderer() { return this.rendererValue; } }
export class DeepVTrackerPrimitive implements ISeriesPrimitive<Time> {
  private chartApi: IChartApi | null = null; private seriesApi: CandleSeriesApi | null = null; private redraw: (() => void) | null = null; private renderData: RenderData | null = null; private view = new PaneView(this);
  attached(parameter: SeriesAttachedParameter<Time, "Candlestick">) { this.chartApi = parameter.chart as IChartApi; this.seriesApi = parameter.series; this.redraw = parameter.requestUpdate; }
  detached() { this.chartApi = null; this.seriesApi = null; this.redraw = null; }
  paneViews() { return [this.view]; } update(data: RenderData | null) { this.renderData = data; this.redraw?.(); } data() { return this.renderData; } chart() { return this.chartApi; } series() { return this.seriesApi; }
}
