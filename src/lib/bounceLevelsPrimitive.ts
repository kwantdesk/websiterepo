import type {
  IChartApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import type { BounceLevel, BounceLevelsSnapshot } from "@/lib/bounceLevels";
import { formatGammaValue } from "@/lib/netGammaExposureByStrike";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];

export type BounceLevelsPrimitiveData = {
  snapshot: BounceLevelsSnapshot;
  lineWidth: number;
  lineOpacity: number;
  glowStrength: number;
  labelWidth: number;
  showLabels: boolean;
  showValues: boolean;
  showAirPockets: boolean;
  positiveColor: string;
  negativeColor: string;
  kingColor: string;
  developingColor: string;
  weakeningColor: string;
  airPocketColor: string;
  backgroundColor: string;
  textColor: string;
  precision: number;
};

export type BounceLevelsHit = { x: number; y: number; level: BounceLevel; snapshot: BounceLevelsSnapshot };
type RenderedHit = BounceLevelsHit & { left: number; right: number; height: number };

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const rgb = (color: string) => {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return { r: 255, g: 255, b: 255 };
  return { r: parseInt(match[1].slice(0, 2), 16), g: parseInt(match[1].slice(2, 4), 16), b: parseInt(match[1].slice(4, 6), 16) };
};
const alpha = (color: string, opacity: number) => { const value = rgb(color); return `rgba(${value.r},${value.g},${value.b},${clamp(opacity, 0, 1)})`; };

function colorFor(level: BounceLevel, data: BounceLevelsPrimitiveData) {
  if (level.role === "DEVELOPING") return data.developingColor;
  if (level.role === "WEAKENING" || level.role === "RETIRED") return data.weakeningColor;
  return level.signedExposure >= 0 ? data.positiveColor : data.negativeColor;
}

class BounceLevelsRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: BounceLevelsPrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const series = this.primitive.series();
    const data = this.primitive.data();
    if (!series || !data?.snapshot.levels.length) { this.primitive.setHits([]); return; }
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const hits: RenderedHit[] = [];
      const strongest = Math.max(1, ...data.snapshot.levels.map((level) => level.absoluteExposure));
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();
      if (data.showAirPockets) for (const pocket of data.snapshot.airPockets) {
        const upper = series.priceToCoordinate(pocket.upperPrice);
        const lower = series.priceToCoordinate(pocket.lowerPrice);
        if (upper === null || lower === null) continue;
        const top = Math.min(Number(upper), Number(lower));
        const height = Math.abs(Number(lower) - Number(upper));
        context.fillStyle = alpha(data.airPocketColor, 0.035 + (1 - pocket.magnitudeRatio) * 0.035);
        context.fillRect(0, top, mediaSize.width, height);
      }
      for (const level of data.snapshot.levels) {
        const coordinate = series.priceToCoordinate(level.mappedPrice);
        if (coordinate === null || coordinate < -20 || coordinate > mediaSize.height + 20) continue;
        const y = Number(coordinate);
        const color = colorFor(level, data);
        const accentColor = level.role === "KING" ? data.kingColor : color;
        const strength = clamp(Math.sqrt(level.absoluteExposure / strongest), 0.2, 1);
        const lineWidth = Math.max(1, data.lineWidth * (0.75 + strength * 0.75));
        const labelWidth = data.showLabels ? clamp(data.labelWidth, 110, Math.min(270, mediaSize.width * 0.35)) : 0;
        const lineRight = mediaSize.width - (labelWidth ? labelWidth + 8 : 0);
        if (data.glowStrength > 0) {
          context.save();
          context.shadowColor = accentColor;
          context.shadowBlur = data.glowStrength * (level.role === "KING" ? 2 : 1) * strength;
          context.strokeStyle = alpha(color, data.lineOpacity * 0.62);
          context.lineWidth = lineWidth + (level.role === "KING" ? 1.5 : 0);
          context.beginPath();
          context.moveTo(0, y + 0.5);
          context.lineTo(lineRight, y + 0.5);
          context.stroke();
          context.restore();
        }
        context.strokeStyle = alpha(color, data.lineOpacity);
        context.lineWidth = lineWidth;
        context.setLineDash(level.role === "WEAKENING" || level.role === "RETIRED" ? [5, 4] : level.role === "DEVELOPING" ? [2, 3] : []);
        context.beginPath();
        context.moveTo(0, y + 0.5);
        context.lineTo(lineRight, y + 0.5);
        context.stroke();
        context.setLineDash([]);
        if (data.showLabels) {
          const role = level.role.replaceAll("_", " ");
          const rateArrow = level.rateOfChangePercent >= 1 ? "↑" : level.rateOfChangePercent <= -1 ? "↓" : "→";
          const label = `${role}  ${level.mappedPrice.toFixed(data.precision)}  ${level.percentOfKing.toFixed(0)}% ${rateArrow}${Math.abs(level.rateOfChangePercent).toFixed(0)}%${level.touches > 0 ? `  T${level.touches}` : ""}${data.showValues ? `  ${formatGammaValue(level.signedExposure, "per-one-percent-move")}` : ""}`;
          const left = mediaSize.width - labelWidth;
          context.fillStyle = alpha(data.backgroundColor, 0.94);
          context.fillRect(left, y - 9, labelWidth, 18);
          context.strokeStyle = alpha(accentColor, level.role === "KING" ? 1 : 0.78);
          context.lineWidth = level.role === "KING" ? 2 : 1;
          context.strokeRect(left + 0.5, y - 8.5, labelWidth - 1, 17);
          context.font = `${level.role === "KING" ? 700 : 600} 9px 'JetBrains Mono', monospace`;
          context.textAlign = "left";
          context.textBaseline = "middle";
          context.fillStyle = level.role === "KING" ? accentColor : data.textColor;
          context.fillText(level.role === "KING" ? `♛ ${label}` : label, left + 7, y, labelWidth - 12);
          hits.push({ x: left + labelWidth / 2, y, level, snapshot: data.snapshot, left, right: mediaSize.width, height: 18 });
        } else hits.push({ x: lineRight / 2, y, level, snapshot: data.snapshot, left: 0, right: lineRight, height: 12 });
      }
      context.restore();
      this.primitive.setHits(hits);
    });
  }
}

class BounceLevelsView implements ISeriesPrimitivePaneView {
  private readonly paneRenderer: BounceLevelsRenderer;
  constructor(primitive: BounceLevelsPrimitive) { this.paneRenderer = new BounceLevelsRenderer(primitive); }
  zOrder() { return "bottom" as const; }
  renderer() { return this.paneRenderer; }
}

export class BounceLevelsPrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null;
  private chartApi: IChartApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderData: BounceLevelsPrimitiveData | null = null;
  private hits: RenderedHit[] = [];
  private readonly paneView = new BounceLevelsView(this);
  attached(param: SeriesAttachedParameter<Time, "Candlestick">) { this.candleSeries = param.series; this.chartApi = param.chart as IChartApi; this.requestRedraw = param.requestUpdate; }
  detached() { this.candleSeries = null; this.chartApi = null; this.requestRedraw = null; this.hits = []; }
  update(data: BounceLevelsPrimitiveData | null) { this.renderData = data; this.requestRedraw?.(); }
  series() { return this.candleSeries; }
  chart() { return this.chartApi; }
  data() { return this.renderData; }
  setHits(hits: RenderedHit[]) { this.hits = hits; }
  queryHit(x: number, y: number): BounceLevelsHit | null {
    const hit = this.hits.find((candidate) => x >= candidate.left - 4 && x <= candidate.right + 4 && Math.abs(y - candidate.y) <= candidate.height / 2 + 3);
    return hit ? { x, y: hit.y, level: hit.level, snapshot: hit.snapshot } : null;
  }
  paneViews() { return [this.paneView]; }
}
