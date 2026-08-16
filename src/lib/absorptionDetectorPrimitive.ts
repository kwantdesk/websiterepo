import type {
  IChartApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import type { AbsorptionCandidate, AbsorptionEvent, AbsorptionFrame, AbsorptionSettings, AbsorptionZone } from "@/lib/absorptionDetector";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];

export type AbsorptionPrimitiveData = {
  frame: AbsorptionFrame;
  settings: AbsorptionSettings;
  backgroundColor: string;
};

export type AbsorptionHit = {
  x: number;
  y: number;
  event: AbsorptionEvent | AbsorptionCandidate | AbsorptionZone;
  kind: "candidate" | "event" | "zone";
};

const clamp = (value: number, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
function rgba(color: string, alpha: number) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const hex = match[1].length === 3 ? match[1].split("").map((part) => part + part).join("") : match[1];
  const value = Number.parseInt(hex, 16);
  return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${clamp(alpha)})`;
}
function colorFor(event: Pick<AbsorptionEvent, "side" | "state">, settings: AbsorptionSettings) {
  if (event.state === "BROKEN" || event.state === "EXPIRED") return settings.brokenColor;
  if (["RETESTING", "HELD", "FAILED"].includes(event.state)) return settings.retestColor;
  if (event.side === "BID") return event.state === "DEVELOPING" ? settings.bidDevelopingColor : settings.bidConfirmedColor;
  return event.state === "DEVELOPING" ? settings.askDevelopingColor : settings.askConfirmedColor;
}
const compact = (value: number) => Math.abs(value) >= 1_000_000
  ? `${(value / 1_000_000).toFixed(1)}M`
  : Math.abs(value) >= 1_000
    ? `${(value / 1_000).toFixed(1)}K`
    : Math.round(value).toLocaleString();

class Renderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: AbsorptionDetectorPrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const data = this.primitive.data(); const series = this.primitive.series(); const chart = this.primitive.chart();
    if (!data || !series || !chart) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      if (mediaSize.width < 100 || mediaSize.height < 80) return;
      const { frame, settings } = data; const opacity = settings.opacity / 100;
      const priceToY = (tick: number) => series.priceToCoordinate(tick * frame.tickSize);
      const timeToX = (timestamp: number) => chart.timeScale().timeToCoordinate(Math.floor(timestamp / 1_000) as Time);
      const tickHeight = Math.max(2, Math.min(20, Math.abs(Number(priceToY(1 + Math.round((frame.lastPrice ?? frame.tickSize) / frame.tickSize)) ?? 0) - Number(priceToY(Math.round((frame.lastPrice ?? frame.tickSize) / frame.tickSize)) ?? 0)) || 4));
      context.save(); context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();

      if ((settings.showZones || settings.renderMode === "zones" || settings.renderMode === "hybrid") && settings.showConfirmed) {
        for (const zone of frame.zones) {
          if (zone.state === "BROKEN" && !settings.showBroken) continue;
          const x1 = timeToX(zone.createdAt); if (x1 === null) continue;
          const x2 = zone.brokenAt ? timeToX(zone.brokenAt) : zone.extendedUntil ? timeToX(zone.extendedUntil) : mediaSize.width;
          const y1 = priceToY(zone.highTick + 0.5); const y2 = priceToY(zone.lowTick - 0.5);
          if (y1 === null || y2 === null) continue;
          const left = Number(x1); const right = x2 === null ? mediaSize.width : Number(x2); const top = Math.min(Number(y1), Number(y2)); const height = Math.max(tickHeight, Math.abs(Number(y2) - Number(y1)));
          const color = colorFor(zone, settings); const broken = zone.state === "BROKEN";
          context.fillStyle = rgba(color, opacity * (broken ? 0.015 : zone.state === "RETESTING" ? 0.1 : 0.07)); context.fillRect(left, top, Math.max(1, right - left), height);
          context.strokeStyle = rgba(color, opacity * (broken ? 0.3 : 0.72)); context.lineWidth = broken ? 1 : settings.zoneBorderWidth;
          if (broken) context.setLineDash([5, 4]); context.strokeRect(left, top, Math.max(1, right - left), height); context.setLineDash([]);
          const centreY = priceToY(zone.weightedCentreTick); if (centreY !== null) {
            context.strokeStyle = rgba(color, opacity * 0.52); context.setLineDash([2, 3]); context.beginPath(); context.moveTo(left, Number(centreY)); context.lineTo(right, Number(centreY)); context.stroke(); context.setLineDash([]);
          }
        }
      }

      if ((settings.showCells || settings.renderMode === "cells" || settings.renderMode === "hybrid") && settings.showDeveloping) {
        for (const candidate of frame.candidates) {
          if (candidate.confirmed) continue;
          const x1 = timeToX(candidate.startTimestamp); const x2 = timeToX(candidate.endTimestamp);
          const y1 = priceToY(candidate.highTick + 0.5); const y2 = priceToY(candidate.lowTick - 0.5);
          if ([x1, x2, y1, y2].some((value) => value === null)) continue;
          const color = colorFor(candidate, settings); const top = Math.min(Number(y1), Number(y2));
          context.fillStyle = rgba(color, opacity * (0.03 + 0.09 * candidate.score / 100));
          context.fillRect(Number(x1), top, Math.max(3, Number(x2) - Number(x1) + 3), Math.max(tickHeight, Math.abs(Number(y2) - Number(y1))));
        }
      }

      if (settings.showEventMarkers || settings.renderMode === "markers" || settings.renderMode === "hybrid") {
        for (const event of frame.events) {
          const x = timeToX(event.endTimestamp); const y = priceToY(event.dominantTick); if (x === null || y === null) continue;
          const color = colorFor(event, settings); const size = settings.markerSize + Math.min(5, event.score / 25);
          context.strokeStyle = rgba(color, opacity * 0.95); context.fillStyle = rgba(color, opacity * 0.16); context.lineWidth = 1.25;
          context.beginPath();
          if (event.side === "BID") { context.moveTo(Number(x) - size, Number(y) + size * 0.55); context.lineTo(Number(x), Number(y)); context.lineTo(Number(x) + size, Number(y) + size * 0.55); }
          else { context.moveTo(Number(x) - size, Number(y) - size * 0.55); context.lineTo(Number(x), Number(y)); context.lineTo(Number(x) + size, Number(y) - size * 0.55); }
          context.stroke();
          if (event.suspectedHiddenLiquidity) { context.beginPath(); context.arc(Number(x), Number(y), size * 0.72, 0, Math.PI * 2); context.strokeStyle = rgba(settings.replenishmentColor, opacity); context.stroke(); }
          const label = [
            settings.showQuantity ? compact(event.aggressiveQuantity) : "",
            settings.showScore ? `S${event.score}` : "",
            settings.showTradeCount ? `${event.tradeCount}T` : "",
            settings.showAggressionPerTick ? `${compact(event.aggressionPerTick)}/tk` : "",
            settings.showReplenishment && event.replenishmentQuantity > 0 ? `R${compact(event.replenishmentQuantity)}` : "",
            settings.showRepeatCount && event.repeatCount > 0 ? `×${event.repeatCount + 1}` : "",
          ].filter(Boolean).join(" · ");
          if (label) {
            context.font = "600 8px JetBrains Mono, monospace";
            context.textAlign = "left";
            context.textBaseline = event.side === "BID" ? "top" : "bottom";
            context.fillStyle = rgba(color, opacity * 0.92);
            context.fillText(label, Number(x) + size + 3, Number(y) + (event.side === "BID" ? 3 : -3));
          }
        }
      }

      if (settings.renderMode === "candle-highlights") {
        for (const event of frame.events) {
          const x1 = timeToX(event.startTimestamp); const x2 = timeToX(event.endTimestamp);
          const y1 = priceToY(event.highTick + 0.5); const y2 = priceToY(event.lowTick - 0.5);
          if ([x1, x2, y1, y2].some((value) => value === null)) continue;
          const color = colorFor(event, settings);
          context.fillStyle = rgba(color, opacity * 0.13);
          context.fillRect(Number(x1) - 2, Math.min(Number(y1), Number(y2)), Math.max(5, Number(x2) - Number(x1) + 4), Math.max(tickHeight, Math.abs(Number(y2) - Number(y1))));
        }
      }

      if (settings.showActiveProfile || settings.renderMode === "active-profile") {
        const active = frame.zones.filter((zone) => zone.state !== "BROKEN" && zone.state !== "EXPIRED").sort((a, b) => b.score - a.score).slice(0, settings.activeProfileMaximumZones);
        const maximum = Math.max(1, ...active.map((zone) => zone.aggressiveQuantity)); const right = mediaSize.width - 3;
        for (const zone of active) {
          const y = priceToY(zone.weightedCentreTick); if (y === null) continue;
          const width = settings.activeProfileWidth * Math.sqrt(zone.aggressiveQuantity / maximum); const color = colorFor(zone, settings);
          context.fillStyle = rgba(color, opacity * 0.52); context.fillRect(right - width, Number(y) - tickHeight / 2, width, tickHeight);
          if (width > 52) { context.fillStyle = rgba("#FFFFFF", 0.88); context.font = "600 9px JetBrains Mono, monospace"; context.textAlign = "right"; context.textBaseline = "middle"; context.fillText(`${zone.side} ${zone.score}`, right - 4, Number(y)); }
        }
      }

      if (settings.showLowerPane || settings.renderMode === "lower-pane") {
        const height = Math.min(settings.lowerPaneHeight, mediaSize.height * 0.32); const top = mediaSize.height - height;
        context.fillStyle = rgba(data.backgroundColor, 0.92); context.fillRect(0, top, mediaSize.width, height);
        context.strokeStyle = rgba(settings.neutralColor, 0.28); context.beginPath(); context.moveTo(0, top); context.lineTo(mediaSize.width, top); context.stroke();
        const recent = frame.events.slice(-100); const max = Math.max(1, ...recent.map((event) => event.aggressiveQuantity));
        for (const event of recent) { const x = timeToX(event.endTimestamp); if (x === null) continue; const magnitude = (event.aggressiveQuantity / max) * (height * 0.42); const baseline = top + height / 2; context.fillStyle = rgba(colorFor(event, settings), opacity * 0.75); context.fillRect(Number(x) - 2, event.side === "BID" ? baseline - magnitude : baseline, 4, magnitude); }
      }
      context.restore();
    });
  }
}

class PaneView implements ISeriesPrimitivePaneView {
  private readonly paneRenderer: Renderer;
  constructor(primitive: AbsorptionDetectorPrimitive) { this.paneRenderer = new Renderer(primitive); }
  zOrder() { return "bottom" as const; }
  renderer() { return this.paneRenderer; }
}

export class AbsorptionDetectorPrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null; private chartApi: IChartApi | null = null; private requestRedraw: (() => void) | null = null; private renderData: AbsorptionPrimitiveData | null = null; private readonly paneView = new PaneView(this);
  attached(param: SeriesAttachedParameter<Time, "Candlestick">) { this.candleSeries = param.series; this.chartApi = param.chart as IChartApi; this.requestRedraw = param.requestUpdate; }
  detached() { this.candleSeries = null; this.chartApi = null; this.requestRedraw = null; }
  update(data: AbsorptionPrimitiveData | null) { this.renderData = data; this.requestRedraw?.(); }
  series() { return this.candleSeries; }
  chart() { return this.chartApi; }
  data() { return this.renderData; }
  paneViews() { return [this.paneView]; }
  queryHit(x: number, y: number): AbsorptionHit | null {
    if (!this.renderData || !this.candleSeries || !this.chartApi) return null; let nearest: AbsorptionHit | null = null; let distance = Infinity;
    const inspect = (event: AbsorptionEvent | AbsorptionCandidate | AbsorptionZone, kind: AbsorptionHit["kind"]) => {
      const eventX = this.chartApi!.timeScale().timeToCoordinate(Math.floor(event.endTimestamp / 1_000) as Time); const eventY = this.candleSeries!.priceToCoordinate(event.dominantTick * this.renderData!.frame.tickSize);
      if (eventX === null || eventY === null) return; const nextDistance = Math.abs(Number(eventX) - x) + Math.abs(Number(eventY) - y);
      if (nextDistance < distance && Math.abs(Number(eventX) - x) <= 24 && Math.abs(Number(eventY) - y) <= 18) { distance = nextDistance; nearest = { x: Number(eventX), y: Number(eventY), event, kind }; }
    };
    this.renderData.frame.candidates.forEach((event) => inspect(event, "candidate")); this.renderData.frame.events.forEach((event) => inspect(event, "event")); this.renderData.frame.zones.forEach((event) => inspect(event, "zone"));
    return nearest;
  }
}
