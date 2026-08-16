import type {
  IChartApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import type { AuctionResult, PocAuctionFrame, PocAuctionSuiteSettings, PocResult } from "@/lib/pocAuctionSuite";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];

export type PocAuctionPrimitiveData = {
  frame: PocAuctionFrame;
  settings: PocAuctionSuiteSettings;
  backgroundColor: string;
};

export type PocAuctionHit = {
  x: number;
  y: number;
  kind: "poc" | "auction";
  item: PocResult | AuctionResult;
};

const clamp = (value: number, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));

function rgba(color: string, alpha: number) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const hex = match[1].length === 3 ? match[1].split("").map((part) => part + part).join("") : match[1];
  const value = Number.parseInt(hex, 16);
  return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${clamp(alpha)})`;
}

function pocColor(poc: PocResult, settings: PocAuctionSuiteSettings) {
  if (poc.state === "naked" || poc.state === "testing" || poc.state === "tested") return settings.nakedPocColor;
  return poc.scope === "bar" ? settings.barPocColor : settings.sessionPocColor;
}

function auctionColor(auction: AuctionResult, settings: PocAuctionSuiteSettings) {
  if (auction.completionState === "excess") return auction.extremeSide === "high" ? settings.excessHighColor : settings.excessLowColor;
  if (auction.completionState === "unfinished") return settings.unfinishedColor;
  return settings.finishedColor;
}

class PocAuctionRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: PocAuctionPrimitive) {}

  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const data = this.primitive.data();
    const chart = this.primitive.chart();
    const series = this.primitive.series();
    if (!data || !chart || !series) return;

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      if (mediaSize.width < 100 || mediaSize.height < 80) return;
      const { frame, settings } = data;
      const opacity = settings.opacity / 100;
      const laneWidth = settings.showActiveLane ? settings.activeLaneWidth : 0;
      const plotRight = Math.max(0, mediaSize.width - laneWidth);
      const timeToX = (timestamp: number) => chart.timeScale().timeToCoordinate(Math.floor(timestamp / 1_000) as Time);
      const tickToY = (tick: number) => series.priceToCoordinate(tick * frame.tickSize);

      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();

      if (settings.showDynamicPocLine) {
        const developing = frame.dynamicPocs.filter((poc) => poc.state === "developing").sort((a, b) => a.endTimeMs - b.endTimeMs);
        if (developing.length) {
          context.strokeStyle = rgba(settings.sessionPocColor, opacity * 0.9);
          context.lineWidth = Math.max(1, settings.lineWidth);
          context.beginPath();
          let started = false;
          for (const poc of developing) {
            const x = timeToX(poc.endTimeMs);
            const y = tickToY(poc.centreTick);
            if (x === null || y === null) continue;
            if (!started) { context.moveTo(Number(x), Number(y)); started = true; }
            else context.lineTo(Number(x), Number(y));
            if (poc.migrationTicks !== 0) {
              context.save();
              context.fillStyle = rgba(settings.sessionPocColor, opacity);
              context.beginPath();
              context.arc(Number(x), Number(y), Math.max(2.5, settings.markerSize * 0.35), 0, Math.PI * 2);
              context.fill();
              context.restore();
            }
          }
          context.stroke();
        }
      }

      if (settings.showBarPocMarkers) for (const poc of frame.barPocs) {
        const x1 = timeToX(poc.startTimeMs);
        const x2 = timeToX(poc.endTimeMs);
        const y = tickToY(poc.centreTick);
        if (x1 === null || y === null) continue;
        const right = x2 === null ? Number(x1) + 7 : Number(x2);
        const color = pocColor(poc, settings);
        context.strokeStyle = rgba(color, opacity * 0.9);
        context.lineWidth = Math.max(1, settings.lineWidth + 0.5);
        context.beginPath();
        context.moveTo(Number(x1), Number(y));
        context.lineTo(Math.max(Number(x1) + 4, right), Number(y));
        context.stroke();
      }

      if (settings.showExtendedLevels) for (const poc of frame.activePocs) {
        if (["retired", "expired"].includes(poc.state)) continue;
        const x = timeToX(poc.endTimeMs);
        const y = tickToY(poc.centreTick);
        if (x === null || y === null) continue;
        const color = pocColor(poc, settings);
        context.strokeStyle = rgba(color, opacity * (poc.state === "accepted" ? 0.42 : 0.72));
        context.lineWidth = settings.lineWidth;
        context.setLineDash(poc.state === "naked" ? [6, 4] : [3, 4]);
        context.beginPath();
        context.moveTo(Number(x), Number(y));
        context.lineTo(plotRight, Number(y));
        context.stroke();
        context.setLineDash([]);
        if (settings.showLabels && plotRight - Number(x) > 55) {
          context.font = "600 8px JetBrains Mono, monospace";
          context.fillStyle = rgba(color, opacity);
          context.textAlign = "right";
          context.textBaseline = "bottom";
          context.fillText(`${poc.scope.toUpperCase()} POC · ${poc.state.toUpperCase()}`, plotRight - 4, Number(y) - 2);
        }
      }

      if (settings.showAuctionMarkers) for (const auction of frame.auctions) {
        const x = timeToX(auction.sourceEndMs);
        const y = tickToY(auction.extremeTick);
        if (x === null || y === null) continue;
        const px = Number(x);
        const py = Number(y);
        const size = settings.markerSize;
        const color = auctionColor(auction, settings);
        context.strokeStyle = rgba(color, opacity);
        context.fillStyle = rgba(color, opacity * 0.2);
        context.lineWidth = Math.max(1, settings.lineWidth);

        if (auction.completionState === "excess") {
          context.beginPath();
          if (auction.extremeSide === "high") {
            context.moveTo(px, py - size); context.lineTo(px - size * 0.7, py + size * 0.35); context.lineTo(px + size * 0.7, py + size * 0.35);
          } else {
            context.moveTo(px, py + size); context.lineTo(px - size * 0.7, py - size * 0.35); context.lineTo(px + size * 0.7, py - size * 0.35);
          }
          context.closePath(); context.fill(); context.stroke();
        } else if (auction.completionState === "unfinished") {
          context.beginPath(); context.arc(px, py, size * 0.62, 0, Math.PI * 2); context.fill(); context.stroke();
        } else {
          const direction = auction.extremeSide === "high" ? -1 : 1;
          context.beginPath(); context.moveTo(px - size, py); context.lineTo(px + size, py); context.moveTo(px, py); context.lineTo(px, py + direction * size * 0.8); context.stroke();
        }

        if (auction.lifecycleState === "resolved" || auction.lifecycleState === "traded-through") {
          context.beginPath(); context.moveTo(px - 3, py - 3); context.lineTo(px + 3, py + 3); context.moveTo(px + 3, py - 3); context.lineTo(px - 3, py + 3); context.stroke();
        }
      }

      if (settings.showActiveLane) {
        const laneLeft = mediaSize.width - laneWidth;
        context.fillStyle = rgba(data.backgroundColor, 0.9);
        context.fillRect(laneLeft, 0, laneWidth, mediaSize.height);
        context.strokeStyle = rgba(settings.neutralColor, 0.28);
        context.beginPath(); context.moveTo(laneLeft, 0); context.lineTo(laneLeft, mediaSize.height); context.stroke();
        const activeItems = [
          ...frame.activePocs.map((item) => ({ kind: "POC", tick: item.centreTick, score: item.metricValue, color: pocColor(item, settings), label: `${item.scope.toUpperCase()} ${item.state.toUpperCase()}` })),
          ...frame.auctions.filter((item) => ["active-level", "revisiting", "revisited"].includes(item.lifecycleState)).map((item) => ({ kind: "AUC", tick: item.extremeTick, score: item.score, color: auctionColor(item, settings), label: `${item.completionState.toUpperCase()} ${item.extremeSide.toUpperCase()}` })),
        ].sort((a, b) => b.score - a.score).slice(0, settings.maximumActiveLaneRows);
        const max = Math.max(1, ...activeItems.map((item) => item.score));
        for (const item of activeItems) {
          const y = tickToY(item.tick);
          if (y === null) continue;
          const width = Math.max(10, (laneWidth - 10) * Math.sqrt(item.score / max));
          context.fillStyle = rgba(item.color, opacity * 0.62);
          context.fillRect(mediaSize.width - width - 3, Number(y) - 4, width, 8);
          if (settings.showLabels && width > 58) {
            context.font = "600 7px JetBrains Mono, monospace";
            context.textAlign = "right"; context.textBaseline = "middle"; context.fillStyle = rgba("#FFFFFF", 0.92);
            context.fillText(item.label, mediaSize.width - 5, Number(y));
          }
        }
      }

      if (settings.showLowerPane && frame.dynamicPocs.length) {
        const paneHeight = Math.min(88, mediaSize.height * 0.2);
        const top = mediaSize.height - paneHeight;
        const migrations = frame.dynamicPocs.slice(-120);
        const max = Math.max(1, ...migrations.map((poc) => Math.abs(poc.migrationTicks)));
        const baseline = top + paneHeight / 2;
        context.fillStyle = rgba(data.backgroundColor, 0.94); context.fillRect(0, top, plotRight, paneHeight);
        context.strokeStyle = rgba(settings.neutralColor, 0.25); context.beginPath(); context.moveTo(0, top); context.lineTo(plotRight, top); context.moveTo(0, baseline); context.lineTo(plotRight, baseline); context.stroke();
        for (const poc of migrations) {
          const x = timeToX(poc.endTimeMs); if (x === null) continue;
          const height = Math.abs(poc.migrationTicks) / max * paneHeight * 0.42;
          context.fillStyle = rgba(poc.migrationTicks >= 0 ? settings.excessLowColor : settings.excessHighColor, opacity * 0.82);
          context.fillRect(Number(x) - 2, poc.migrationTicks >= 0 ? baseline - height : baseline, 4, height);
        }
      }

      context.restore();
    });
  }
}

class PocAuctionPaneView implements ISeriesPrimitivePaneView {
  private readonly paneRenderer: PocAuctionRenderer;
  constructor(primitive: PocAuctionPrimitive) { this.paneRenderer = new PocAuctionRenderer(primitive); }
  zOrder() { return "bottom" as const; }
  renderer() { return this.paneRenderer; }
}

export class PocAuctionPrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null;
  private chartApi: IChartApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderData: PocAuctionPrimitiveData | null = null;
  private readonly paneView = new PocAuctionPaneView(this);

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) {
    this.candleSeries = param.series;
    this.chartApi = param.chart as IChartApi;
    this.requestRedraw = param.requestUpdate;
  }
  detached() { this.candleSeries = null; this.chartApi = null; this.requestRedraw = null; }
  update(data: PocAuctionPrimitiveData | null) { this.renderData = data; this.requestRedraw?.(); }
  data() { return this.renderData; }
  series() { return this.candleSeries; }
  chart() { return this.chartApi; }
  paneViews() { return [this.paneView]; }

  queryHit(x: number, y: number): PocAuctionHit | null {
    if (!this.renderData || !this.candleSeries || !this.chartApi) return null;
    const { frame } = this.renderData;
    let nearest: PocAuctionHit | null = null;
    let distance = Number.POSITIVE_INFINITY;
    const inspect = (item: PocResult | AuctionResult, kind: PocAuctionHit["kind"], timestamp: number, tick: number) => {
      const itemX = this.chartApi!.timeScale().timeToCoordinate(Math.floor(timestamp / 1_000) as Time);
      const itemY = this.candleSeries!.priceToCoordinate(tick * frame.tickSize);
      if (itemX === null || itemY === null) return;
      const next = Math.abs(Number(itemX) - x) + Math.abs(Number(itemY) - y);
      if (next < distance && Math.abs(Number(itemX) - x) < 36 && Math.abs(Number(itemY) - y) < 18) {
        distance = next;
        nearest = { x: Number(itemX), y: Number(itemY), item, kind };
      }
    };
    frame.barPocs.forEach((item) => inspect(item, "poc", item.endTimeMs, item.centreTick));
    frame.activePocs.forEach((item) => inspect(item, "poc", item.endTimeMs, item.centreTick));
    frame.auctions.forEach((item) => inspect(item, "auction", item.sourceEndMs, item.extremeTick));
    return nearest;
  }
}
