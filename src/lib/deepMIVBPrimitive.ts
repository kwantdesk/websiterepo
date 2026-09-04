import type { IChartApi, ISeriesPrimitive, ISeriesPrimitivePaneRenderer, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "@/lib/lightweightChartsCompat";
import type { DeepMIVBFrame, DeepMIVBSettings } from "./deepMIVB";

type SeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];
type Model = { frames: DeepMIVBFrame[]; settings: DeepMIVBSettings; tickSize: number };

function alpha(color: string, opacity: number) {
  if (!color.startsWith("#")) return color;
  const raw = color.slice(1); const value = raw.length === 3 ? raw.split("").map((x) => x + x).join("") : raw;
  return `rgba(${parseInt(value.slice(0, 2), 16)},${parseInt(value.slice(2, 4), 16)},${parseInt(value.slice(4, 6), 16)},${opacity})`;
}

class Renderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: DeepMIVBPrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const model = this.primitive.model(); const chart = this.primitive.chart(); const series = this.primitive.series();
    if (!model || !chart || !series) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const { settings, tickSize } = model;
      context.save(); context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();
      for (const [frameIndex, frame] of model.frames.entries()) {
        const x1 = chart.timeScale().timeToCoordinate(Math.floor(frame.rangeEndMs / 1000) as Time);
        const x2 = settings.extendToLiveEdge && frameIndex === model.frames.length - 1
          ? mediaSize.width
          : chart.timeScale().timeToCoordinate(Math.floor(frame.endMs / 1000) as Time);
        if (x1 === null) continue;
        const right = x2 === null ? mediaSize.width : Number(x2);
        const stateColor = frame.state === "positive" ? settings.positiveColor : frame.state === "negative" ? settings.negativeColor : settings.neutralColor;
        const drawLine = (price: number, color: string, dash: number[] = []) => {
          const y = series.priceToCoordinate(price); if (y === null) return;
          context.strokeStyle = alpha(color, 0.9); context.lineWidth = settings.lineWidth; context.setLineDash(dash);
          context.beginPath(); context.moveTo(Number(x1), Number(y)); context.lineTo(right, Number(y)); context.stroke(); context.setLineDash([]);
        };
        if (settings.showZones) {
          const zone = Math.max(tickSize, settings.zoneWidthTicks * tickSize);
          for (const price of [frame.high, frame.low]) {
            const top = series.priceToCoordinate(price + zone / 2); const bottom = series.priceToCoordinate(price - zone / 2);
            if (top !== null && bottom !== null) { context.fillStyle = alpha(stateColor, settings.zoneOpacity / 100); context.fillRect(Number(x1), Math.min(Number(top), Number(bottom)), right - Number(x1), Math.abs(Number(bottom) - Number(top))); }
          }
        }
        if (settings.showRange) { drawLine(frame.high, stateColor); drawLine(frame.middle, settings.neutralColor, [3, 3]); drawLine(frame.low, stateColor); }
        if (settings.showProtection) { drawLine(frame.protectionHigh, settings.negativeColor, [4, 3]); drawLine(frame.protectionLow, settings.negativeColor, [4, 3]); }
        if (settings.showAverage) { drawLine(frame.averageHigh, settings.positiveColor, [7, 3]); drawLine(frame.averageLow, settings.positiveColor, [7, 3]); }
        if (settings.showStandardDeviation) { drawLine(frame.deviationHigh, settings.neutralColor, [2, 3]); drawLine(frame.deviationLow, settings.neutralColor, [2, 3]); }
        if (settings.showSummary) {
          context.fillStyle = alpha(stateColor, 0.95); context.font = "600 9px JetBrains Mono, monospace"; context.textAlign = "left"; context.textBaseline = "top";
          const y = series.priceToCoordinate(frame.high); if (y !== null) context.fillText(`IVB ${settings.openingRangeMinutes} · ${frame.state.toUpperCase()} · N=${frame.sampleSessions}`, Number(x1) + 4, Number(y) + 4);
        }
      }
      context.restore();
    });
  }
}
class View implements ISeriesPrimitivePaneView { private rendererValue: Renderer; constructor(p: DeepMIVBPrimitive) { this.rendererValue = new Renderer(p); } zOrder() { return "bottom" as const; } renderer() { return this.rendererValue; } }
export class DeepMIVBPrimitive implements ISeriesPrimitive<Time> {
  private chartApi: IChartApi | null = null; private seriesApi: SeriesApi | null = null; private redraw: (() => void) | null = null; private renderModel: Model | null = null; private view = new View(this);
  attached(p: SeriesAttachedParameter<Time, "Candlestick">) { this.chartApi = p.chart as IChartApi; this.seriesApi = p.series; this.redraw = p.requestUpdate; }
  detached() { this.chartApi = null; this.seriesApi = null; this.redraw = null; }
  paneViews() { return [this.view]; }
  update(model: Model | null) { this.renderModel = model; this.redraw?.(); }
  model() { return this.renderModel; } chart() { return this.chartApi; } series() { return this.seriesApi; }
}
