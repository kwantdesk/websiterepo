import type { IChartApi, ISeriesPrimitive, ISeriesPrimitivePaneRenderer, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "@/lib/lightweightChartsCompat";
import type { DynamicPocFrame, DynamicPocSettings } from "./dynamicPoc";
type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];
type RenderData = { frame: DynamicPocFrame; settings: DynamicPocSettings };

class Renderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: DynamicPocPrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const data = this.primitive.data(), chart = this.primitive.chart(), series = this.primitive.series();
    if (!data || !chart || !series) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const { frame, settings } = data;
      const definitions = [
        { show: settings.showPoc, color: settings.pocColor, width: settings.lineWidth, offset: null as number | null, sign: 0 },
        ...([0, 1, 2] as const).flatMap((offset) => [1, -1].map((sign) => ({
          show: [settings.showFirstEnvelope, settings.showSecondEnvelope, settings.showThirdEnvelope][offset],
          color: [settings.firstEnvelopeColor, settings.secondEnvelopeColor, settings.thirdEnvelopeColor][offset],
          width: settings.envelopeLineWidth, offset, sign,
        }))),
      ];
      context.save(); context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();
      for (const definition of definitions) {
        if (!definition.show) continue;
        context.strokeStyle = definition.color; context.lineWidth = definition.width; context.beginPath();
        let active = false;
        for (const point of frame.points) {
          if (point.pocTick === null || (definition.offset !== null && !point.envelopes)) { active = false; continue; }
          const tick = point.pocTick + (definition.offset === null ? 0 : definition.sign * point.envelopes![definition.offset]);
          const x = chart.timeScale().timeToCoordinate(Math.floor(point.timestamp / 1_000) as Time);
          const y = series.priceToCoordinate(tick * frame.tickSize);
          if (x === null || y === null) { active = false; continue; }
          if (!active) { context.moveTo(Number(x), Number(y)); active = true; } else context.lineTo(Number(x), Number(y));
        }
        context.stroke();
      }
      context.restore();
    });
  }
}
class PaneView implements ISeriesPrimitivePaneView { private rendererValue: Renderer; constructor(primitive: DynamicPocPrimitive) { this.rendererValue = new Renderer(primitive); } zOrder() { return "bottom" as const; } renderer() { return this.rendererValue; } }
export class DynamicPocPrimitive implements ISeriesPrimitive<Time> {
  private chartApi: IChartApi | null = null; private seriesApi: CandleSeriesApi | null = null; private redraw: (() => void) | null = null; private renderData: RenderData | null = null; private view = new PaneView(this);
  attached(parameter: SeriesAttachedParameter<Time, "Candlestick">) { this.chartApi = parameter.chart as IChartApi; this.seriesApi = parameter.series; this.redraw = parameter.requestUpdate; }
  detached() { this.chartApi = null; this.seriesApi = null; this.redraw = null; }
  paneViews() { return [this.view]; } update(data: RenderData | null) { this.renderData = data; this.redraw?.(); } data() { return this.renderData; } chart() { return this.chartApi; } series() { return this.seriesApi; }
}

