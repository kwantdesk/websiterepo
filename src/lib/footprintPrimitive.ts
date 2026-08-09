import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import { formatFootprintValue, type FootprintBar } from "./footprint";

export type FootprintRenderBar = FootprintBar & { time: Time };

export type FootprintPrimitiveOptions = {
  type: "ask-bid" | "volume" | "delta" | "delta-total";
  mode: "profile" | "box";
  inputType: "volume" | "num-trades";
  textFormat: "automatic" | "normal" | "thousands";
  colorMode: "none" | "fixed" | "fading";
  colorCalculation: "volume" | "delta" | "imbalance" | "dominant" | "dominant-delta";
  barWidth: number;
  borderWidth: number;
  opacity: number;
  fontSize: number;
  dynamicTextSize: boolean;
  dynamicTextIncrease: number;
  showZeros: boolean;
  colorOnlyDominantSide: boolean;
  showVolumePoc: boolean;
  showDeltaPoc: boolean;
  showValueArea: boolean;
  showSinglePrints: boolean;
  singlePrintMaximum: number;
  singlePrintExtremesOnly: boolean;
  showRatio: boolean;
  minimumRatio: number;
  maximumRatio: number;
  showVolumeClusters: boolean;
  clusterMinimumVolume: number;
  showBarDelta: boolean;
  outsideBarStyle: "bar" | "body";
  markerAlignment: "center" | "right";
  outerEdgeMode: boolean;
  bidColor: string;
  askColor: string;
  neutralColor: string;
  textColor: string;
  pocColor: string;
  deltaPocColor: string;
  clusterColor: string;
  singlePrintColor: string;
  backgroundColor: string;
};

const DEFAULT_OPTIONS: FootprintPrimitiveOptions = {
  type: "ask-bid",
  mode: "profile",
  inputType: "volume",
  textFormat: "automatic",
  colorMode: "fading",
  colorCalculation: "imbalance",
  barWidth: 88,
  borderWidth: 1,
  opacity: 0.74,
  fontSize: 10,
  dynamicTextSize: true,
  dynamicTextIncrease: 1,
  showZeros: false,
  colorOnlyDominantSide: false,
  showVolumePoc: true,
  showDeltaPoc: false,
  showValueArea: true,
  showSinglePrints: false,
  singlePrintMaximum: 1,
  singlePrintExtremesOnly: true,
  showRatio: false,
  minimumRatio: 1.5,
  maximumRatio: 100,
  showVolumeClusters: false,
  clusterMinimumVolume: 100,
  showBarDelta: true,
  outsideBarStyle: "bar",
  markerAlignment: "center",
  outerEdgeMode: true,
  bidColor: "#EF4444",
  askColor: "#22C55E",
  neutralColor: "#3F3F46",
  textColor: "#F5F5F5",
  pocColor: "#FDE047",
  deltaPocColor: "#60A5FA",
  clusterColor: "#F59E0B",
  singlePrintColor: "#F4F4F5",
  backgroundColor: "#000000",
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function sideValues(row: FootprintBar["rows"][number], inputType: FootprintPrimitiveOptions["inputType"]) {
  return inputType === "num-trades"
    ? { bid: row.bidTrades, ask: row.askTrades }
    : { bid: row.bidVolume, ask: row.askVolume };
}

function rowTotal(row: FootprintBar["rows"][number], inputType: FootprintPrimitiveOptions["inputType"]) {
  const values = sideValues(row, inputType);
  return values.bid + values.ask;
}

function rowDelta(row: FootprintBar["rows"][number], inputType: FootprintPrimitiveOptions["inputType"]) {
  const values = sideValues(row, inputType);
  return values.ask - values.bid;
}

function rowAlpha(
  row: FootprintBar["rows"][number],
  side: "bid" | "ask",
  options: FootprintPrimitiveOptions,
  maximumSide: number,
  maximumDelta: number,
) {
  if (options.colorMode === "none") return 0;
  if (options.colorMode === "fixed") return options.opacity;
  const values = sideValues(row, options.inputType);
  const sideValue = side === "ask" ? values.ask : values.bid;
  const dominant = side === "ask" ? values.ask >= values.bid : values.bid >= values.ask;
  const inputDelta = rowDelta(row, options.inputType);
  const inputTotal = Math.max(1, rowTotal(row, options.inputType));
  let intensity = sideValue / Math.max(1, maximumSide);
  if (options.colorCalculation === "delta") intensity = Math.abs(inputDelta) / Math.max(1, maximumDelta);
  if (options.colorCalculation === "imbalance") intensity = side === "ask"
    ? row.askImbalance ? 1 : 0.08
    : row.bidImbalance ? 1 : 0.08;
  if (options.colorCalculation === "dominant") intensity = dominant ? sideValue / inputTotal : 0.05;
  if (options.colorCalculation === "dominant-delta") {
    intensity = dominant ? Math.abs(inputDelta) / Math.max(1, maximumDelta) : 0.05;
  }
  if (options.colorOnlyDominantSide && !dominant) intensity = 0.02;
  return clamp((0.08 + intensity * 0.92) * options.opacity, 0.02, 1);
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
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();

      let fromIndex = 0;
      let toIndex = bars.length;
      if (visible && typeof visible.from === "number" && typeof visible.to === "number") {
        while (fromIndex < bars.length && Number(bars[fromIndex].time) < visible.from) fromIndex += 1;
        toIndex = fromIndex;
        while (toIndex < bars.length && Number(bars[toIndex].time) <= visible.to) toIndex += 1;
        fromIndex = Math.max(0, fromIndex - 1);
        toIndex = Math.min(bars.length, toIndex + 1);
      }

      for (let index = fromIndex; index < toIndex; index += 1) {
        const bar = bars[index];
        const x = timeScale.timeToCoordinate(bar.time);
        if (x === null) continue;
        const previousX = index > 0 ? timeScale.timeToCoordinate(bars[index - 1].time) : null;
        const nextX = index + 1 < bars.length ? timeScale.timeToCoordinate(bars[index + 1].time) : null;
        const spacing = Math.max(18, Math.min(
          previousX === null ? Number.POSITIVE_INFINITY : Math.abs(x - previousX),
          nextX === null ? Number.POSITIVE_INFINITY : Math.abs(nextX - x),
          options.barWidth,
        ));
        const barWidth = Math.max(16, Math.min(options.barWidth, spacing * 0.9));
        const left = x - barWidth / 2;
        const halfWidth = barWidth / 2;
        const maximumSide = Math.max(1, ...bar.rows.flatMap((row) => {
          const values = sideValues(row, options.inputType);
          return [values.bid, values.ask];
        }));
        const maximumDisplayedTotal = Math.max(1, ...bar.rows.map((row) => rowTotal(row, options.inputType)));
        const maximumDelta = Math.max(1, ...bar.rows.map((row) => Math.abs(rowDelta(row, options.inputType))));

        const outlineHigh = options.outsideBarStyle === "body" ? Math.max(bar.open, bar.close) : bar.high;
        const outlineLow = options.outsideBarStyle === "body" ? Math.min(bar.open, bar.close) : bar.low;
        const outlineTop = params.series.priceToCoordinate(outlineHigh);
        const outlineBottom = params.series.priceToCoordinate(outlineLow);
        if (options.outerEdgeMode && outlineTop !== null && outlineBottom !== null) {
          context.save();
          context.globalAlpha = 0.52;
          context.strokeStyle = bar.close >= bar.open ? options.askColor : options.bidColor;
          context.lineWidth = options.borderWidth;
          context.strokeRect(
            left,
            Math.min(outlineTop, outlineBottom),
            barWidth,
            Math.max(1, Math.abs(outlineBottom - outlineTop)),
          );
          context.restore();
        }

        for (let rowIndex = 0; rowIndex < bar.rows.length; rowIndex += 1) {
          const row = bar.rows[rowIndex];
          const below = bar.rows[rowIndex - 1]?.price;
          const above = bar.rows[rowIndex + 1]?.price;
          const inferredStep = Math.min(
            above === undefined ? Number.POSITIVE_INFINITY : above - row.price,
            below === undefined ? Number.POSITIVE_INFINITY : row.price - below,
          );
          const rowStep = Number.isFinite(inferredStep) && inferredStep > 0
            ? inferredStep
            : Math.max(0.000001, (bar.high - bar.low) / Math.max(1, bar.rows.length));
          const topCoordinate = params.series.priceToCoordinate(row.price + rowStep / 2);
          const bottomCoordinate = params.series.priceToCoordinate(row.price - rowStep / 2);
          if (topCoordinate === null || bottomCoordinate === null) continue;
          const top = Math.min(topCoordinate, bottomCoordinate);
          const cellHeight = Math.max(1, Math.abs(bottomCoordinate - topCoordinate));
          if (top > mediaSize.height || top + cellHeight < 0) continue;
          const values = sideValues(row, options.inputType);
          const bidWidth = options.mode === "profile"
            ? halfWidth * values.bid / maximumSide
            : halfWidth;
          const askWidth = options.mode === "profile"
            ? halfWidth * values.ask / maximumSide
            : halfWidth;
          const inValueArea = !options.showValueArea
            || bar.val === null
            || bar.vah === null
            || (row.price >= bar.val && row.price <= bar.vah);
          const valueAreaAlpha = inValueArea ? 1 : 0.38;
          const bidAlpha = rowAlpha(row, "bid", options, maximumSide, maximumDelta) * valueAreaAlpha;
          const askAlpha = rowAlpha(row, "ask", options, maximumSide, maximumDelta) * valueAreaAlpha;

          if (bidWidth > 0) {
            context.globalAlpha = bidAlpha;
            context.fillStyle = options.bidColor;
            context.fillRect(x - bidWidth, top, bidWidth, cellHeight);
          }
          if (askWidth > 0) {
            context.globalAlpha = askAlpha;
            context.fillStyle = options.askColor;
            context.fillRect(x, top, askWidth, cellHeight);
          }
          context.globalAlpha = 0.38;
          context.strokeStyle = options.neutralColor;
          context.lineWidth = Math.max(0.5, options.borderWidth * 0.55);
          context.strokeRect(left, top, barWidth, cellHeight);

          if (options.showVolumePoc && bar.pocPrice === row.price) {
            context.globalAlpha = 0.95;
            context.strokeStyle = options.pocColor;
            context.lineWidth = Math.max(1, options.borderWidth * 1.6);
            context.strokeRect(left, top, barWidth, cellHeight);
          }
          if (options.showDeltaPoc && bar.deltaPocPrice === row.price) {
            context.globalAlpha = 0.95;
            context.strokeStyle = options.deltaPocColor;
            context.lineWidth = Math.max(1, options.borderWidth * 1.35);
            context.strokeRect(left + 1, top + 1, Math.max(1, barWidth - 2), Math.max(1, cellHeight - 2));
          }
          if (options.showSinglePrints && row.volume <= options.singlePrintMaximum) {
            const atExtreme = row.price === bar.rows[0]?.price || row.price === bar.rows.at(-1)?.price;
            if (!options.singlePrintExtremesOnly || atExtreme) {
              context.globalAlpha = 0.95;
              context.strokeStyle = options.singlePrintColor;
              context.lineWidth = Math.max(1, options.borderWidth * 1.5);
              context.strokeRect(left, top, barWidth, cellHeight);
            }
          }
          if (options.showVolumeClusters && row.volume >= options.clusterMinimumVolume) {
            context.globalAlpha = 0.75;
            context.strokeStyle = options.clusterColor;
            context.lineWidth = Math.max(1, options.borderWidth * 1.35);
            context.strokeRect(left + 0.5, top + 0.5, Math.max(1, barWidth - 1), Math.max(1, cellHeight - 1));
          }

          const canShowText = cellHeight >= Math.max(7, options.fontSize * 0.72) && barWidth >= 26;
          if (!canShowText) continue;
          const displayedTotal = rowTotal(row, options.inputType);
          const displayedDelta = rowDelta(row, options.inputType);
          const dynamic = options.dynamicTextSize
            ? 1 + displayedTotal / maximumDisplayedTotal * clamp(options.dynamicTextIncrease, 0, 2) * 0.22
            : 1;
          const fontSize = clamp(Math.min(cellHeight * 0.72, options.fontSize * dynamic), 6, 14);
          context.globalAlpha = 0.96;
          context.font = `700 ${fontSize}px 'JetBrains Mono', monospace`;
          context.textBaseline = "middle";
          context.fillStyle = options.textColor;
          context.strokeStyle = options.backgroundColor;
          context.lineWidth = 2.4;
          const rowY = top + cellHeight / 2;
          if (options.type === "ask-bid") {
            const bidText = formatFootprintValue(values.bid, options.textFormat);
            const askText = formatFootprintValue(values.ask, options.textFormat);
            if (options.showZeros || values.bid > 0) {
              context.textAlign = "right";
              context.strokeText(bidText, x - 3, rowY);
              context.fillText(bidText, x - 3, rowY);
            }
            if (options.showZeros || values.ask > 0) {
              context.textAlign = "left";
              context.strokeText(askText, x + 3, rowY);
              context.fillText(askText, x + 3, rowY);
            }
          } else {
            const displayed = options.type === "volume" ? displayedTotal : displayedDelta;
            const text = options.type === "delta-total"
              ? `${formatFootprintValue(displayedDelta, options.textFormat)} · ${formatFootprintValue(displayedTotal, options.textFormat)}`
              : formatFootprintValue(displayed, options.textFormat);
            if (options.showZeros || displayed !== 0) {
              context.textAlign = "center";
              context.strokeText(text, x, rowY);
              context.fillText(text, x, rowY);
            }
          }
        }

        const highY = params.series.priceToCoordinate(bar.high);
        const lowY = params.series.priceToCoordinate(bar.low);
        const openY = params.series.priceToCoordinate(bar.open);
        const closeY = params.series.priceToCoordinate(bar.close);
        if (highY !== null && lowY !== null && openY !== null && closeY !== null) {
          const markerX = options.markerAlignment === "right" ? left + barWidth : x;
          context.save();
          context.globalAlpha = 0.9;
          context.strokeStyle = bar.close >= bar.open ? options.askColor : options.bidColor;
          context.lineWidth = Math.max(1, options.borderWidth);
          context.beginPath();
          context.moveTo(markerX - 5, openY);
          context.lineTo(markerX, openY);
          context.moveTo(markerX, closeY);
          context.lineTo(markerX + 5, closeY);
          context.stroke();
          context.restore();
        }

        if (options.showBarDelta && bar.rows.length) {
          const lowY = params.series.priceToCoordinate(bar.low);
          if (lowY !== null && lowY < mediaSize.height - 3) {
            const displayedBarDelta = bar.rows.reduce((sum, row) => sum + rowDelta(row, options.inputType), 0);
            const label = `Δ ${displayedBarDelta >= 0 ? "+" : ""}${formatFootprintValue(displayedBarDelta, options.textFormat)}`;
            const fontSize = clamp(options.fontSize - 1, 7, 11);
            context.font = `800 ${fontSize}px 'JetBrains Mono', monospace`;
            const labelWidth = Math.min(barWidth, context.measureText(label).width + 8);
            context.globalAlpha = 0.92;
            context.fillStyle = displayedBarDelta >= 0 ? options.askColor : options.bidColor;
            context.fillRect(x - labelWidth / 2, lowY + 3, labelWidth, fontSize + 6);
            context.fillStyle = options.backgroundColor;
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(label, x, lowY + 3 + (fontSize + 6) / 2);
          }
        }

        if (options.showRatio && bar.bidVolume > 0 && bar.askVolume > 0) {
          const ratio = bar.askVolume / bar.bidVolume;
          if (ratio >= options.minimumRatio && ratio <= options.maximumRatio) {
            const highY = params.series.priceToCoordinate(bar.high);
            if (highY !== null) {
              context.globalAlpha = 0.9;
              context.fillStyle = ratio >= 1 ? options.askColor : options.bidColor;
              context.font = `700 ${clamp(options.fontSize - 1, 7, 11)}px 'JetBrains Mono', monospace`;
              context.textAlign = "center";
              context.textBaseline = "bottom";
              context.fillText(`${ratio.toFixed(2)}x`, x, highY - 3);
            }
          }
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
    this.renderOptions = options;
    this.attachedParams?.requestUpdate();
  }
}
