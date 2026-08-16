import type { ISeriesPrimitive, ISeriesPrimitivePaneRenderer, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "@/lib/lightweightChartsCompat";
import type { IcebergCandidate, IcebergRefreshCycle, IcebergRefreshFrame, IcebergRefreshSettings, IcebergZone } from "@/lib/icebergRefreshDetector";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];
export type IcebergRefreshPrimitiveData = { frame: IcebergRefreshFrame; settings: IcebergRefreshSettings; backgroundColor: string };
export type IcebergRefreshHit = { x: number; y: number; kind: "cycle" | "candidate" | "zone"; item: IcebergRefreshCycle | IcebergCandidate | IcebergZone };
type Bounds = { left: number; top: number; right: number; bottom: number; hit: IcebergRefreshHit };

const clamp = (value: number, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
function rgba(color: string, alpha: number) { const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color); if (!match) return color; const hex = match[1].length === 3 ? match[1].split("").map((part) => part + part).join("") : match[1]; const value = Number.parseInt(hex, 16); return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${clamp(alpha)})`; }
const compact = (value: number) => Math.abs(value) >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : Math.abs(value) >= 1_000 ? `${(value / 1_000).toFixed(1)}K` : Math.round(value).toLocaleString();

class Renderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: IcebergRefreshPrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const data = this.primitive.data(); const chart = this.primitive.chart(); const series = this.primitive.series(); if (!data || !chart || !series) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      if (mediaSize.width < 100 || mediaSize.height < 80) return;
      const { frame, settings } = data; const opacity = settings.opacity / 100; const bounds: Bounds[] = [];
      const timeToX = (timestamp: number) => chart.timeScale().timeToCoordinate(Math.floor(timestamp / 1_000) as Time);
      const priceToY = (tick: number) => series.priceToCoordinate(tick * frame.tickSize);
      const referenceTick = Math.round((frame.lastPrice ?? frame.tickSize) / frame.tickSize); const y0 = priceToY(referenceTick); const y1 = priceToY(referenceTick + 1); const rowHeight = Math.max(3, Math.min(20, y0 === null || y1 === null ? 5 : Math.abs(Number(y1) - Number(y0))));
      const sideColor = (side: "BID" | "ASK") => side === "BID" ? settings.bidColor : settings.askColor;
      const stateColor = (item: { passiveSide?: "BID" | "ASK"; side?: "BID" | "ASK"; state?: string }) => item.state === "NATIVE" ? settings.nativeColor : item.state === "EXHAUSTED" ? settings.exhaustedColor : item.state === "PULLED" ? settings.pulledColor : item.state === "BROKEN" || item.state === "EXPIRED" ? settings.brokenColor : sideColor((item.passiveSide ?? item.side ?? "BID") as "BID" | "ASK");
      context.save(); context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();

      if (settings.showCycleCells) for (const cycle of frame.cycles) {
        const x1 = timeToX(cycle.executionStartMs); const x2 = timeToX(cycle.replenishmentEndMs); const y = priceToY(cycle.priceTick); if (x1 === null || x2 === null || y === null) continue;
        const left = Number(x1); const width = Math.max(2, Math.min(40, Number(x2) - left || 2)); const height = Math.max(2, Math.min(20, rowHeight * 0.78)); const scoreLike = clamp((cycle.replenishmentRatio + cycle.displayedRecovery) / 2, 0.08, 1); const color = sideColor(cycle.side);
        context.fillStyle = rgba(color, opacity * (0.04 + scoreLike * 0.25)); context.strokeStyle = rgba(color, opacity * 0.45); context.lineWidth = 1; context.fillRect(left, Number(y) - height / 2, width, height); context.strokeRect(left, Number(y) - height / 2, width, height);
        bounds.push({ left, top: Number(y) - height / 2, right: left + width, bottom: Number(y) + height / 2, hit: { x: left, y: Number(y), kind: "cycle", item: cycle } });
      }

      if (settings.showZones) for (const zone of frame.zones) {
        const x1 = timeToX(zone.startMs); if (x1 === null) continue; const topY = priceToY(zone.highTick + 0.5); const bottomY = priceToY(zone.lowTick - 0.5); if (topY === null || bottomY === null) continue;
        const left = Number(x1); const rightCoordinate = zone.endMs ? timeToX(zone.endMs) : null; const right = rightCoordinate === null ? mediaSize.width - (settings.showActiveProfile ? settings.activeProfileWidth : 0) : Number(rightCoordinate); const top = Math.min(Number(topY), Number(bottomY)); const bottom = Math.max(Number(topY), Number(bottomY)); const color = stateColor(zone);
        const fillAlpha = zone.state === "SUSPECTED" || zone.state === "NATIVE" ? 0.075 : zone.state === "BROKEN" ? 0.015 : zone.state === "PULLED" ? 0.025 : 0.045;
        context.fillStyle = rgba(color, opacity * fillAlpha); context.fillRect(left, top, Math.max(1, right - left), Math.max(rowHeight, bottom - top)); context.strokeStyle = rgba(color, opacity * (zone.state === "BROKEN" ? 0.28 : 0.75)); context.lineWidth = 1; if (zone.state === "BROKEN") context.setLineDash([5, 4]); context.strokeRect(left, top, Math.max(1, right - left), Math.max(rowHeight, bottom - top)); context.setLineDash([]);
        const centre = priceToY(zone.centreTick); if (centre !== null) { context.strokeStyle = rgba(color, opacity * 0.45); context.setLineDash([2, 3]); context.beginPath(); context.moveTo(left, Number(centre)); context.lineTo(right, Number(centre)); context.stroke(); context.setLineDash([]); }
        bounds.push({ left, top, right, bottom: Math.max(top + rowHeight, bottom), hit: { x: left, y: top, kind: "zone", item: zone } });
      }

      if (settings.showMarkers) for (const candidate of frame.candidates) {
        if (candidate.completedRefreshCycleCount <= 0 || candidate.state === "EXPIRED") continue; const x = timeToX(candidate.lastUpdatedMs); const y = priceToY(candidate.priceTick); if (x === null || y === null) continue; const color = stateColor(candidate); const size = settings.markerSize + Math.min(5, candidate.score / 25); const cx = Number(x); const cy = Number(y);
        context.strokeStyle = rgba(color, opacity * 0.9); context.fillStyle = rgba(color, opacity * (candidate.state === "SUSPECTED" ? 0.58 : 0.18)); context.lineWidth = candidate.state === "SUSPECTED" ? 2 : 1.2;
        context.beginPath(); if (candidate.passiveSide === "BID") { context.moveTo(cx - size, cy + size / 2); context.lineTo(cx, cy - size / 2); context.lineTo(cx + size, cy + size / 2); context.moveTo(cx - size, cy + size); context.lineTo(cx, cy); context.lineTo(cx + size, cy + size); } else { context.moveTo(cx - size, cy - size / 2); context.lineTo(cx, cy + size / 2); context.lineTo(cx + size, cy - size / 2); context.moveTo(cx - size, cy - size); context.lineTo(cx, cy); context.lineTo(cx + size, cy - size); } context.stroke();
        if (candidate.state === "SUSPECTED" || candidate.state === "NATIVE") { context.beginPath(); context.arc(cx, cy, Math.max(2, size * 0.36), 0, Math.PI * 2); context.fill(); }
        if (candidate.state === "BROKEN") { context.beginPath(); context.moveTo(cx - size, cy - size); context.lineTo(cx + size, cy + size); context.moveTo(cx + size, cy - size); context.lineTo(cx - size, cy + size); context.stroke(); }
        if (settings.showLabels && candidate.score >= settings.minimumSuspectedScore) { context.font = "600 8px JetBrains Mono, monospace"; context.fillStyle = rgba(color, opacity); context.textAlign = candidate.passiveSide === "BID" ? "left" : "right"; context.textBaseline = "middle"; context.fillText(`${candidate.passiveSide} ${candidate.state === "SUSPECTED" ? "ICE?" : "REF"} · E${compact(candidate.cumulativeAggressiveExecuted)} · R${compact(candidate.cumulativeAttributedReplenishment)} · C${candidate.completedRefreshCycleCount} · ${candidate.score}`, cx + (candidate.passiveSide === "BID" ? size + 4 : -size - 4), cy); }
        bounds.push({ left: cx - size, top: cy - size, right: cx + size, bottom: cy + size, hit: { x: cx, y: cy, kind: "candidate", item: candidate } });
      }

      if (settings.showActiveProfile) {
        const active = frame.candidates.filter((candidate) => !["BROKEN", "EXPIRED"].includes(candidate.state) && candidate.completedRefreshCycleCount > 0).sort((a, b) => b.score - a.score).slice(0, 16); const right = mediaSize.width - 3; const laneLeft = Math.max(0, right - settings.activeProfileWidth);
        context.fillStyle = rgba(data.backgroundColor, 0.88); context.fillRect(laneLeft, 0, settings.activeProfileWidth + 3, mediaSize.height); context.strokeStyle = rgba(settings.neutralColor, 0.2); context.beginPath(); context.moveTo(laneLeft, 0); context.lineTo(laneLeft, mediaSize.height); context.stroke(); const maximum = Math.max(1, ...active.map((candidate) => candidate.cumulativeAggressiveExecuted));
        for (const candidate of active) { const y = priceToY(candidate.priceTick); if (y === null) continue; const color = stateColor(candidate); const width = Math.max(10, (settings.activeProfileWidth - 8) * Math.sqrt(candidate.cumulativeAggressiveExecuted / maximum)); context.fillStyle = rgba(color, opacity * 0.58); context.fillRect(right - width, Number(y) - rowHeight / 2, width, rowHeight); context.fillStyle = rgba("#FFFFFF", 0.92); context.font = "600 7px JetBrains Mono, monospace"; context.textAlign = "right"; context.textBaseline = "middle"; if (width > 64) context.fillText(`${candidate.passiveSide} · E${compact(candidate.cumulativeAggressiveExecuted)} R${compact(candidate.cumulativeAttributedReplenishment)} C${candidate.completedRefreshCycleCount} ${candidate.score}`, right - 3, Number(y)); bounds.push({ left: right - width, top: Number(y) - rowHeight / 2, right, bottom: Number(y) + rowHeight / 2, hit: { x: right - width, y: Number(y), kind: "candidate", item: candidate } }); }
      }
      context.restore(); this.primitive.replaceBounds(bounds);
    });
  }
}

class PaneView implements ISeriesPrimitivePaneView { constructor(private readonly primitive: IcebergRefreshPrimitive) {} zOrder() { return "bottom" as const; } renderer() { return new Renderer(this.primitive); } }

export class IcebergRefreshPrimitive implements ISeriesPrimitive<Time> {
  private chartApi: SeriesAttachedParameter<Time, "Candlestick">["chart"] | null = null; private seriesApi: CandleSeriesApi | null = null; private requestUpdate: (() => void) | null = null; private model: IcebergRefreshPrimitiveData | null = null; private bounds: Bounds[] = []; private readonly view = new PaneView(this);
  attached(params: SeriesAttachedParameter<Time, "Candlestick">) { this.chartApi = params.chart; this.seriesApi = params.series; this.requestUpdate = params.requestUpdate; }
  detached() { this.chartApi = null; this.seriesApi = null; this.requestUpdate = null; this.bounds = []; }
  paneViews() { return this.model ? [this.view] : []; }
  update(model: IcebergRefreshPrimitiveData | null) { this.model = model; if (!model) this.bounds = []; this.requestUpdate?.(); }
  data() { return this.model; } chart() { return this.chartApi; } series() { return this.seriesApi; } replaceBounds(bounds: Bounds[]) { this.bounds = bounds; }
  queryHit(x: number, y: number) { for (let index = this.bounds.length - 1; index >= 0; index -= 1) { const bound = this.bounds[index]; if (x >= bound.left && x <= bound.right && y >= bound.top && y <= bound.bottom) return { ...bound.hit, x, y }; } return null; }
}
