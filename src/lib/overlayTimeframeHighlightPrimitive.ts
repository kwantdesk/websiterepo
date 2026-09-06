import type { ISeriesPrimitive, ISeriesPrimitivePaneRenderer, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "./lightweightChartsCompat";
import type { OverlayTimeframeHighlightModel } from "./overlayTimeframeHighlight";

type LineSeries = SeriesAttachedParameter<Time, "Line">["series"];

function withAlpha(color: string, opacity: number) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const value = match[1];
  return `rgba(${parseInt(value.slice(0, 2), 16)},${parseInt(value.slice(2, 4), 16)},${parseInt(value.slice(4, 6), 16)},${Math.max(0, Math.min(1, opacity))})`;
}

const COMPACT_NUMBER = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const compact = (value: number) => COMPACT_NUMBER.format(value);

class Renderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly owner: OverlayTimeframeHighlightPrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const chart = this.owner.chart(); const series = this.owner.series(); const model = this.owner.model();
    if (!chart || !series || !model) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const { buckets, settings, colors } = model;
      const points = buckets.map(bucket => ({
        bucket,
        start: chart.timeScale().timeToCoordinate(Math.floor(bucket.firstTime / 1_000) as Time),
        last: chart.timeScale().timeToCoordinate(Math.floor(bucket.lastTime / 1_000) as Time),
      })).filter(point => point.start !== null && point.last !== null);
      if (!points.length) return;
      const sourceWidths = points.map(point => Math.abs(Number(point.last) - Number(point.start))).filter(width => width > 0);
      const fallbackWidth = Math.max(5, (sourceWidths.sort((a, b) => a - b)[Math.floor(sourceWidths.length / 2)] ?? 8) * 0.08);
      const deltas = buckets.map(bucket => bucket.askVolume - bucket.bidVolume);
      const mean = deltas.reduce((sum, value) => sum + value, 0) / Math.max(1, deltas.length);
      const deviation = Math.sqrt(deltas.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, deltas.length));
      context.save(); context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();
      points.forEach(({ bucket, start, last }, index) => {
        const x1 = Number(start); const x2 = Math.max(x1 + fallbackWidth, Number(last) + fallbackWidth);
        if (x2 < 0 || x1 > mediaSize.width) return;
        const open = series.priceToCoordinate(bucket.open); const high = series.priceToCoordinate(bucket.high);
        const low = series.priceToCoordinate(bucket.low); const close = series.priceToCoordinate(bucket.close);
        if ([open, high, low, close].some(value => value === null)) return;
        const delta = bucket.askVolume - bucket.bidVolume;
        const up = settings.colorBasedOnDelta && bucket.askVolume + bucket.bidVolume > 0 ? delta >= 0 : bucket.close >= bucket.open;
        const base = up ? colors.up : colors.down;
        const intensity = settings.colorMode === "fading" && deviation > 0
          ? Math.max(0.2, Math.min(1, Math.abs(delta - mean) / (deviation * settings.standardDeviation))) : 1;
        if (settings.showBackground) {
          context.fillStyle = withAlpha(base, settings.bodyOpacity / 100 * 0.35 * intensity);
          context.fillRect(x1, Number(high), Math.max(1, x2 - x1), Math.max(1, Number(low) - Number(high)));
        }
        const center = (x1 + x2) / 2;
        context.strokeStyle = withAlpha(base, settings.shadowOpacity / 100 * intensity); context.lineWidth = settings.borderWidth;
        context.beginPath(); context.moveTo(center, Number(high)); context.lineTo(center, Number(low)); context.stroke();
        context.fillStyle = withAlpha(base, settings.bodyOpacity / 100 * intensity);
        context.strokeStyle = withAlpha(base, Math.max(settings.bodyOpacity, 55) / 100 * intensity);
        const top = Math.min(Number(open), Number(close)); const height = Math.max(1, Math.abs(Number(close) - Number(open)));
        context.fillRect(x1, top, Math.max(1, x2 - x1), height); context.strokeRect(x1, top, Math.max(1, x2 - x1), height);

        if (settings.targetEnabled) {
          const highY = Number(high); const lowY = Number(low); const targetStart = settings.extendLineLeft ? 0 : x1;
          context.lineWidth = settings.targetLineWidth;
          context.setLineDash(settings.targetLineStyle === "dotted" ? [1, 4] : settings.targetLineStyle === "dashed" ? [6, 5] : []);
          context.strokeStyle = colors.high; context.beginPath(); context.moveTo(targetStart, highY); context.lineTo(x2, highY); context.stroke();
          context.strokeStyle = colors.low; context.beginPath(); context.moveTo(targetStart, lowY); context.lineTo(x2, lowY); context.stroke();
          context.setLineDash([]);
          if (settings.showTargetText) {
            context.font = `700 ${settings.textSize}px 'JetBrains Mono', monospace`; context.textBaseline = "bottom";
            context.fillStyle = colors.text; context.fillText("HTF High", Math.max(2, x2 - context.measureText("HTF High").width - 3), highY - 2);
            context.textBaseline = "top"; context.fillText("HTF Low", Math.max(2, x2 - context.measureText("HTF Low").width - 3), lowY + 2);
          }
        }
        const summaryFirst = Math.max(0, points.length - settings.summaryToView);
        if (settings.summaryEnabled && index >= summaryFirst) {
          const rows: string[] = [];
          if (settings.volumeSummary) rows.push(`V ${compact(bucket.volume)}`);
          if (settings.tradeSummary) rows.push(`T ${compact(bucket.trades)}`);
          if (bucket.askVolume + bucket.bidVolume > 0) rows.push(`A ${compact(bucket.askVolume)}  B ${compact(bucket.bidVolume)}`);
          context.font = `600 ${settings.summaryTextSize}px 'JetBrains Mono', monospace`; context.textBaseline = "top";
          rows.forEach((row, rowIndex) => {
            const y = Math.min(mediaSize.height - settings.summaryTextSize - 2, Number(low) + 4 + rowIndex * (settings.summaryTextSize + 2));
            if (row.startsWith("A ")) {
              const [ask, bid] = row.split("  "); context.fillStyle = colors.ask; context.fillText(ask, x1 + 3, y);
              context.fillStyle = colors.bid; context.fillText(bid, x1 + 6 + context.measureText(ask).width, y);
            } else { context.fillStyle = colors.summary; context.fillText(row, x1 + 3, y); }
          });
        }
      });
      context.restore();
    });
  }
}

class View implements ISeriesPrimitivePaneView {
  private readonly rendererValue: Renderer;
  constructor(owner: OverlayTimeframeHighlightPrimitive) { this.rendererValue = new Renderer(owner); }
  zOrder() { return "bottom" as const; }
  renderer() { return this.rendererValue; }
}

export class OverlayTimeframeHighlightPrimitive implements ISeriesPrimitive<Time> {
  private chartApi: SeriesAttachedParameter<Time, "Line">["chart"] | null = null;
  private seriesApi: LineSeries | null = null;
  private redraw: (() => void) | null = null;
  private renderModel: OverlayTimeframeHighlightModel | null = null;
  private readonly view = new View(this);
  attached(parameter: SeriesAttachedParameter<Time, "Line">) { this.chartApi = parameter.chart; this.seriesApi = parameter.series; this.redraw = parameter.requestUpdate; }
  detached() { this.chartApi = null; this.seriesApi = null; this.redraw = null; }
  paneViews() { return [this.view]; }
  update(model: OverlayTimeframeHighlightModel | null) { this.renderModel = model; this.redraw?.(); }
  model() { return this.renderModel; }
  chart() { return this.chartApi; }
  series() { return this.seriesApi; }
}
