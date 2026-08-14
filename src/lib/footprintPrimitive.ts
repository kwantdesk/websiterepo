import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import {
  formatFootprintValue,
  type FootprintBar,
  type FootprintContentMode,
  type FootprintNumberFormat,
  type FootprintScaleMode,
  type FootprintVisualizationMode,
} from "./footprint";

export type FootprintRenderBar = FootprintBar & { time: Time };

export type FootprintPrimitiveOptions = {
  contentMode: FootprintContentMode;
  visualizationMode: FootprintVisualizationMode;
  scaleMode: FootprintScaleMode;
  numberFormat: FootprintNumberFormat;
  type: "ask-bid" | "volume" | "delta" | "delta-total";
  mode: "profile" | "box";
  inputType: "volume" | "num-trades";
  textFormat: "automatic" | "normal" | "thousands";
  colorMode: "none" | "fixed" | "fading";
  colorCalculation: "volume" | "delta" | "imbalance" | "dominant" | "dominant-delta";
  barWidth: number;
  candleSpacing: number;
  borderWidth: number;
  opacity: number;
  minimumOpacity: number;
  maximumOpacity: number;
  gradientExponent: number;
  visibleRegionPercentile: number;
  fixedMaximum: number;
  fontSize: number;
  fontWeight: number;
  minimumWidthToShowText: number;
  minimumRowHeightToShowText: number;
  dynamicTextSize: boolean;
  dynamicTextIncrease: number;
  showZeros: boolean;
  colorOnlyDominantSide: boolean;
  showVolumePoc: boolean;
  showDeltaPoc: boolean;
  showValueArea: boolean;
  showVah: boolean;
  showVal: boolean;
  showSinglePrints: boolean;
  singlePrintMaximum: number;
  singlePrintExtremesOnly: boolean;
  showRatio: boolean;
  minimumRatio: number;
  maximumRatio: number;
  showVolumeClusters: boolean;
  clusterMinimumVolume: number;
  showBarDelta: boolean;
  showSummary: boolean;
  showCentreDivider: boolean;
  showWick: boolean;
  showBodyOutline: boolean;
  showBodyFill: boolean;
  showBetweenVolume: boolean;
  showVwap: boolean;
  showStackedImbalances: boolean;
  showMaxBid: boolean;
  showMaxAsk: boolean;
  showMaxPositiveDelta: boolean;
  showMaxNegativeDelta: boolean;
  showMaxTrades: boolean;
  outsideBarStyle: "bar" | "body";
  markerAlignment: "center" | "right";
  outerEdgeMode: boolean;
  bidColor: string;
  askColor: string;
  betweenColor: string;
  neutralColor: string;
  textColor: string;
  pocColor: string;
  valueAreaColor: string;
  deltaPocColor: string;
  clusterColor: string;
  singlePrintColor: string;
  stackedAskColor: string;
  stackedBidColor: string;
  unfinishedAuctionColor: string;
  vwapColor: string;
  backgroundColor: string;
};

const DEFAULT_OPTIONS: FootprintPrimitiveOptions = {
  contentMode: "bid-ask",
  visualizationMode: "heatmap-histogram",
  scaleMode: "visible-region",
  numberFormat: "automatic",
  type: "ask-bid",
  mode: "profile",
  inputType: "volume",
  textFormat: "automatic",
  colorMode: "fading",
  colorCalculation: "volume",
  barWidth: 92,
  candleSpacing: 6,
  borderWidth: 1,
  opacity: 0.72,
  minimumOpacity: 0.08,
  maximumOpacity: 0.72,
  gradientExponent: 0.72,
  visibleRegionPercentile: 0.95,
  fixedMaximum: 0,
  fontSize: 11,
  fontWeight: 500,
  minimumWidthToShowText: 58,
  minimumRowHeightToShowText: 13,
  dynamicTextSize: true,
  dynamicTextIncrease: 1,
  showZeros: false,
  colorOnlyDominantSide: false,
  showVolumePoc: true,
  showDeltaPoc: false,
  showValueArea: true,
  showVah: false,
  showVal: false,
  showSinglePrints: false,
  singlePrintMaximum: 1,
  singlePrintExtremesOnly: true,
  showRatio: false,
  minimumRatio: 1.5,
  maximumRatio: 100,
  showVolumeClusters: false,
  clusterMinimumVolume: 100,
  showBarDelta: true,
  showSummary: true,
  showCentreDivider: true,
  showWick: true,
  showBodyOutline: true,
  showBodyFill: false,
  showBetweenVolume: false,
  showVwap: false,
  showStackedImbalances: true,
  showMaxBid: false,
  showMaxAsk: false,
  showMaxPositiveDelta: false,
  showMaxNegativeDelta: false,
  showMaxTrades: false,
  outsideBarStyle: "bar",
  markerAlignment: "center",
  outerEdgeMode: true,
  bidColor: "#F06A70",
  askColor: "#B7FF38",
  betweenColor: "#7C8796",
  neutralColor: "#7C8796",
  textColor: "#E9EDF2",
  pocColor: "#E4BF5A",
  valueAreaColor: "#647BA8",
  deltaPocColor: "#60A5FA",
  clusterColor: "#F59E0B",
  singlePrintColor: "#F4F4F5",
  stackedAskColor: "#B7FF38",
  stackedBidColor: "#F06A70",
  unfinishedAuctionColor: "#E4BF5A",
  vwapColor: "#22D3EE",
  backgroundColor: "#000000",
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function withAlpha(context: CanvasRenderingContext2D, colour: string, alpha: number, draw: () => void) {
  const previous = context.globalAlpha;
  context.globalAlpha = clamp(alpha, 0, 1);
  context.fillStyle = colour;
  draw();
  context.globalAlpha = previous;
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return 1;
  const ordered = [...values].sort((left, right) => left - right);
  return Math.max(1, ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * clamp(fraction, 0.5, 1)))]);
}

function displayValues(row: FootprintBar["rows"][number], options: FootprintPrimitiveOptions) {
  if (options.inputType === "num-trades") {
    return {
      bid: row.bidTrades,
      ask: row.askTrades,
      unknown: row.unknownTrades,
      total: row.bidTrades + row.askTrades + row.unknownTrades,
      delta: row.askTrades - row.bidTrades,
      trades: row.bidTrades + row.askTrades + row.unknownTrades,
    };
  }
  return {
    bid: row.bidVolume,
    ask: row.askVolume,
    unknown: row.unknownVolume,
    total: row.totalVolume,
    delta: row.delta,
    trades: row.bidTrades + row.askTrades + row.unknownTrades,
  };
}

function intensity(value: number, ceiling: number, options: FootprintPrimitiveOptions) {
  if (options.colorMode === "none") return 0;
  if (options.colorMode === "fixed") return options.opacity;
  const raw = clamp(Math.abs(value) / Math.max(1, ceiling), 0, 1);
  const curved = Math.pow(raw, clamp(options.gradientExponent, 0.1, 3));
  return options.minimumOpacity + curved * (options.maximumOpacity - options.minimumOpacity);
}

function colourMetric(
  values: ReturnType<typeof displayValues>,
  side: "bid" | "ask" | "total",
  options: FootprintPrimitiveOptions,
) {
  if (options.colorCalculation === "delta" || options.colorCalculation === "dominant-delta") {
    return Math.abs(values.delta);
  }
  if (options.colorCalculation === "imbalance") {
    const opposing = side === "bid" ? values.ask : side === "ask" ? values.bid : Math.min(values.bid, values.ask);
    const dominant = side === "bid" ? values.bid : side === "ask" ? values.ask : Math.max(values.bid, values.ask);
    return Math.max(0, dominant - opposing);
  }
  if (options.colorCalculation === "dominant") return Math.max(values.bid, values.ask);
  return side === "bid" ? values.bid : side === "ask" ? values.ask : values.total;
}

function renderMode(options: FootprintPrimitiveOptions): FootprintContentMode {
  if (options.contentMode) return options.contentMode;
  if (options.type === "ask-bid") return "bid-ask";
  if (options.type === "delta-total") return "volume-delta";
  return options.type;
}

class FootprintRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: FootprintPrimitive) {}

  draw(target: CanvasRenderingTarget2D) {
    const params = this.primitive.params();
    if (!params) return;
    const bars = this.primitive.bars();
    const options = this.primitive.options();
    if (!bars.length) return;

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const timeScale = params.chart.timeScale();
      const visible = timeScale.getVisibleRange();
      let fromIndex = 0;
      let toIndex = bars.length;
      if (visible && typeof visible.from === "number" && typeof visible.to === "number") {
        while (fromIndex < bars.length && Number(bars[fromIndex].time) < visible.from) fromIndex += 1;
        toIndex = fromIndex;
        while (toIndex < bars.length && Number(bars[toIndex].time) <= visible.to) toIndex += 1;
        fromIndex = Math.max(0, fromIndex - 1);
        toIndex = Math.min(bars.length, toIndex + 1);
      }
      const visibleBars = bars.slice(fromIndex, toIndex);
      const visibleMetrics = visibleBars.flatMap((bar) => bar.rows.flatMap((row) => {
        const values = displayValues(row, options);
        return [values.bid, values.ask, values.total, Math.abs(values.delta)];
      }));
      const visibleCeiling = options.scaleMode === "fixed-maximum" && options.fixedMaximum > 0
        ? options.fixedMaximum
        : percentile(visibleMetrics, options.visibleRegionPercentile);

      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();

      for (let index = fromIndex; index < toIndex; index += 1) {
        const bar = bars[index];
        const x = timeScale.timeToCoordinate(bar.time);
        if (x === null) continue;
        const previousX = index > 0 ? timeScale.timeToCoordinate(bars[index - 1].time) : null;
        const nextX = index + 1 < bars.length ? timeScale.timeToCoordinate(bars[index + 1].time) : null;
        const nearest = Math.min(
          previousX === null ? Number.POSITIVE_INFINITY : Math.abs(x - previousX),
          nextX === null ? Number.POSITIVE_INFINITY : Math.abs(nextX - x),
          options.barWidth + options.candleSpacing,
        );
        const barWidth = Math.max(8, Math.min(options.barWidth, nearest - options.candleSpacing));
        const left = x - barWidth / 2;
        const halfWidth = barWidth / 2;
        const barMetrics = bar.rows.flatMap((row) => {
          const values = displayValues(row, options);
          return [values.bid, values.ask, values.total, Math.abs(values.delta)];
        });
        const ceiling = options.scaleMode === "per-bar" ? percentile(barMetrics, 1) : visibleCeiling;

        const highY = params.series.priceToCoordinate(bar.high);
        const lowY = params.series.priceToCoordinate(bar.low);
        const openY = params.series.priceToCoordinate(bar.open);
        const closeY = params.series.priceToCoordinate(bar.close);
        if (options.showWick && highY !== null && lowY !== null) {
          context.save();
          context.globalAlpha = 0.48;
          context.strokeStyle = bar.close >= bar.open ? options.askColor : options.bidColor;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(Math.round(x) + 0.5, highY);
          context.lineTo(Math.round(x) + 0.5, lowY);
          context.stroke();
          context.restore();
        }
        if (options.showBodyOutline && openY !== null && closeY !== null) {
          context.save();
          context.globalAlpha = bar.isClosed ? 0.34 : 0.72;
          context.strokeStyle = bar.close >= bar.open ? options.askColor : options.bidColor;
          context.fillStyle = bar.close >= bar.open ? options.askColor : options.bidColor;
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(1, Math.abs(closeY - openY));
          if (options.showBodyFill) {
            context.globalAlpha *= 0.09;
            context.fillRect(left, bodyTop, barWidth, bodyHeight);
          }
          context.globalAlpha = bar.isClosed ? 0.34 : 0.72;
          context.strokeRect(left + 0.5, bodyTop + 0.5, Math.max(1, barWidth - 1), Math.max(1, bodyHeight - 1));
          context.restore();
        }

        const contentMode = renderMode(options);
        for (const row of bar.rows) {
          const y = params.series.priceToCoordinate(row.price);
          if (y === null) continue;
          const neighbouringTick = bar.rows[1]
            ? Math.abs(bar.rows[1].price - bar.rows[0].price)
            : Math.max(0.000001, (bar.high - bar.low) / Math.max(1, bar.rows.length));
          const nextY = params.series.priceToCoordinate(row.price + neighbouringTick);
          const rowHeight = nextY === null ? 1 : Math.max(1, Math.abs(nextY - y));
          const top = y - rowHeight / 2;
          if (top > mediaSize.height || top + rowHeight < 0) continue;
          const values = displayValues(row, options);
          const detailed = barWidth >= options.minimumWidthToShowText && rowHeight >= options.minimumRowHeightToShowText;
          const micro = barWidth < 25;

          if (options.showValueArea && row.isValueArea) {
            withAlpha(context, options.valueAreaColor, 0.1, () => context.fillRect(left, top, barWidth, rowHeight));
          }

          const drawHalf = (side: "bid" | "ask", value: number, colour: string) => {
            if (options.colorOnlyDominantSide) {
              const dominantSide = values.ask >= values.bid ? "ask" : "bid";
              if (side !== dominantSide) return;
            }
            const heatValue = colourMetric(values, side, options);
            const normalized = clamp(value / Math.max(1, ceiling), 0, 1);
            const alpha = intensity(heatValue, ceiling, options);
            const histogram = options.visualizationMode === "histogram"
              || options.visualizationMode === "heatmap-histogram"
              || contentMode === "bid-ask-histogram";
            const noFill = options.visualizationMode === "text-only";
            const width = histogram ? Math.max(value > 0 ? 1 : 0, halfWidth * normalized) : halfWidth;
            if (noFill || width <= 0) return;
            withAlpha(context, colour, options.visualizationMode === "histogram" ? Math.min(0.24, options.opacity) : alpha, () => {
              if (side === "bid") context.fillRect(x - width, top, width, rowHeight);
              else context.fillRect(x, top, width, rowHeight);
            });
          };

          if (micro) {
            const dominantAsk = values.ask >= values.bid;
            withAlpha(context, dominantAsk ? options.askColor : options.bidColor, intensity(values.total, ceiling, options), () =>
              context.fillRect(left, top, barWidth, Math.max(1, rowHeight)));
          } else if (["bid-ask", "bid-ask-histogram", "ladder"].includes(contentMode)) {
            if (contentMode !== "ladder" || options.visualizationMode !== "text-only") {
              drawHalf("bid", values.bid, options.bidColor);
              drawHalf("ask", values.ask, options.askColor);
            }
          } else {
            const signed = contentMode === "delta" || contentMode === "delta-histogram" || contentMode === "volume-delta";
            const metric = signed ? values.delta : contentMode === "trades" ? values.trades : values.total;
            const colour = signed ? metric >= 0 ? options.askColor : options.bidColor : options.askColor;
            const heatValue = colourMetric(values, "total", options);
            const normalized = clamp(Math.abs(metric) / Math.max(1, ceiling), 0, 1);
            const histogram = contentMode.endsWith("histogram")
              || options.visualizationMode.includes("histogram");
            if (options.visualizationMode !== "text-only") {
              const width = histogram ? Math.max(metric !== 0 ? 1 : 0, barWidth * normalized) : barWidth;
              withAlpha(context, colour, intensity(heatValue, ceiling, options), () => {
                if (signed) {
                  const signedWidth = width / 2;
                  context.fillRect(metric >= 0 ? x : x - signedWidth, top, signedWidth, rowHeight);
                } else context.fillRect(left, top, width, rowHeight);
              });
            }
          }

          if (options.showBetweenVolume && values.unknown > 0) {
            const width = Math.max(1, barWidth * clamp(values.unknown / Math.max(1, ceiling), 0, 1));
            withAlpha(context, options.betweenColor, 0.36, () => context.fillRect(x - width / 2, top, width, rowHeight));
          }
          context.save();
          context.globalAlpha = detailed ? 0.24 : 0.1;
          context.strokeStyle = options.neutralColor;
          context.lineWidth = Math.max(0.5, options.borderWidth * 0.5);
          context.strokeRect(left + 0.5, top + 0.5, Math.max(1, barWidth - 1), Math.max(1, rowHeight - 1));
          if (options.showCentreDivider && ["bid-ask", "bid-ask-histogram", "ladder"].includes(contentMode)) {
            context.globalAlpha = 0.34;
            context.beginPath();
            context.moveTo(Math.round(x) + 0.5, top);
            context.lineTo(Math.round(x) + 0.5, top + rowHeight);
            context.stroke();
          }
          context.restore();

          if (row.isBidImbalance) {
            withAlpha(context, options.bidColor, 0.28, () => context.fillRect(left, top, halfWidth, rowHeight));
          }
          if (row.isAskImbalance) {
            withAlpha(context, options.askColor, 0.28, () => context.fillRect(x, top, halfWidth, rowHeight));
          }
          if (options.showStackedImbalances && row.isStackedBidImbalance) {
            withAlpha(context, options.stackedBidColor, 0.95, () => context.fillRect(left - 3, top, 3, rowHeight));
          }
          if (options.showStackedImbalances && row.isStackedAskImbalance) {
            withAlpha(context, options.stackedAskColor, 0.95, () => context.fillRect(left + barWidth, top, 3, rowHeight));
          }
          if (options.showVolumePoc && row.isPoc) {
            context.save();
            context.globalAlpha = 0.95;
            context.strokeStyle = options.pocColor;
            context.lineWidth = Math.max(1, options.borderWidth * 1.5);
            context.strokeRect(left + 0.5, top + 0.5, Math.max(1, barWidth - 1), Math.max(1, rowHeight - 1));
            context.restore();
          }
          if (options.showDeltaPoc && bar.deltaPocPrice === row.price) {
            context.save();
            context.globalAlpha = 0.92;
            context.strokeStyle = options.deltaPocColor;
            context.lineWidth = Math.max(1, options.borderWidth);
            context.setLineDash([3, 2]);
            context.strokeRect(left + 1.5, top + 1.5, Math.max(1, barWidth - 3), Math.max(1, rowHeight - 3));
            context.restore();
          }
          const isSinglePrint = values.total > 0
            && values.total <= options.singlePrintMaximum
            && (!options.singlePrintExtremesOnly || row.price === bar.high || row.price === bar.low);
          if (options.showSinglePrints && isSinglePrint) {
            context.save();
            context.globalAlpha = 0.9;
            context.strokeStyle = options.singlePrintColor;
            context.lineWidth = 1;
            context.strokeRect(left + 2.5, top + 2.5, Math.max(1, barWidth - 5), Math.max(1, rowHeight - 5));
            context.restore();
          }
          if (options.showVolumeClusters && values.total >= options.clusterMinimumVolume) {
            context.save();
            context.globalAlpha = 0.78;
            context.strokeStyle = options.clusterColor;
            context.lineWidth = Math.max(1, options.borderWidth);
            context.strokeRect(left + 1.5, top + 1.5, Math.max(1, barWidth - 3), Math.max(1, rowHeight - 3));
            context.restore();
          }
          if (options.showRatio && values.bid > 0 && values.ask > 0) {
            const ratio = Math.max(values.bid, values.ask) / Math.max(1, Math.min(values.bid, values.ask));
            if (ratio >= options.minimumRatio && ratio <= options.maximumRatio) {
              context.save();
              context.globalAlpha = 0.76;
              context.fillStyle = values.ask >= values.bid ? options.askColor : options.bidColor;
              context.font = `600 ${Math.max(7, Math.min(9, rowHeight * 0.55))}px 'JetBrains Mono', ui-monospace, monospace`;
              context.textAlign = "right";
              context.textBaseline = "middle";
              context.fillText(`${ratio.toFixed(1)}×`, left + barWidth - 2, top + rowHeight / 2);
              context.restore();
            }
          }
          const maximumEnabled = (options.showMaxBid && row.isMaxBid)
            || (options.showMaxAsk && row.isMaxAsk)
            || (options.showMaxPositiveDelta && row.isMaxPositiveDelta)
            || (options.showMaxNegativeDelta && row.isMaxNegativeDelta)
            || (options.showMaxTrades && row.isMaxTrades);
          if (maximumEnabled) {
            context.save();
            context.globalAlpha = 0.72;
            context.strokeStyle = options.clusterColor;
            context.lineWidth = 1;
            context.strokeRect(left + 1.5, top + 1.5, Math.max(1, barWidth - 3), Math.max(1, rowHeight - 3));
            context.restore();
          }
          if (row.isUnfinishedAuctionHigh || row.isUnfinishedAuctionLow) {
            withAlpha(context, options.unfinishedAuctionColor, 0.95, () => {
              context.beginPath();
              context.arc(x, row.isUnfinishedAuctionHigh ? top : top + rowHeight, 3, 0, Math.PI * 2);
              context.fill();
            });
          }

          if (!detailed || micro) continue;
          const fontSize = options.dynamicTextSize
            ? clamp(Math.min(rowHeight * (0.62 + options.dynamicTextIncrease * 0.08), options.fontSize), 9, 15)
            : clamp(options.fontSize, 9, 15);
          context.save();
          context.globalAlpha = 0.97;
          context.font = `${row.isPoc ? 700 : options.fontWeight} ${fontSize}px 'JetBrains Mono', ui-monospace, monospace`;
          context.textBaseline = "middle";
          context.fillStyle = options.textColor;
          const rowY = top + rowHeight / 2;
          const format = options.numberFormat;
          if (["bid-ask", "bid-ask-histogram", "ladder"].includes(contentMode)) {
            if (options.showZeros || values.bid > 0) {
              context.textAlign = "right";
              context.fillText(formatFootprintValue(values.bid, format), x - 5, rowY);
            }
            if (options.showZeros || values.ask > 0) {
              context.textAlign = "left";
              context.fillText(formatFootprintValue(values.ask, format), x + 5, rowY);
            }
          } else {
            const metric = contentMode === "volume" || contentMode === "volume-histogram"
              ? values.total
              : contentMode === "trades"
                ? values.trades
                : values.delta;
            const text = contentMode === "volume-delta"
              ? `${formatFootprintValue(values.total, format)} │ ${values.delta >= 0 ? "+" : ""}${formatFootprintValue(values.delta, format)}`
              : `${metric > 0 && (contentMode === "delta" || contentMode === "delta-histogram") ? "+" : ""}${formatFootprintValue(metric, format)}`;
            context.textAlign = "center";
            context.fillText(text, x, rowY);
          }
          context.restore();
        }

        if (options.showVwap && bar.vwap !== null) {
          const vwapY = params.series.priceToCoordinate(bar.vwap);
          if (vwapY !== null) {
            context.save();
            context.globalAlpha = 0.72;
            context.strokeStyle = options.vwapColor;
            context.setLineDash([3, 2]);
            context.beginPath();
            context.moveTo(left, vwapY);
            context.lineTo(left + barWidth, vwapY);
            context.stroke();
            context.restore();
          }
        }
        if ((options.showVah || options.showVal) && bar.vah !== null && bar.val !== null) {
          for (const [enabled, price] of [[options.showVah, bar.vah], [options.showVal, bar.val]] as const) {
            if (!enabled) continue;
            const coordinate = params.series.priceToCoordinate(price);
            if (coordinate === null) continue;
            context.save();
            context.globalAlpha = 0.48;
            context.strokeStyle = options.valueAreaColor;
            context.setLineDash([2, 2]);
            context.beginPath();
            context.moveTo(left, coordinate);
            context.lineTo(left + barWidth, coordinate);
            context.stroke();
            context.restore();
          }
        }
        if (options.showSummary && barWidth >= 58 && lowY !== null && lowY < mediaSize.height - 14) {
          const label = options.showBarDelta
            ? `V ${formatFootprintValue(bar.totalVolume, options.numberFormat)}  Δ ${bar.delta >= 0 ? "+" : ""}${formatFootprintValue(bar.delta, options.numberFormat)}`
            : `V ${formatFootprintValue(bar.totalVolume, options.numberFormat)}`;
          context.save();
          context.font = `500 9px 'JetBrains Mono', ui-monospace, monospace`;
          context.textAlign = "center";
          context.textBaseline = "top";
          context.fillStyle = options.textColor;
          context.globalAlpha = 0.78;
          context.fillText(label, x, lowY + 3, barWidth + 18);
          context.restore();
        }
        if (options.outerEdgeMode && !bar.isClosed && highY !== null) {
          context.save();
          context.strokeStyle = options.askColor;
          context.globalAlpha = 0.82;
          context.lineWidth = 1.5;
          const outlineTop = options.outsideBarStyle === "body" && openY !== null && closeY !== null
            ? Math.min(openY, closeY)
            : highY;
          const outlineBottom = options.outsideBarStyle === "body" && openY !== null && closeY !== null
            ? Math.max(openY, closeY)
            : (lowY ?? highY);
          context.strokeRect(left - 1, outlineTop - 1, barWidth + 2, Math.max(2, outlineBottom - outlineTop + 2));
          context.fillStyle = options.askColor;
          context.fillRect(left + barWidth - 4, highY + 2, 3, 3);
          context.restore();
        }
      }
      context.restore();
    });
  }
}

class FootprintView implements ISeriesPrimitivePaneView {
  private readonly footprintRenderer: FootprintRenderer;
  constructor(primitive: FootprintPrimitive) {
    this.footprintRenderer = new FootprintRenderer(primitive);
  }
  zOrder() { return "top" as const; }
  renderer() { return this.footprintRenderer; }
}

export class FootprintPrimitive implements ISeriesPrimitive<Time> {
  private attachedParams: SeriesAttachedParameter<Time> | null = null;
  private renderBars: FootprintRenderBar[] = [];
  private renderOptions: FootprintPrimitiveOptions = DEFAULT_OPTIONS;
  private readonly paneView = new FootprintView(this);

  attached(param: SeriesAttachedParameter<Time>) {
    this.attachedParams = param;
    param.requestUpdate();
  }
  detached() { this.attachedParams = null; }
  paneViews() { return [this.paneView]; }
  params() { return this.attachedParams; }
  bars() { return this.renderBars; }
  options() { return this.renderOptions; }
  update(bars: FootprintRenderBar[], options: FootprintPrimitiveOptions) {
    this.renderBars = bars;
    this.renderOptions = { ...DEFAULT_OPTIONS, ...options };
    this.attachedParams?.requestUpdate();
  }
}
