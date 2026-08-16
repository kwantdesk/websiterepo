import type {
  IChartApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import type {
  PullingStackingEvent,
  PullingStackingFrame,
  PullingStackingMetrics,
  PullingStackingRow,
  PullingStackingSettings,
} from "@/lib/pullingStacking";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];

export type PullingStackingPrimitiveData = {
  frame: PullingStackingFrame;
  settings: PullingStackingSettings;
  backgroundColor: string;
};

export type PullingStackingHit = {
  x: number;
  y: number;
  row: PullingStackingRow;
  event: PullingStackingEvent | null;
  timestamp: number;
};

const clamp = (value: number, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));

function rgba(color: string, alpha: number) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!match) {
    const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color);
    if (rgb) return `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${clamp(alpha)})`;
    return `rgba(161,161,170,${clamp(alpha)})`;
  }
  const hex = match[1].length === 3 ? match[1].split("").map((part) => part + part).join("") : match[1];
  const value = Number.parseInt(hex, 16);
  return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${clamp(alpha)})`;
}

function colorForEvent(event: PullingStackingEvent, settings: PullingStackingSettings) {
  if (event.kind === "BID_STACK") return settings.bidStackColor;
  if (event.kind === "ASK_STACK") return settings.askStackColor;
  if (event.kind === "BID_PULL") return settings.bidPullColor;
  if (event.kind === "ASK_PULL") return settings.askPullColor;
  const isRemoval = event.wallCollapse || event.liquidityVacuum;
  if (event.side === "BID") return isRemoval ? settings.bidPullColor : settings.bidStackColor;
  return isRemoval ? settings.askPullColor : settings.askStackColor;
}

function colorForRow(row: PullingStackingRow, settings: PullingStackingSettings) {
  if (row.pressure >= 0) return row.bidStack >= row.askPull ? settings.bidStackColor : settings.askPullColor;
  return row.askStack >= row.bidPull ? settings.askStackColor : settings.bidPullColor;
}

class Renderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: PullingStackingPrimitive) {}

  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const data = this.primitive.data();
    const series = this.primitive.series();
    const chart = this.primitive.chart();
    if (!data || !series || !chart || !data.frame.bookValid) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      if (mediaSize.width < 100 || mediaSize.height < 80) return;
      const { frame, settings } = data;
      const opacity = settings.opacity / 100;
      const center = frame.lastPrice ?? frame.bestBid ?? frame.bestAsk;
      const minimumPrice = center === null ? -Infinity : center - settings.visibleTicks * frame.tickSize;
      const maximumPrice = center === null ? Infinity : center + settings.visibleTicks * frame.tickSize;
      const rowHeight = Math.max(settings.minimumCellHeightPx, Math.min(settings.maximumCellHeightPx, Math.abs(
        Number(series.priceToCoordinate((center ?? 0) + frame.tickSize) ?? 0)
        - Number(series.priceToCoordinate(center ?? 0) ?? 0),
      ) || 4));
      const maxChurn = Math.max(1, ...frame.buckets.flatMap((bucket) => bucket.rows.map((row) => row.churn)), ...frame.rows.map((row) => row.churn));

      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();

      const showHeat = settings.renderMode === "hybrid" || settings.renderMode === "heat-cells" || settings.showHeatCells;
      if (showHeat) {
        for (let bucketIndex = 0; bucketIndex < frame.buckets.length; bucketIndex += 1) {
          const bucket = frame.buckets[bucketIndex];
          const x = chart.timeScale().timeToCoordinate(Math.floor(bucket.timestamp / 1_000) as Time);
          if (x === null) continue;
          const next = frame.buckets[bucketIndex + 1];
          const nextX = next ? chart.timeScale().timeToCoordinate(Math.floor(next.timestamp / 1_000) as Time) : null;
          const cellWidth = Math.max(2, Math.min(26, nextX === null ? 5 : Number(nextX) - Number(x) + 1));
          for (const row of bucket.rows) {
            if (row.price < minimumPrice || row.price > maximumPrice || row.churn <= 0) continue;
            const y = series.priceToCoordinate(row.price);
            if (y === null || y < -rowHeight || y > mediaSize.height + rowHeight) continue;
            const strength = Math.sqrt(row.churn / maxChurn);
            const cellOpacity = settings.minimumOpacity + strength * (settings.maximumOpacity - settings.minimumOpacity);
            context.fillStyle = rgba(colorForRow(row, settings), cellOpacity * opacity);
            context.fillRect(Number(x) - cellWidth / 2, Number(y) - rowHeight / 2, cellWidth, rowHeight);
          }
        }
      }

      if (settings.showRibbons || settings.renderMode === "ribbons") {
        const strongestByBucket = frame.buckets.map((bucket) => bucket.rows
          .filter((row) => row.price >= minimumPrice && row.price <= maximumPrice)
          .sort((left, right) => right.score - left.score)[0])
          .filter((row): row is PullingStackingRow => Boolean(row));
        context.lineWidth = 1.25;
        for (let index = 1; index < strongestByBucket.length; index += 1) {
          const previousRow = strongestByBucket[index - 1];
          const row = strongestByBucket[index];
          const previousBucket = frame.buckets[Math.max(0, frame.buckets.length - strongestByBucket.length + index - 1)];
          const bucket = frame.buckets[Math.max(0, frame.buckets.length - strongestByBucket.length + index)];
          const x1 = chart.timeScale().timeToCoordinate(Math.floor(previousBucket.timestamp / 1_000) as Time);
          const x2 = chart.timeScale().timeToCoordinate(Math.floor(bucket.timestamp / 1_000) as Time);
          const y1 = series.priceToCoordinate(previousRow.price);
          const y2 = series.priceToCoordinate(row.price);
          if ([x1, x2, y1, y2].some((value) => value === null)) continue;
          context.strokeStyle = rgba(colorForRow(row, settings), opacity * 0.7);
          context.beginPath(); context.moveTo(Number(x1), Number(y1)); context.lineTo(Number(x2), Number(y2)); context.stroke();
        }
      }

      if (settings.showEventMarkers || settings.renderMode === "event-markers") {
        for (const event of frame.events) {
          if (event.score < settings.markerMinimumScore) continue;
          if (event.price < minimumPrice || event.price > maximumPrice) continue;
          if ((!settings.showWallBuild && event.wallBuild) || (!settings.showWallCollapse && event.wallCollapse) || (!settings.showLiquidityVacuum && event.liquidityVacuum)) continue;
          const x = chart.timeScale().timeToCoordinate(Math.floor(event.timestamp / 1_000) as Time);
          const y = series.priceToCoordinate(event.price);
          if (x === null || y === null) continue;
          const radius = clamp(settings.markerSize + Math.log10(Math.max(1, event.quantity)), 4, 16);
          const color = colorForEvent(event, settings);
          context.strokeStyle = rgba(color, opacity * 0.95);
          context.fillStyle = rgba(color, opacity * 0.18);
          context.lineWidth = event.liquidityVacuum ? 2 : 1;
          context.beginPath(); context.arc(Number(x), Number(y), radius, 0, Math.PI * 2); context.fill(); context.stroke();
          if (settings.showLabels && (event.wallBuild || event.wallCollapse || event.liquidityVacuum || event.pullRepost)) {
            const label = event.wallBuild ? "WALL" : event.wallCollapse ? "COLLAPSE" : event.liquidityVacuum ? "VACUUM" : "REPOST";
            context.font = "8px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
            context.fillStyle = rgba(color, opacity * 0.92);
            context.fillText(label, Number(x) + radius + 3, Number(y) + 3);
          }
        }
      }

      if (settings.showCurrentProfile || settings.renderMode === "current-profile") {
        const profileRows = frame.rows.filter((row) => row.price >= minimumPrice && row.price <= maximumPrice && (row.churn > 0 || row.bidSize > 0 || row.askSize > 0));
        const maximum = Math.max(1, ...profileRows.map((row) => Math.max(row.bidStack, row.askStack, row.bidPull, row.askPull, settings.showLiveDepth ? row.bidSize : 0, settings.showLiveDepth ? row.askSize : 0)));
        const laneWidth = clamp(mediaSize.width * settings.profileWidthPercent / 100, settings.minimumProfileWidthPx, settings.maximumProfileWidthPx);
        const right = mediaSize.width - 4;
        const centerX = right - laneWidth / 2;
        for (const row of profileRows) {
          const y = series.priceToCoordinate(row.price);
          if (y === null) continue;
          if (settings.showLiveDepth) {
            const bidDepthWidth = laneWidth / 2 * Math.sqrt(row.bidSize / maximum);
            const askDepthWidth = laneWidth / 2 * Math.sqrt(row.askSize / maximum);
            context.fillStyle = rgba(settings.bidStackColor, opacity * .12); context.fillRect(centerX - bidDepthWidth, Number(y) - rowHeight / 2, bidDepthWidth, rowHeight);
            context.fillStyle = rgba(settings.askStackColor, opacity * .12); context.fillRect(centerX, Number(y) - rowHeight / 2, askDepthWidth, rowHeight);
          }
          const bidWidth = laneWidth / 2 * Math.sqrt(Math.max(row.bidStack, row.bidPull) / maximum);
          const askWidth = laneWidth / 2 * Math.sqrt(Math.max(row.askStack, row.askPull) / maximum);
          context.fillStyle = rgba(row.bidPull > row.bidStack ? settings.bidPullColor : settings.bidStackColor, opacity * .72);
          context.fillRect(centerX - bidWidth, Number(y) - rowHeight * .36, bidWidth, rowHeight * .72);
          context.fillStyle = rgba(row.askPull > row.askStack ? settings.askPullColor : settings.askStackColor, opacity * .72);
          context.fillRect(centerX, Number(y) - rowHeight * .36, askWidth, rowHeight * .72);
        }
      }

      if (settings.showLowerPane || settings.renderMode === "lower-pane") {
        const paneHeight = Math.min(settings.lowerPaneHeight, Math.max(80, mediaSize.height * 0.14));
        const top = mediaSize.height - paneHeight;
        context.fillStyle = rgba(data.backgroundColor, 0.88); context.fillRect(0, top, mediaSize.width, paneHeight);
        context.strokeStyle = rgba(settings.neutralColor, 0.25); context.beginPath(); context.moveTo(0, top); context.lineTo(mediaSize.width, top); context.stroke();
        const valueFor = (row: PullingStackingMetrics) => {
          if (settings.lowerPaneMode === "net-book-change") return row.netBidDisplayedChange + row.netAskDisplayedChange;
          if (settings.lowerPaneMode === "churn") return row.churn;
          if (settings.lowerPaneMode === "velocity") return row.velocity;
          if (settings.lowerPaneMode === "stack-pull-ratio") return row.stackPullRatio - 1;
          return row.pressure;
        };
        const seriesDefinitions = settings.lowerPaneMode === "four-series"
          ? [
              { value: (row: PullingStackingMetrics) => row.bidStack, color: settings.bidStackColor },
              { value: (row: PullingStackingMetrics) => -row.bidPull, color: settings.bidPullColor },
              { value: (row: PullingStackingMetrics) => -row.askStack, color: settings.askStackColor },
              { value: (row: PullingStackingMetrics) => row.askPull, color: settings.askPullColor },
            ]
          : [{ value: valueFor, color: frame.totals.pressure >= 0 ? settings.bidStackColor : settings.askStackColor }];
        const maximum = Math.max(1, ...seriesDefinitions.flatMap((definition) => frame.buckets.map((bucket) => Math.abs(definition.value(bucket.totals)))));
        for (const definition of seriesDefinitions) {
          let started = false;
          context.beginPath();
          for (const bucket of frame.buckets) {
            const x = chart.timeScale().timeToCoordinate(Math.floor(bucket.timestamp / 1_000) as Time);
            if (x === null) continue;
            const y = top + paneHeight / 2 - (definition.value(bucket.totals) / maximum) * (paneHeight * 0.42);
            if (!started) { context.moveTo(Number(x), y); started = true; } else context.lineTo(Number(x), y);
          }
          if (!started) continue;
          context.strokeStyle = rgba(definition.color, 0.88);
          context.lineWidth = seriesDefinitions.length > 1 ? 1 : 1.5;
          context.stroke();
        }
      }
      context.restore();
    });
  }
}

class PaneView implements ISeriesPrimitivePaneView {
  private readonly paneRenderer: Renderer;
  constructor(primitive: PullingStackingPrimitive) { this.paneRenderer = new Renderer(primitive); }
  zOrder() { return "bottom" as const; }
  renderer() { return this.paneRenderer; }
}

export class PullingStackingPrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null;
  private chartApi: IChartApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderData: PullingStackingPrimitiveData | null = null;
  private readonly paneView = new PaneView(this);

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) {
    this.candleSeries = param.series;
    this.chartApi = param.chart as IChartApi;
    this.requestRedraw = param.requestUpdate;
  }
  detached() { this.candleSeries = null; this.chartApi = null; this.requestRedraw = null; }
  update(data: PullingStackingPrimitiveData | null) { this.renderData = data; this.requestRedraw?.(); }
  series() { return this.candleSeries; }
  chart() { return this.chartApi; }
  data() { return this.renderData; }
  paneViews() { return [this.paneView]; }

  queryHit(x: number, y: number): PullingStackingHit | null {
    if (!this.renderData || !this.candleSeries || !this.chartApi) return null;
    let nearest: PullingStackingHit | null = null;
    for (const bucket of this.renderData.frame.buckets) {
      const bucketX = this.chartApi.timeScale().timeToCoordinate(Math.floor(bucket.timestamp / 1_000) as Time);
      if (bucketX === null || Math.abs(Number(bucketX) - x) > 18) continue;
      for (const row of bucket.rows) {
        const rowY = this.candleSeries.priceToCoordinate(row.price);
        if (rowY === null || Math.abs(Number(rowY) - y) > 12) continue;
        const event = [...this.renderData.frame.events].reverse().find((candidate) => candidate.tick === row.tick && Math.abs(candidate.timestamp - bucket.timestamp) <= this.renderData!.settings.aggregationMs) ?? null;
        const candidate = { x: Number(bucketX), y: Number(rowY), row, event, timestamp: bucket.timestamp };
        if (!nearest || Math.abs(candidate.x - x) + Math.abs(candidate.y - y) < Math.abs(nearest.x - x) + Math.abs(nearest.y - y)) nearest = candidate;
      }
    }
    return nearest;
  }
}
