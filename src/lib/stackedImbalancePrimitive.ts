import type {
  IChartApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import type { ImbalanceCell, ImbalanceZone, StackedImbalanceFrame, StackedImbalanceSettings } from "@/lib/stackedImbalanceSuite";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];

export type StackedImbalancePrimitiveData = {
  frame: StackedImbalanceFrame;
  settings: StackedImbalanceSettings;
  backgroundColor: string;
};

export type StackedImbalanceHit = { x: number; y: number; kind: "cell" | "zone"; item: ImbalanceCell | ImbalanceZone };

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
  constructor(private readonly primitive: StackedImbalancePrimitive) {}
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const data = this.primitive.data(); const chart = this.primitive.chart(); const series = this.primitive.series();
    if (!data || !chart || !series) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      if (mediaSize.width < 100 || mediaSize.height < 80) return;
      const { frame, settings } = data; const opacity = settings.opacity / 100;
      const timeToX = (timestamp: number) => chart.timeScale().timeToCoordinate(Math.floor(timestamp / 1_000) as Time);
      const priceToY = (tick: number) => series.priceToCoordinate(tick * frame.tickSize);
      const referenceTick = Math.round((frame.lastPrice ?? frame.tickSize) / frame.tickSize);
      const y0 = priceToY(referenceTick); const y1 = priceToY(referenceTick + frame.groupTicks);
      const rowHeight = Math.max(3, Math.min(26, y0 === null || y1 === null ? 5 : Math.abs(Number(y1) - Number(y0))));
      const sideColor = (side: "ASK" | "BID") => side === "ASK" ? settings.askColor : settings.bidColor;
      context.save(); context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();

      if (settings.createZones) for (const zone of frame.zones) {
        if (zone.state === "EXPIRED") continue;
        const x1 = timeToX(zone.createdAt); if (x1 === null) continue;
        const x2 = zone.brokenAt ? timeToX(zone.brokenAt) : zone.extendedUntil ? timeToX(zone.extendedUntil) : mediaSize.width - (settings.showActiveLane ? settings.activeLaneWidth : 0);
        const topY = priceToY(zone.highTick + frame.groupTicks / 2); const bottomY = priceToY(zone.lowTick - frame.groupTicks / 2);
        if (topY === null || bottomY === null) continue;
        const left = Number(x1); const right = x2 === null ? mediaSize.width : Number(x2); const top = Math.min(Number(topY), Number(bottomY)); const height = Math.max(rowHeight, Math.abs(Number(bottomY) - Number(topY)));
        const color = zone.state === "BROKEN" ? settings.brokenColor : sideColor(zone.side);
        context.fillStyle = rgba(color, opacity * (zone.state === "RETESTING" ? 0.14 : zone.state === "BROKEN" ? 0.025 : 0.075));
        context.fillRect(left, top, Math.max(1, right - left), height);
        context.strokeStyle = rgba(color, opacity * (zone.state === "BROKEN" ? 0.36 : 0.8)); context.lineWidth = 1;
        if (zone.state === "BROKEN") context.setLineDash([5, 4]); context.strokeRect(left, top, Math.max(1, right - left), height); context.setLineDash([]);
        const centre = priceToY(zone.centreTick); if (centre !== null) { context.strokeStyle = rgba(color, opacity * 0.45); context.setLineDash([2, 3]); context.beginPath(); context.moveTo(left, Number(centre)); context.lineTo(right, Number(centre)); context.stroke(); context.setLineDash([]); }
      }

      if (settings.showIndividualCells) for (const cell of frame.cells) {
        if (!cell.qualified) continue;
        const x = timeToX(cell.timestamp); const y = priceToY(cell.tickIndex); if (x === null || y === null) continue;
        const color = sideColor(cell.side); const size = settings.markerSize + Math.min(4, cell.score / 30);
        context.fillStyle = rgba(color, opacity * (cell.zeroSide ? 0.04 : 0.17)); context.strokeStyle = rgba(color, opacity * 0.92); context.lineWidth = cell.zeroSide ? 1.5 : 1;
        context.beginPath(); context.rect(Number(x) - size / 2, Number(y) - Math.max(2, rowHeight * 0.38), size, Math.max(4, rowHeight * 0.76)); context.fill(); context.stroke();
      }

      if (settings.showStackBrackets) for (const group of frame.groups) {
        if (!group.confirmed) continue;
        const x = timeToX(group.endTimestamp); const top = priceToY(group.highTick + frame.groupTicks / 2); const bottom = priceToY(group.lowTick - frame.groupTicks / 2);
        if (x === null || top === null || bottom === null) continue;
        const color = sideColor(group.side); const bracketX = Number(x) + (group.side === "ASK" ? 7 : -7);
        context.strokeStyle = rgba(color, opacity); context.lineWidth = 1.5; context.beginPath(); context.moveTo(bracketX, Number(top)); context.lineTo(bracketX, Number(bottom)); context.lineTo(bracketX + (group.side === "ASK" ? -5 : 5), Number(bottom)); context.moveTo(bracketX, Number(top)); context.lineTo(bracketX + (group.side === "ASK" ? -5 : 5), Number(top)); context.stroke();
        if (settings.showLabels) { context.font = "600 8px JetBrains Mono, monospace"; context.textAlign = group.side === "ASK" ? "left" : "right"; context.textBaseline = "middle"; context.fillStyle = rgba(color, opacity); context.fillText(`${group.side} ×${group.levelCount} S${group.score}`, bracketX + (group.side === "ASK" ? 4 : -4), (Number(top) + Number(bottom)) / 2); }
      }

      if (settings.showActiveLane) {
        const active = frame.zones.filter((zone) => !["BROKEN", "EXPIRED"].includes(zone.state)).sort((a, b) => b.score - a.score).slice(0, 14);
        const right = mediaSize.width - 3; const laneLeft = Math.max(0, right - settings.activeLaneWidth);
        context.fillStyle = rgba(data.backgroundColor, 0.82); context.fillRect(laneLeft, 0, settings.activeLaneWidth + 3, mediaSize.height);
        context.strokeStyle = rgba(settings.neutralColor, 0.2); context.beginPath(); context.moveTo(laneLeft, 0); context.lineTo(laneLeft, mediaSize.height); context.stroke();
        const max = Math.max(1, ...active.map((zone) => zone.totalNumerator));
        for (const zone of active) { const y = priceToY(zone.centreTick); if (y === null) continue; const width = Math.max(8, (settings.activeLaneWidth - 8) * Math.sqrt(zone.totalNumerator / max)); const color = sideColor(zone.side); context.fillStyle = rgba(color, opacity * 0.62); context.fillRect(right - width, Number(y) - rowHeight / 2, width, rowHeight); if (width > 46) { context.fillStyle = rgba("#FFFFFF", 0.92); context.font = "600 8px JetBrains Mono, monospace"; context.textAlign = "right"; context.textBaseline = "middle"; context.fillText(`${zone.levelCount}L · ${zone.score}`, right - 3, Number(y)); } }
      }

      if (settings.showSessionProfile) {
        const recent = frame.cells.filter((cell) => cell.qualified); const byTick = new Map<number, number>();
        for (const cell of recent) byTick.set(cell.tickIndex, (byTick.get(cell.tickIndex) ?? 0) + (cell.side === "ASK" ? cell.numerator : -cell.numerator));
        const max = Math.max(1, ...[...byTick.values()].map(Math.abs));
        for (const [tick, value] of byTick) { const y = priceToY(tick); if (y === null) continue; const width = 70 * Math.sqrt(Math.abs(value) / max); context.fillStyle = rgba(value >= 0 ? settings.askColor : settings.bidColor, opacity * 0.35); context.fillRect(value >= 0 ? 2 : 72 - width, Number(y) - rowHeight / 2, width, rowHeight); }
      }

      if (settings.showLowerPane) {
        const paneHeight = Math.min(100, mediaSize.height * 0.22); const top = mediaSize.height - paneHeight; context.fillStyle = rgba(data.backgroundColor, 0.93); context.fillRect(0, top, mediaSize.width, paneHeight); context.strokeStyle = rgba(settings.neutralColor, 0.25); context.beginPath(); context.moveTo(0, top); context.lineTo(mediaSize.width, top); context.stroke();
        const recent = frame.groups.slice(-100); const max = Math.max(1, ...recent.map((group) => group.totalNumerator)); const baseline = top + paneHeight / 2;
        for (const group of recent) { const x = timeToX(group.endTimestamp); if (x === null) continue; const height = group.totalNumerator / max * paneHeight * 0.42; context.fillStyle = rgba(sideColor(group.side), opacity * 0.8); context.fillRect(Number(x) - 2, group.side === "ASK" ? baseline - height : baseline, 4, height); }
      }
      context.restore();
    });
  }
}

class PaneView implements ISeriesPrimitivePaneView {
  private readonly paneRenderer: Renderer;
  constructor(primitive: StackedImbalancePrimitive) { this.paneRenderer = new Renderer(primitive); }
  zOrder() { return "bottom" as const; }
  renderer() { return this.paneRenderer; }
}

export class StackedImbalancePrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null; private chartApi: IChartApi | null = null; private requestRedraw: (() => void) | null = null; private renderData: StackedImbalancePrimitiveData | null = null; private readonly paneView = new PaneView(this);
  attached(param: SeriesAttachedParameter<Time, "Candlestick">) { this.candleSeries = param.series; this.chartApi = param.chart as IChartApi; this.requestRedraw = param.requestUpdate; }
  detached() { this.candleSeries = null; this.chartApi = null; this.requestRedraw = null; }
  update(data: StackedImbalancePrimitiveData | null) { this.renderData = data; this.requestRedraw?.(); }
  data() { return this.renderData; } series() { return this.candleSeries; } chart() { return this.chartApi; } paneViews() { return [this.paneView]; }
  queryHit(x: number, y: number): StackedImbalanceHit | null {
    if (!this.renderData || !this.candleSeries || !this.chartApi) return null;
    let nearest: StackedImbalanceHit | null = null; let distance = Infinity;
    const inspect = (item: ImbalanceCell | ImbalanceZone, kind: StackedImbalanceHit["kind"], timestamp: number, tick: number) => { const itemX = this.chartApi!.timeScale().timeToCoordinate(Math.floor(timestamp / 1_000) as Time); const itemY = this.candleSeries!.priceToCoordinate(tick * this.renderData!.frame.tickSize); if (itemX === null || itemY === null) return; const next = Math.abs(Number(itemX) - x) + Math.abs(Number(itemY) - y); if (next < distance && Math.abs(Number(itemX) - x) < 28 && Math.abs(Number(itemY) - y) < 20) { distance = next; nearest = { x: Number(itemX), y: Number(itemY), item, kind }; } };
    this.renderData.frame.cells.filter((cell) => cell.qualified).forEach((cell) => inspect(cell, "cell", cell.timestamp, cell.tickIndex));
    this.renderData.frame.zones.forEach((zone) => inspect(zone, "zone", zone.endTimestamp, zone.centreTick));
    return nearest;
  }
}
