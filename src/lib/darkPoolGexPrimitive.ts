import type {
  IChartApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import { formatDarkPoolNotional, resolveDarkPoolGexLineLifecycle, type DarkPoolGexCluster, type DarkPoolGexEvent, type DarkPoolGexFrame, type DarkPoolGexSettings } from "@/lib/darkPoolGex";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];

export type DarkPoolGexPrimitiveData = {
  frame: DarkPoolGexFrame;
  settings: DarkPoolGexSettings;
  neutralColor: string;
  positiveGexColor: string;
  negativeGexColor: string;
  backgroundColor: string;
  currentPrice: number | null;
  timelineMs: number[];
};

export type DarkPoolGexHit = {
  x: number;
  y: number;
  event?: DarkPoolGexEvent;
  cluster?: DarkPoolGexCluster;
  frame: DarkPoolGexFrame;
};

type RenderedHit = DarkPoolGexHit & { left: number; right: number; top: number; bottom: number };
type DarkPoolRenderViewport = {
  width: number;
  height: number;
  firstX: number | null;
  lastX: number | null;
  firstY: number | null;
  lastY: number | null;
};
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const darkPoolDateFormatter = new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric", timeZone: "America/New_York" });

function rgba(color: string, opacity: number) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return color;
  return `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${clamp01(opacity)})`;
}

function timeCoordinate(chart: IChartApi, timestampMs: number, timelineMs: number[]) {
  const exact = chart.timeScale().timeToCoordinate(Math.floor(timestampMs / 1_000) as Time);
  if (exact !== null) return exact;
  let low = 0;
  let high = timelineMs.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (timelineMs[middle] < timestampMs) low = middle + 1;
    else high = middle;
  }
  const visibleStart = timelineMs[Math.min(low, timelineMs.length - 1)];
  return Number.isFinite(visibleStart) ? chart.timeScale().timeToCoordinate(Math.floor(visibleStart / 1_000) as Time) : null;
}

class DarkPoolGexRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: DarkPoolGexPrimitive) {}

  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const data = this.primitive.data();
    const chart = this.primitive.chart();
    const series = this.primitive.series();
    if (!data || !chart || !series) return;
    target.useMediaCoordinateSpace(({ context: targetContext, mediaSize }) => {
      if (mediaSize.width < 80 || mediaSize.height < 60) return;
      const firstTime = data.timelineMs[0] ?? 0;
      const lastTime = data.timelineMs.at(-1) ?? firstTime;
      const firstX = firstTime ? chart.timeScale().timeToCoordinate(Math.floor(firstTime / 1_000) as Time) : null;
      const lastX = lastTime ? chart.timeScale().timeToCoordinate(Math.floor(lastTime / 1_000) as Time) : null;
      let minimumPrice = Number.POSITIVE_INFINITY;
      let maximumPrice = Number.NEGATIVE_INFINITY;
      for (const event of data.frame.rawEvents) {
        minimumPrice = Math.min(minimumPrice, event.price);
        maximumPrice = Math.max(maximumPrice, event.price);
      }
      for (const cluster of data.frame.clusters) {
        minimumPrice = Math.min(minimumPrice, cluster.weightedPrice);
        maximumPrice = Math.max(maximumPrice, cluster.weightedPrice);
      }
      if (!Number.isFinite(minimumPrice)) minimumPrice = data.currentPrice ?? 0;
      if (!Number.isFinite(maximumPrice)) maximumPrice = data.currentPrice ?? minimumPrice;
      if (Math.abs(maximumPrice - minimumPrice) < 1e-9) maximumPrice = minimumPrice + 1;
      const firstY = series.priceToCoordinate(minimumPrice);
      const lastY = series.priceToCoordinate(maximumPrice);
      const viewport: DarkPoolRenderViewport = {
        width: mediaSize.width,
        height: mediaSize.height,
        firstX: firstX === null ? null : Number(firstX),
        lastX: lastX === null ? null : Number(lastX),
        firstY: firstY === null ? null : Number(firstY),
        lastY: lastY === null ? null : Number(lastY),
      };
      const layerKey = this.primitive.renderLayerKey(viewport);
      const cachedLayer = this.primitive.cachedLayer(layerKey);
      if (cachedLayer) {
        targetContext.drawImage(cachedLayer, 0, 0, cachedLayer.width, cachedLayer.height, 0, 0, mediaSize.width, mediaSize.height);
        return;
      }
      const transformedLayer = this.primitive.transformedLayer(viewport);
      if (transformedLayer) {
        targetContext.save();
        targetContext.beginPath();
        targetContext.rect(0, 0, mediaSize.width, mediaSize.height);
        targetContext.clip();
        targetContext.translate(transformedLayer.translateX, transformedLayer.translateY);
        targetContext.scale(transformedLayer.scaleX, transformedLayer.scaleY);
        targetContext.drawImage(
          transformedLayer.canvas,
          0,
          0,
          transformedLayer.canvas.width,
          transformedLayer.canvas.height,
          0,
          0,
          transformedLayer.sourceViewport.width,
          transformedLayer.sourceViewport.height,
        );
        targetContext.restore();
        this.primitive.setHits([]);
        this.primitive.scheduleRefinement(layerKey);
        return;
      }
      const layer = this.primitive.createLayer(mediaSize.width, mediaSize.height);
      const context = layer.context;
      const settings = data.settings;
      const hits: RenderedHit[] = [];
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();

      if (settings.displayMode !== "raw" && settings.clusterEnabled) {
        for (const cluster of data.frame.clusters) {
          const y = series.priceToCoordinate(cluster.weightedPrice);
          const start = timeCoordinate(chart, cluster.firstTimestampMs, data.timelineMs);
          if (y === null || start === null || Number(y) < -30 || Number(y) > mediaSize.height + 30) continue;
          const confluence = cluster.primaryConfluence;
          const lineColor = confluence?.signedExposure
            ? confluence.signedExposure >= 0 ? data.positiveGexColor : data.negativeGexColor
            : data.neutralColor;
          const invalidated = cluster.events.every((event) => resolveDarkPoolGexLineLifecycle(event.reaction).invalidated);
          const lineWidth = Math.max(1, Math.min(3, settings.bandThickness * (0.72 + 0.28 * cluster.visualStrength)));
          const opacity = invalidated
            ? Math.max(0.08, settings.haloIntensity / 100)
            : Math.max(0.78, settings.bandOpacity / 100) * (0.82 + 0.18 * cluster.visualStrength);
          context.save();
          context.lineCap = "round";
          context.setLineDash([1, Math.max(3, lineWidth * 2.6)]);
          context.strokeStyle = rgba(lineColor, opacity);
          context.lineWidth = lineWidth;
          context.beginPath();
          context.moveTo(Number(start), Number(y) + 0.5);
          context.lineTo(mediaSize.width, Number(y) + 0.5);
          context.stroke();
          context.restore();
          hits.push({ x: Number(start), y: Number(y), cluster, frame: data.frame, left: Number(start), right: mediaSize.width, top: Number(y) - 7, bottom: Number(y) + 7 });
        }
      }

      if (settings.displayMode !== "clusters") {
        for (const event of data.frame.rawEvents) {
          const x = timeCoordinate(chart, event.observableTimestampMs, data.timelineMs);
          const y = series.priceToCoordinate(event.price);
          if (x === null || y === null || Number(y) < -30 || Number(y) > mediaSize.height + 30) continue;
          const originX = Number(x);
          const originY = Number(y);
          const strength = event.visualStrength * event.ageFade;
          const confluence = event.primaryConfluence;
          const lineColor = confluence?.signedExposure
            ? confluence.signedExposure >= 0 ? data.positiveGexColor : data.negativeGexColor
            : data.neutralColor;
          const confluenceBoost = confluence?.role === "KING" ? 1 + settings.kingBoost / 300 : 1;
          const lineWidth = Math.max(1, Math.min(3, settings.bandThickness * (0.72 + 0.28 * strength) * confluenceBoost));
          const proximity = settings.proximityEmphasis && data.currentPrice !== null
            ? clamp01(1 - Math.abs(data.currentPrice - event.price) / Math.max(1e-9, settings.proximityDistance))
            : 0;
          const lifecycle = resolveDarkPoolGexLineLifecycle(event.reaction);
          const invalidatedX = lifecycle.invalidatedAtMs === null
            ? null
            : timeCoordinate(chart, lifecycle.invalidatedAtMs, data.timelineMs);
          const splitX = invalidatedX === null
            ? originX
            : Math.max(originX, Math.min(mediaSize.width, Number(invalidatedX)));
          const activeOpacity = Math.min(1, Math.max(0.82, settings.bandOpacity / 100) * (0.82 + 0.13 * strength + 0.05 * proximity));
          const invalidatedOpacity = Math.min(activeOpacity * 0.42, Math.max(0.08, settings.haloIntensity / 100));
          const drawDottedLine = (left: number, right: number, opacity: number) => {
            if (right <= left) return;
            context.save();
            context.lineCap = "round";
            context.setLineDash([1, Math.max(3, lineWidth * 2.6)]);
            context.strokeStyle = rgba(lineColor, opacity);
            context.lineWidth = lineWidth;
            context.beginPath();
            context.moveTo(left, originY);
            context.lineTo(right, originY);
            context.stroke();
            context.restore();
          };
          if (lifecycle.invalidated) {
            drawDottedLine(originX, splitX, activeOpacity);
            drawDottedLine(splitX, mediaSize.width, invalidatedOpacity);
          } else {
            drawDottedLine(originX, mediaSize.width, activeOpacity);
          }
          if (settings.showReactionMarkers && event.reaction) {
            for (const interaction of event.reaction.interactions) {
              const markerX = timeCoordinate(chart, interaction.touchTimestampMs, data.timelineMs);
              const markerY = series.priceToCoordinate(event.price);
              if (markerX === null || markerY === null) continue;
              const outcomeVisible = interaction.outcome === "HOLD"
                ? settings.showHoldMarkers
                : interaction.outcome === "BREAK"
                  ? settings.showBreakMarkers
                  : interaction.outcome === "RECLAIM"
                    ? settings.showReclaimMarkers
                    : true;
              if (!outcomeVisible) continue;
              const mx = Number(markerX);
              const my = Number(markerY);
              const markerColor = interaction.outcome === "BREAK"
                ? data.negativeGexColor
                : interaction.outcome === "HOLD" || interaction.outcome === "RECLAIM"
                  ? data.positiveGexColor
                  : data.neutralColor;
              context.save();
              context.strokeStyle = rgba(markerColor, 0.9);
              context.fillStyle = rgba(data.backgroundColor, 0.92);
              context.lineWidth = 1.25;
              context.beginPath();
              context.arc(mx, my, interaction.outcome === "UNRESOLVED" ? 2.5 : 4, 0, Math.PI * 2);
              context.fill();
              context.stroke();
              if (interaction.outcome === "HOLD") {
                context.beginPath();
                context.moveTo(mx - 2.2, my);
                context.lineTo(mx - 0.4, my + 2);
                context.lineTo(mx + 3, my - 2.5);
                context.stroke();
              } else if (interaction.outcome === "BREAK") {
                context.beginPath();
                context.moveTo(mx - 2.4, my - 2.4);
                context.lineTo(mx + 2.4, my + 2.4);
                context.moveTo(mx + 2.4, my - 2.4);
                context.lineTo(mx - 2.4, my + 2.4);
                context.stroke();
              } else if (interaction.outcome === "RECLAIM") {
                context.beginPath();
                context.arc(mx, my, 2.5, Math.PI * 0.2, Math.PI * 1.8);
                context.stroke();
              }
              if (settings.showReactionTrail && interaction.timeToReactionMs !== null && interaction.reactionDirection !== "NONE") {
                const trailX = timeCoordinate(chart, interaction.touchTimestampMs + interaction.timeToReactionMs, data.timelineMs);
                const reactionPrice = interaction.reactionDirection === "UP"
                  ? event.price + interaction.reactionMagnitude
                  : event.price - interaction.reactionMagnitude;
                const trailY = series.priceToCoordinate(reactionPrice);
                if (trailX !== null && trailY !== null) {
                  context.setLineDash([3, 3]);
                  context.strokeStyle = rgba(markerColor, 0.35);
                  context.beginPath();
                  context.moveTo(mx, my);
                  context.lineTo(Number(trailX), Number(trailY));
                  context.stroke();
                }
              }
              context.restore();
            }
          }
          const radius = settings.originMarkerSize * (0.55 + 0.75 * strength);
          if (settings.showOriginMarker) {
            const pulse = context.createRadialGradient(originX, originY, 0, originX, originY, radius * 1.8);
            pulse.addColorStop(0, rgba(data.neutralColor, 0.95));
            pulse.addColorStop(0.32, rgba(data.neutralColor, 0.72));
            pulse.addColorStop(1, rgba(data.neutralColor, 0));
            context.fillStyle = pulse;
            context.beginPath();
            context.arc(originX, originY, radius * 1.8, 0, Math.PI * 2);
            context.fill();
            context.fillStyle = data.neutralColor;
            context.beginPath();
            context.arc(originX, originY, Math.max(1.5, radius * 0.38), 0, Math.PI * 2);
            context.fill();
          }
          if (settings.showLabels) {
            const date = darkPoolDateFormatter.format(new Date(event.executionTimestampMs));
            const label = settings.labelExtended
              ? `DP ${formatDarkPoolNotional(event.notional)} · ${date} · ${event.price}`
              : `DP ${formatDarkPoolNotional(event.notional)} · ${date}`;
            context.save();
            context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
            context.textBaseline = "middle";
            const width = Math.ceil(context.measureText(label).width) + 10;
            const left = Math.max(originX + 6, mediaSize.width - width - 4);
            context.fillStyle = rgba(data.backgroundColor, 0.9);
            context.fillRect(left, originY - 8, width, 16);
            context.strokeStyle = rgba(lineColor, lifecycle.invalidated ? invalidatedOpacity : activeOpacity);
            context.lineWidth = 1;
            context.strokeRect(left + 0.5, originY - 7.5, width - 1, 15);
            context.fillStyle = rgba(lineColor, lifecycle.invalidated ? Math.max(0.45, invalidatedOpacity) : 1);
            context.fillText(label, left + 5, originY);
            context.restore();
          }
          hits.push({ x: originX, y: originY, event, frame: data.frame, left: originX - radius * 2, right: mediaSize.width, top: originY - 8, bottom: originY + 8 });
        }
      }
      context.restore();
      this.primitive.setHits(hits);
      this.primitive.storeLayer(layerKey, layer.canvas, viewport);
      targetContext.drawImage(layer.canvas, 0, 0, layer.canvas.width, layer.canvas.height, 0, 0, mediaSize.width, mediaSize.height);
    });
  }
}

class DarkPoolGexView implements ISeriesPrimitivePaneView {
  private readonly paneRenderer: DarkPoolGexRenderer;
  constructor(primitive: DarkPoolGexPrimitive) { this.paneRenderer = new DarkPoolGexRenderer(primitive); }
  zOrder() { return "bottom" as const; }
  renderer() { return this.paneRenderer; }
}

const activeDarkPoolGexPrimitives = new Set<DarkPoolGexPrimitive>();

export class DarkPoolGexPrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null;
  private chartApi: IChartApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderData: DarkPoolGexPrimitiveData | null = null;
  private renderedHits: RenderedHit[] = [];
  private renderRevision = 0;
  private layerKey = "";
  private layerCanvas: HTMLCanvasElement | null = null;
  private layerViewport: DarkPoolRenderViewport | null = null;
  private layerRevision = -1;
  private layerPanelCount = 0;
  private refinementTimer: ReturnType<typeof setTimeout> | null = null;
  private refinementKey = "";
  private readonly paneView = new DarkPoolGexView(this);

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) { this.candleSeries = param.series; this.chartApi = param.chart as IChartApi; this.requestRedraw = param.requestUpdate; }
  detached() {
    activeDarkPoolGexPrimitives.delete(this);
    if (this.refinementTimer !== null) clearTimeout(this.refinementTimer);
    this.refinementTimer = null;
    this.candleSeries = null;
    this.chartApi = null;
    this.requestRedraw = null;
    this.renderedHits = [];
    this.layerCanvas = null;
    this.layerViewport = null;
    this.layerKey = "";
  }
  update(data: DarkPoolGexPrimitiveData | null) {
    if (this.renderData !== data) {
      if (this.refinementTimer !== null) clearTimeout(this.refinementTimer);
      this.refinementTimer = null;
      this.refinementKey = "";
      this.renderRevision += 1;
      this.layerCanvas = null;
      this.layerViewport = null;
      this.layerKey = "";
    }
    this.renderData = data;
    if (data) activeDarkPoolGexPrimitives.add(this);
    else activeDarkPoolGexPrimitives.delete(this);
    if (!data) this.renderedHits = [];
    this.requestRedraw?.();
  }
  updateCurrentPrice(price: number | null) {
    // The candle series already schedules the live redraw. Mutating this one
    // scalar keeps proximity emphasis current without replacing the complete
    // frame and forcing a second canvas pass for every trade.
    if (this.renderData) this.renderData.currentPrice = price;
  }
  activePanelCount() { return Math.max(1, activeDarkPoolGexPrimitives.size); }
  renderLayerKey(viewport: DarkPoolRenderViewport) {
    const rounded = (value: number | null) => value === null ? "x" : Math.round(value * 4) / 4;
    return [
      this.renderRevision,
      this.activePanelCount(),
      Math.round(viewport.width),
      Math.round(viewport.height),
      rounded(viewport.firstX),
      rounded(viewport.lastX),
      rounded(viewport.firstY),
      rounded(viewport.lastY),
    ].join(":");
  }
  cachedLayer(key: string) { return key === this.layerKey ? this.layerCanvas : null; }
  transformedLayer(viewport: DarkPoolRenderViewport) {
    if (!this.layerCanvas || !this.layerViewport || this.layerRevision !== this.renderRevision || this.layerPanelCount !== this.activePanelCount()) return null;
    const axisTransform = (sourceStart: number | null, sourceEnd: number | null, targetStart: number | null, targetEnd: number | null) => {
      if (sourceStart === null || targetStart === null) return { scale: 1, translate: 0 };
      const sourceSpan = sourceEnd === null ? 0 : sourceEnd - sourceStart;
      const targetSpan = targetEnd === null ? 0 : targetEnd - targetStart;
      const scale = Math.abs(sourceSpan) > 0.001 && Number.isFinite(targetSpan) ? targetSpan / sourceSpan : 1;
      if (!Number.isFinite(scale) || scale < 0.04 || scale > 25) return null;
      return { scale, translate: targetStart - sourceStart * scale };
    };
    const horizontal = axisTransform(this.layerViewport.firstX, this.layerViewport.lastX, viewport.firstX, viewport.lastX);
    const vertical = axisTransform(this.layerViewport.firstY, this.layerViewport.lastY, viewport.firstY, viewport.lastY);
    if (!horizontal || !vertical) return null;
    return {
      canvas: this.layerCanvas,
      sourceViewport: this.layerViewport,
      scaleX: horizontal.scale,
      scaleY: vertical.scale,
      translateX: horizontal.translate,
      translateY: vertical.translate,
    };
  }
  scheduleRefinement(key: string) {
    if (this.refinementTimer !== null && this.refinementKey === key) return;
    if (this.refinementTimer !== null) clearTimeout(this.refinementTimer);
    this.refinementKey = key;
    this.refinementTimer = setTimeout(() => {
      this.refinementTimer = null;
      this.refinementKey = "";
      this.layerCanvas = null;
      this.layerViewport = null;
      this.layerKey = "";
      this.requestRedraw?.();
    }, 140);
  }
  createLayer(width: number, height: number) {
    const devicePixelRatio = typeof window === "undefined" ? 1 : Math.max(1, window.devicePixelRatio || 1);
    const activePanels = this.activePanelCount();
    const maximumRatio = activePanels >= 4 ? 1.25 : activePanels >= 2 ? 1.5 : 2;
    const pixelBudgetRatio = Math.sqrt(2_000_000 / Math.max(1, width * height));
    const pixelRatio = Math.max(1, Math.min(maximumRatio, devicePixelRatio, pixelBudgetRatio));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(width * pixelRatio));
    canvas.height = Math.max(1, Math.ceil(height * pixelRatio));
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Dark Pool GEX could not allocate its render layer.");
    context.scale(pixelRatio, pixelRatio);
    return { canvas, context };
  }
  storeLayer(key: string, canvas: HTMLCanvasElement, viewport: DarkPoolRenderViewport) {
    if (this.refinementTimer !== null) clearTimeout(this.refinementTimer);
    this.refinementTimer = null;
    this.refinementKey = "";
    this.layerKey = key;
    this.layerCanvas = canvas;
    this.layerViewport = viewport;
    this.layerRevision = this.renderRevision;
    this.layerPanelCount = this.activePanelCount();
  }
  series() { return this.candleSeries; }
  chart() { return this.chartApi; }
  data() { return this.renderData; }
  paneViews() { return [this.paneView]; }
  setHits(hits: RenderedHit[]) { this.renderedHits = hits; }
  queryHit(x: number, y: number): DarkPoolGexHit | null {
    const matches = this.renderedHits.filter((hit) => x >= hit.left && x <= hit.right && y >= hit.top && y <= hit.bottom);
    if (!matches.length) return null;
    return matches.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
  }
}
