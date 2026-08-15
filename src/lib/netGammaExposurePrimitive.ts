import type {
  IChartApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import type {
  GammaBarVisualMode,
  GammaProfileContentMode,
  GammaProfilePlacement,
  GammaScaleMode,
  GammaScaleTransform,
  NetGammaProfileSnapshot,
  NetGammaStrikeRow,
} from "@/lib/netGammaExposureByStrike";
import { formatGammaValue } from "@/lib/netGammaExposureByStrike";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];

export type NetGammaExposurePrimitiveData = {
  snapshot: NetGammaProfileSnapshot;
  placement: GammaProfilePlacement;
  laneWidthPercent: number;
  minimumLaneWidthPx: number;
  maximumLaneWidthPx: number;
  floatingXPercent: number;
  zeroSpinePercent: number;
  reverseDirections: boolean;
  minimumBarHeightPx: number;
  maximumBarHeightPx: number;
  fixedBarHeightPx: number;
  barHeightMode: "automatic" | "fixed-pixels" | "mapped-price-bin";
  barGapPx: number;
  horizontalPaddingPx: number;
  scaleMode: GammaScaleMode;
  scaleTransform: GammaScaleTransform;
  scalePercentile: number;
  fixedMaximum: number | null;
  logarithmicStrength: number;
  sharePositiveNegativeScale: boolean;
  contentMode: GammaProfileContentMode;
  visualMode: GammaBarVisualMode;
  opacity: number;
  borderOpacity: number;
  borderWidth: number;
  gradientStrength: number;
  showZeroSpine: boolean;
  showValues: boolean;
  showMappedPrice: boolean;
  showMaxPositive: boolean;
  showMaxNegative: boolean;
  showDominantAbsolute: boolean;
  showCallWall: boolean;
  showPutWall: boolean;
  showCurrentPrice: boolean;
  maximumDisplayedRows: number;
  minimumPercentageOfTotal: number;
  minimumAbsoluteExposure: number;
  maximumDistanceFromSourceSpot: number;
  minimumMappingConfidence: number;
  fadeWhenBelowMinimum: boolean;
  hideWhenBelowMinimum: boolean;
  positiveColor: string;
  negativeColor: string;
  callColor: string;
  putColor: string;
  absoluteColor: string;
  zeroSpineColor: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  mutedTextColor: string;
  warningColor: string;
  currentPriceColor: string;
  precision: number;
};

export type NetGammaExposureHit = {
  x: number;
  y: number;
  row: NetGammaStrikeRow;
  snapshot: NetGammaProfileSnapshot;
};

type RenderedHit = NetGammaExposureHit & { left: number; right: number; height: number };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function hexToRgb(color: string) {
  const short = /^#([0-9a-f]{3})$/i.exec(color);
  const long = /^#([0-9a-f]{6})$/i.exec(color);
  const hex = long?.[1] ?? short?.[1].split("").map((part) => `${part}${part}`).join("");
  if (!hex) return { r: 255, g: 255, b: 255 };
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
}

function alpha(color: string, opacity: number) {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r},${g},${b},${clamp(opacity, 0, 1)})`;
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(clamp(fraction, 0, 1) * sorted.length) - 1))] || 1;
}

function rowValue(row: NetGammaStrikeRow, mode: GammaProfileContentMode) {
  return mode === "absolute-concentration" ? row.absoluteTotalExposure : row.netExposure;
}

function transformMagnitude(value: number, mode: GammaScaleTransform, logStrength: number) {
  const normalized = clamp(value, 0, 1);
  if (mode === "square-root") return Math.sqrt(normalized);
  if (mode === "logarithmic") return Math.log1p(Math.max(1, logStrength) * normalized) / Math.log1p(Math.max(1, logStrength));
  return normalized;
}

class NetGammaExposureRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: NetGammaExposurePrimitive) {}

  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const series = this.primitive.series();
    const data = this.primitive.data();
    if (!series || !data || !data.snapshot.rows.length) {
      this.primitive.setHits([]);
      return;
    }
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      if (mediaSize.width < 140 || mediaSize.height < 80) return;
      const belowMappingMinimum = data.snapshot.mapping.mappingConfidence < data.minimumMappingConfidence;
      if (belowMappingMinimum && data.hideWhenBelowMinimum) {
        this.primitive.setHits([]);
        return;
      }
      const confidenceOpacity = belowMappingMinimum && data.fadeWhenBelowMinimum ? 0.38 : 1;
      const laneWidth = clamp(mediaSize.width * data.laneWidthPercent / 100, data.minimumLaneWidthPx, Math.min(data.maximumLaneWidthPx, mediaSize.width - 24));
      const laneLeft = data.placement === "left"
        ? data.horizontalPaddingPx
        : data.placement === "floating"
          ? clamp(mediaSize.width * data.floatingXPercent / 100 - laneWidth / 2, data.horizontalPaddingPx, mediaSize.width - laneWidth - data.horizontalPaddingPx)
          : mediaSize.width - laneWidth - data.horizontalPaddingPx;
      const zeroX = laneLeft + laneWidth * clamp(data.zeroSpinePercent, 5, 95) / 100;
      const leftCapacity = Math.max(1, zeroX - laneLeft - 3);
      const rightCapacity = Math.max(1, laneLeft + laneWidth - zeroX - 3);
      let rows = data.snapshot.rows
        .map((row) => {
          const coordinate = series.priceToCoordinate(row.mappedDisplayPrice);
          return { row, y: coordinate === null ? null : Number(coordinate) };
        })
        .filter((entry): entry is { row: NetGammaStrikeRow; y: number } => entry.y !== null && entry.y >= -24 && entry.y <= mediaSize.height + 24)
        .filter((entry) => entry.row.absoluteTotalExposure >= data.minimumAbsoluteExposure)
        .filter((entry) => data.maximumDistanceFromSourceSpot <= 0
          || Math.abs(entry.row.sourceStrike - data.snapshot.sourceSpotPrice) <= data.maximumDistanceFromSourceSpot)
        .filter((entry) => entry.row.percentageOfTotalAbsoluteExposure >= data.minimumPercentageOfTotal);
      if (rows.length > data.maximumDisplayedRows) {
        const ids = new Set([...rows].sort((a, b) => Math.abs(rowValue(b.row, data.contentMode)) - Math.abs(rowValue(a.row, data.contentMode))).slice(0, data.maximumDisplayedRows).map((entry) => entry.row.id));
        rows = rows.filter((entry) => ids.has(entry.row.id));
      }
      rows.sort((a, b) => a.y - b.y);
      const componentMode = data.contentMode === "call-put-split" || data.contentMode === "net-with-call-put-detail";
      const magnitudes = rows.map(({ row }) => componentMode
        ? Math.max(Math.abs(row.netExposure), row.absoluteCallExposure, row.absolutePutExposure)
        : Math.abs(rowValue(row, data.contentMode)));
      const visibleAbsoluteExposure = rows.reduce((sum, entry) => sum + entry.row.absoluteTotalExposure, 0);
      const positiveMagnitudes = componentMode
        ? rows.map(({ row }) => row.absoluteCallExposure)
        : rows.filter(({ row }) => rowValue(row, data.contentMode) >= 0).map(({ row }) => Math.abs(rowValue(row, data.contentMode)));
      const negativeMagnitudes = componentMode
        ? rows.map(({ row }) => row.absolutePutExposure)
        : rows.filter(({ row }) => rowValue(row, data.contentMode) < 0).map(({ row }) => Math.abs(rowValue(row, data.contentMode)));
      const loadedMagnitudes = data.snapshot.rows.map((row) => componentMode
        ? Math.max(Math.abs(row.netExposure), row.absoluteCallExposure, row.absolutePutExposure)
        : Math.abs(rowValue(row, data.contentMode)));
      const loadedPositiveMagnitudes = componentMode
        ? data.snapshot.rows.map((row) => row.absoluteCallExposure)
        : data.snapshot.rows.filter((row) => rowValue(row, data.contentMode) >= 0).map((row) => Math.abs(rowValue(row, data.contentMode)));
      const loadedNegativeMagnitudes = componentMode
        ? data.snapshot.rows.map((row) => row.absolutePutExposure)
        : data.snapshot.rows.filter((row) => rowValue(row, data.contentMode) < 0).map((row) => Math.abs(rowValue(row, data.contentMode)));
      const ceilingFor = (values: number[], loadedValues: number[]) => data.scaleMode === "fixed-maximum" && data.fixedMaximum
        ? data.fixedMaximum
        : data.scaleMode === "visible-percentile"
          ? percentile(values, data.scalePercentile)
          : data.scaleMode === "all-loaded-maximum"
            ? Math.max(1, ...loadedValues)
            : Math.max(1, ...values);
      const sharedCeiling = ceilingFor(magnitudes, loadedMagnitudes);
      const positiveCeiling = data.sharePositiveNegativeScale ? sharedCeiling : ceilingFor(positiveMagnitudes, loadedPositiveMagnitudes);
      const negativeCeiling = data.sharePositiveNegativeScale ? sharedCeiling : ceilingFor(negativeMagnitudes, loadedNegativeMagnitudes);
      const hits: RenderedHit[] = [];

      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();
      if (data.backgroundColor && data.opacity > 0) {
        context.fillStyle = alpha(data.backgroundColor, 0.045);
        context.fillRect(laneLeft, 0, laneWidth, mediaSize.height);
        context.strokeStyle = alpha(data.borderColor, 0.28);
        context.lineWidth = 1;
        context.strokeRect(laneLeft + 0.5, 0.5, laneWidth - 1, mediaSize.height - 1);
      }
      if (data.showZeroSpine) {
        context.strokeStyle = alpha(data.zeroSpineColor, 0.55);
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(Math.round(zeroX) + 0.5, 0);
        context.lineTo(Math.round(zeroX) + 0.5, mediaSize.height);
        context.stroke();
      }

      rows.forEach(({ row, y }, index) => {
        const value = rowValue(row, data.contentMode);
        const positive = data.contentMode === "absolute-concentration" || value >= 0;
        const ceiling = positive ? positiveCeiling : negativeCeiling;
        const normalized = transformMagnitude(ceiling > 0 ? Math.abs(value) / ceiling : 0, data.scaleTransform, data.logarithmicStrength);
        const capacity = positive ? rightCapacity : leftCapacity;
        const width = Math.max(data.visualMode === "compact-line" ? 3 : 1, normalized * capacity);
        const adjacentDistances = [rows[index - 1], rows[index + 1]].filter(Boolean).map((entry) => Math.abs(entry.y - y)).filter((distance) => distance > 0);
        const automaticHeight = adjacentDistances.length ? Math.min(...adjacentDistances) * 0.72 - data.barGapPx : data.fixedBarHeightPx;
        const mappedBinHeight = adjacentDistances.length ? Math.min(...adjacentDistances) * 0.92 - data.barGapPx : data.fixedBarHeightPx;
        const requestedHeight = data.barHeightMode === "fixed-pixels"
          ? data.fixedBarHeightPx
          : data.barHeightMode === "mapped-price-bin"
            ? mappedBinHeight
            : automaticHeight;
        const height = data.visualMode === "compact-line" ? 2 : clamp(requestedHeight, data.minimumBarHeightPx, data.maximumBarHeightPx);
        const detailCallWidth = transformMagnitude(positiveCeiling > 0 ? row.absoluteCallExposure / positiveCeiling : 0, data.scaleTransform, data.logarithmicStrength) * rightCapacity;
        const detailPutWidth = transformMagnitude(negativeCeiling > 0 ? row.absolutePutExposure / negativeCeiling : 0, data.scaleTransform, data.logarithmicStrength) * leftCapacity;
        const callGrowsRight = !data.reverseDirections;
        const putGrowsRight = data.reverseDirections;
        const callX = callGrowsRight ? zeroX : zeroX - detailCallWidth;
        const putX = putGrowsRight ? zeroX : zeroX - detailPutWidth;
        if (data.contentMode === "call-put-split") {
          const halfHeight = Math.max(1, height / 2);
          context.fillStyle = alpha(data.callColor, data.opacity * confidenceOpacity);
          context.fillRect(callX, y - halfHeight, detailCallWidth, halfHeight);
          context.fillStyle = alpha(data.putColor, data.opacity * confidenceOpacity);
          context.fillRect(putX, y, detailPutWidth, halfHeight);
          if (data.borderWidth > 0) {
            context.lineWidth = data.borderWidth;
            context.strokeStyle = alpha(data.callColor, data.borderOpacity * confidenceOpacity);
            context.strokeRect(callX + 0.5, y - halfHeight + 0.5, Math.max(1, detailCallWidth - 1), Math.max(1, halfHeight - 1));
            context.strokeStyle = alpha(data.putColor, data.borderOpacity * confidenceOpacity);
            context.strokeRect(putX + 0.5, y + 0.5, Math.max(1, detailPutWidth - 1), Math.max(1, halfHeight - 1));
          }
          const hitLeft = Math.min(callX, putX);
          const hitRight = Math.max(callX + detailCallWidth, putX + detailPutWidth);
          hits.push({
            x: (hitLeft + hitRight) / 2,
            y,
            row: { ...row, percentageOfVisibleAbsoluteExposure: visibleAbsoluteExposure > 0 ? row.absoluteTotalExposure / visibleAbsoluteExposure : 0 },
            snapshot: data.snapshot,
            left: hitLeft,
            right: hitRight,
            height,
          });
          return;
        }
        const growsRight = data.reverseDirections ? !positive : positive;
        const x = growsRight ? zeroX : zeroX - width;
        const color = data.contentMode === "absolute-concentration" ? data.absoluteColor : positive ? data.positiveColor : data.negativeColor;
        const top = y - height / 2;
        if (data.visualMode === "outline") {
          context.strokeStyle = alpha(color, data.borderOpacity * confidenceOpacity);
          context.lineWidth = Math.max(1, data.borderWidth);
          context.strokeRect(x + 0.5, top + 0.5, Math.max(1, width - 1), Math.max(1, height - 1));
        } else if (data.visualMode === "gradient" || data.visualMode === "heat") {
          const gradient = context.createLinearGradient(growsRight ? zeroX : zeroX - width, 0, growsRight ? zeroX + width : zeroX, 0);
          gradient.addColorStop(0, alpha(color, data.opacity * (1 - data.gradientStrength) * confidenceOpacity));
          gradient.addColorStop(1, alpha(color, Math.min(1, data.opacity + data.gradientStrength) * confidenceOpacity));
          context.fillStyle = gradient;
          context.fillRect(x, top, width, height);
        } else {
          context.fillStyle = alpha(color, data.opacity * confidenceOpacity);
          context.fillRect(x, top, width, height);
        }
        if (data.borderWidth > 0 && data.visualMode !== "outline" && data.visualMode !== "compact-line") {
          context.strokeStyle = alpha(color, data.borderOpacity * confidenceOpacity);
          context.lineWidth = data.borderWidth;
          context.strokeRect(x + 0.5, top + 0.5, Math.max(1, width - 1), Math.max(1, height - 1));
        }
        if (data.contentMode === "net-with-call-put-detail") {
          context.fillStyle = alpha(data.callColor, Math.min(1, data.opacity + 0.18) * confidenceOpacity);
          context.fillRect(callX, y - height / 2, detailCallWidth, Math.min(2, height / 2));
          context.fillStyle = alpha(data.putColor, Math.min(1, data.opacity + 0.18) * confidenceOpacity);
          context.fillRect(putX, y + height / 2 - Math.min(2, height / 2), detailPutWidth, Math.min(2, height / 2));
        }
        if (data.showValues && width > 70) {
          context.font = "500 9px 'JetBrains Mono', monospace";
          context.textBaseline = "middle";
          context.textAlign = growsRight ? "right" : "left";
          context.fillStyle = data.textColor;
          context.fillText(this.primitive.formatValue(value, data.snapshot.representation), growsRight ? x + width - 4 : x + 4, y);
        }
        if (data.showMappedPrice && width > 105) {
          context.font = "500 8px 'JetBrains Mono', monospace";
          context.textBaseline = "middle";
          context.textAlign = growsRight ? "left" : "right";
          context.fillStyle = data.mutedTextColor;
          context.fillText(row.mappedDisplayPrice.toFixed(data.precision), growsRight ? x + 4 : x + width - 4, y);
        }
        hits.push({
          x: x + width / 2,
          y,
          row: {
            ...row,
            percentageOfVisibleAbsoluteExposure: visibleAbsoluteExposure > 0
              ? row.absoluteTotalExposure / visibleAbsoluteExposure
              : 0,
          },
          snapshot: data.snapshot,
          left: x,
          right: x + width,
          height,
        });
      });

      const levels = [
        data.showMaxPositive && data.snapshot.maxPositiveRow ? { label: "MAX +GEX", row: data.snapshot.maxPositiveRow, color: data.positiveColor } : null,
        data.showMaxNegative && data.snapshot.maxNegativeRow ? { label: "MAX -GEX", row: data.snapshot.maxNegativeRow, color: data.negativeColor } : null,
        data.showDominantAbsolute && data.snapshot.dominantAbsoluteRow ? { label: "DOMINANT", row: data.snapshot.dominantAbsoluteRow, color: data.warningColor } : null,
        data.showCallWall && data.snapshot.callWallRow ? { label: "CALL WALL", row: data.snapshot.callWallRow, color: data.callColor } : null,
        data.showPutWall && data.snapshot.putWallRow ? { label: "PUT WALL", row: data.snapshot.putWallRow, color: data.putColor } : null,
      ].filter((level): level is { label: string; row: NetGammaStrikeRow; color: string } => Boolean(level));
      const mergedLevels = new Map<number, typeof levels>();
      for (const level of levels) {
        const key = level.row.mappedDisplayTick;
        const group = mergedLevels.get(key) ?? [];
        group.push(level);
        mergedLevels.set(key, group);
      }
      [...mergedLevels.values()].forEach((group) => {
        const level = group[0];
        const rawY = series.priceToCoordinate(level.row.mappedDisplayPrice);
        if (rawY === null || rawY < 2 || rawY > mediaSize.height - 2) return;
        context.strokeStyle = alpha(group.length > 1 ? data.warningColor : level.color, 0.82);
        context.setLineDash([4, 3]);
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(laneLeft, rawY + 0.5);
        context.lineTo(laneLeft + laneWidth, rawY + 0.5);
        context.stroke();
        const labelY = Number(rawY);
        const labels = group.map((item) => item.label).join(" + ");
        const label = `${labels} ${level.row.mappedDisplayPrice.toFixed(data.precision)} · ${this.primitive.formatValue(level.row.netExposure, data.snapshot.representation)}`;
        context.font = "600 8px 'JetBrains Mono', monospace";
        context.textAlign = "right";
        context.textBaseline = "middle";
        const labelWidth = Math.min(laneWidth - 8, context.measureText(label).width + 8);
        context.fillStyle = alpha(data.backgroundColor, 0.93);
        context.fillRect(laneLeft + laneWidth - labelWidth - 3, labelY - 7, labelWidth, 14);
        context.strokeStyle = alpha(group.length > 1 ? data.warningColor : level.color, 0.8);
        context.setLineDash([]);
        context.strokeRect(laneLeft + laneWidth - labelWidth - 3.5, labelY - 7.5, labelWidth + 1, 15);
        context.fillStyle = group.length > 1 ? data.warningColor : level.color;
        context.fillText(label, laneLeft + laneWidth - 7, labelY);
      });
      if (data.showCurrentPrice) {
        const y = series.priceToCoordinate(data.snapshot.displayPrice);
        if (y !== null && y >= 0 && y <= mediaSize.height) {
          context.strokeStyle = alpha(data.currentPriceColor, 0.68);
          context.lineWidth = 1;
          context.setLineDash([2, 3]);
          context.beginPath();
          context.moveTo(laneLeft, y + 0.5);
          context.lineTo(laneLeft + laneWidth, y + 0.5);
          context.stroke();
        }
      }
      context.restore();
      this.primitive.setHits(hits);
    });
  }
}

class NetGammaExposureView implements ISeriesPrimitivePaneView {
  private readonly paneRenderer: NetGammaExposureRenderer;
  constructor(primitive: NetGammaExposurePrimitive) { this.paneRenderer = new NetGammaExposureRenderer(primitive); }
  // Keep the complete profile below the candlestick renderer so bars and
  // wicks remain the dominant foreground layer at every zoom level.
  zOrder() { return "bottom" as const; }
  renderer() { return this.paneRenderer; }
}

export class NetGammaExposurePrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null;
  private chartApi: IChartApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderData: NetGammaExposurePrimitiveData | null = null;
  private hits: RenderedHit[] = [];
  private textCache = new Map<string, string>();
  private textCacheSnapshotId = "";
  private readonly paneView = new NetGammaExposureView(this);

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) {
    this.candleSeries = param.series;
    this.chartApi = param.chart as IChartApi;
    this.requestRedraw = param.requestUpdate;
  }
  detached() { this.candleSeries = null; this.chartApi = null; this.requestRedraw = null; this.hits = []; }
  update(data: NetGammaExposurePrimitiveData | null) {
    if (data?.snapshot.id !== this.textCacheSnapshotId) {
      this.textCache.clear();
      this.textCacheSnapshotId = data?.snapshot.id ?? "";
    }
    this.renderData = data;
    this.requestRedraw?.();
  }
  formatValue(value: number, representation: NetGammaProfileSnapshot["representation"]) {
    const key = `${representation}:${value}`;
    const cached = this.textCache.get(key);
    if (cached) return cached;
    const formatted = formatGammaValue(value, representation);
    this.textCache.set(key, formatted);
    return formatted;
  }
  series() { return this.candleSeries; }
  chart() { return this.chartApi; }
  data() { return this.renderData; }
  setHits(hits: RenderedHit[]) { this.hits = hits; }
  queryHit(x: number, y: number): NetGammaExposureHit | null {
    const hit = this.hits.find((candidate) => x >= candidate.left - 5 && x <= candidate.right + 5 && Math.abs(y - candidate.y) <= Math.max(7, candidate.height / 2 + 3));
    return hit ? { x, y: hit.y, row: hit.row, snapshot: hit.snapshot } : null;
  }
  paneViews() { return [this.paneView]; }
}
