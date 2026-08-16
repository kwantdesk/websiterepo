import type {
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import type { TapeBurstEvent, TapeSpeedFrame, TapeSpeedSettings } from "@/lib/tapeSpeedOrderFlowBurst";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];
export type TapeSpeedPrimitiveData = { frame: TapeSpeedFrame; settings: TapeSpeedSettings; backgroundColor: string };
export type TapeSpeedHit = { x: number; y: number; event: TapeBurstEvent };
type Bound = { left: number; top: number; right: number; bottom: number; hit: TapeSpeedHit };

const clamp = (value: number, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
function rgba(color: string, alpha: number) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const hex = match[1].length === 3 ? match[1].split("").map((part) => part + part).join("") : match[1];
  const value = Number.parseInt(hex, 16);
  return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${clamp(alpha)})`;
}
const compact = (value: number) => Math.abs(value) >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : Math.abs(value) >= 1_000 ? `${(value / 1_000).toFixed(1)}K` : Math.round(value).toLocaleString();

class Renderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: TapeSpeedOrderFlowBurstPrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const data = this.primitive.data();
    const chart = this.primitive.chart();
    const series = this.primitive.series();
    if (!data || !chart || !series) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const { frame, settings } = data;
      if (mediaSize.width < 100 || mediaSize.height < 80) return;
      const bounds: Bound[] = [];
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();
      for (const event of frame.events) {
        if (event.score < settings.minimumMarkerScore) continue;
        const start = chart.timeScale().timeToCoordinate(Math.floor(event.startMs / 1_000) as Time);
        const end = chart.timeScale().timeToCoordinate(Math.floor(event.endMs / 1_000) as Time);
        const high = series.priceToCoordinate(event.highPrice);
        const low = series.priceToCoordinate(event.lowPrice);
        const anchor = series.priceToCoordinate(event.anchorPrice);
        if (start === null || end === null || high === null || low === null || anchor === null) continue;
        const x1 = Number(start);
        const x2 = Math.max(x1 + 3, Number(end));
        const top = Math.min(Number(high), Number(low));
        const bottom = Math.max(Number(high), Number(low));
        const color = event.response === "rejection" ? settings.warningColor : event.direction === "buy" ? settings.buyColor : event.direction === "sell" ? settings.sellColor : settings.neutralColor;
        const alpha = settings.opacity / 100;
        if (settings.showPriceTimeBands) {
          context.fillStyle = rgba(color, alpha * 0.065);
          context.fillRect(x1, top, Math.max(3, x2 - x1), Math.max(3, bottom - top));
          context.strokeStyle = rgba(color, alpha * 0.38);
          context.lineWidth = 1;
          context.strokeRect(x1, top, Math.max(3, x2 - x1), Math.max(3, bottom - top));
        }
        if (!settings.showMarkers) continue;
        const cx = x2 + 2;
        const cy = Number(anchor);
        const size = settings.markerSize + Math.min(4, event.score / 30);
        context.strokeStyle = rgba(color, alpha);
        context.lineWidth = 1.5;
        context.beginPath();
        if (event.direction === "sell") {
          context.moveTo(cx - size, cy - size / 2); context.lineTo(cx, cy + size / 2); context.lineTo(cx + size, cy - size / 2);
        } else if (event.direction === "buy") {
          context.moveTo(cx - size, cy + size / 2); context.lineTo(cx, cy - size / 2); context.lineTo(cx + size, cy + size / 2);
        } else {
          context.arc(cx, cy, size * 0.65, 0, Math.PI * 2);
        }
        context.stroke();
        if (settings.showLabels) {
          const label = event.direction === "neutral" ? "CHURN" : `${event.direction.toUpperCase()} BURST`;
          context.fillStyle = rgba(color, alpha);
          context.font = "600 8px JetBrains Mono, monospace";
          context.textBaseline = "middle";
          context.textAlign = event.direction === "sell" ? "right" : "left";
          context.fillText(`${label} · ${compact(event.contractsPerSecond)}/s · ${event.score}`, cx + (event.direction === "sell" ? -size - 4 : size + 4), cy);
        }
        bounds.push({ left: cx - size, top: cy - size, right: cx + size, bottom: cy + size, hit: { x: cx, y: cy, event } });
      }
      context.restore();
      this.primitive.replaceBounds(bounds);
    });
  }
}

class PaneView implements ISeriesPrimitivePaneView {
  constructor(private readonly primitive: TapeSpeedOrderFlowBurstPrimitive) {}
  zOrder() { return "bottom" as const; }
  renderer() { return new Renderer(this.primitive); }
}

export class TapeSpeedOrderFlowBurstPrimitive implements ISeriesPrimitive<Time> {
  private chartApi: SeriesAttachedParameter<Time, "Candlestick">["chart"] | null = null;
  private seriesApi: CandleSeriesApi | null = null;
  private requestUpdate: (() => void) | null = null;
  private model: TapeSpeedPrimitiveData | null = null;
  private bounds: Bound[] = [];
  private readonly view = new PaneView(this);
  attached(params: SeriesAttachedParameter<Time, "Candlestick">) { this.chartApi = params.chart; this.seriesApi = params.series; this.requestUpdate = params.requestUpdate; }
  detached() { this.chartApi = null; this.seriesApi = null; this.requestUpdate = null; this.bounds = []; }
  paneViews() { return this.model ? [this.view] : []; }
  update(model: TapeSpeedPrimitiveData | null) { this.model = model; if (!model) this.bounds = []; this.requestUpdate?.(); }
  data() { return this.model; }
  chart() { return this.chartApi; }
  series() { return this.seriesApi; }
  replaceBounds(bounds: Bound[]) { this.bounds = bounds; }
  queryHit(x: number, y: number) {
    for (let index = this.bounds.length - 1; index >= 0; index -= 1) {
      const bound = this.bounds[index];
      if (x >= bound.left && x <= bound.right && y >= bound.top && y <= bound.bottom) return { ...bound.hit, x, y };
    }
    return null;
  }
}

