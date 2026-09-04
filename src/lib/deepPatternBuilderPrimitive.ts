import type { IChartApi, ISeriesPrimitive, ISeriesPrimitivePaneRenderer, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "@/lib/lightweightChartsCompat";
import type { DeepPatternBuilderSettings, PatternSignal } from "./deepPatternBuilder";

type SeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];
type Model = { signals: PatternSignal[]; settings: DeepPatternBuilderSettings; background: string };
const alpha = (color: string, opacity: number) => {
  if (!color.startsWith("#")) return color;
  const raw = color.slice(1); const value = raw.length === 3 ? raw.split("").map((x) => x + x).join("") : raw;
  return `rgba(${parseInt(value.slice(0, 2), 16)},${parseInt(value.slice(2, 4), 16)},${parseInt(value.slice(4, 6), 16)},${opacity})`;
};
class Renderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: DeepPatternBuilderPrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const model = this.primitive.model(); const chart = this.primitive.chart(); const series = this.primitive.series();
    if (!model || !chart || !series) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save(); context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();
      for (const signal of model.signals) {
        const x = chart.timeScale().timeToCoordinate(Math.floor(signal.timestamp / 1000) as Time); const y = series.priceToCoordinate(signal.price);
        if (x === null || y === null) continue;
        if (model.settings.plotMode !== "marker") {
          context.fillStyle = alpha(model.settings.backgroundColor, model.settings.backgroundOpacity / 100);
          context.fillRect(Number(x) - 3, 0, 6, mediaSize.height);
        }
        if (model.settings.plotMode !== "background") {
          const size = model.settings.markerSize;
          context.fillStyle = model.settings.markerColor; context.strokeStyle = model.background; context.lineWidth = 1.5;
          context.beginPath(); context.moveTo(Number(x), Number(y) - size); context.lineTo(Number(x) + size, Number(y)); context.lineTo(Number(x), Number(y) + size); context.lineTo(Number(x) - size, Number(y)); context.closePath(); context.fill(); context.stroke();
        }
      }
      context.restore();
    });
  }
}
class View implements ISeriesPrimitivePaneView { constructor(private readonly primitive: DeepPatternBuilderPrimitive) {} zOrder() { return "top" as const; } renderer() { return new Renderer(this.primitive); } }
export class DeepPatternBuilderPrimitive implements ISeriesPrimitive<Time> {
  private chartApi: IChartApi | null = null; private seriesApi: SeriesApi | null = null; private redraw: (() => void) | null = null; private renderModel: Model | null = null; private view = new View(this);
  attached(p: SeriesAttachedParameter<Time, "Candlestick">) { this.chartApi = p.chart as IChartApi; this.seriesApi = p.series; this.redraw = p.requestUpdate; }
  detached() { this.chartApi = null; this.seriesApi = null; this.redraw = null; }
  paneViews() { return [this.view]; }
  update(model: Model | null) { this.renderModel = model; this.redraw?.(); }
  model() { return this.renderModel; } chart() { return this.chartApi; } series() { return this.seriesApi; }
}
