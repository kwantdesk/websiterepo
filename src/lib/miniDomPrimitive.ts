import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";

/**
 * The Mini DOM: a depth ladder drawn against the chart's own price scale.
 *
 * The full Depth of Market already exists as a panel. This is the same book in
 * the place a trader is actually looking — pinned to the right of the chart,
 * with every row sitting at the price it belongs to, so resting size lines up
 * with the candles instead of living in a separate column that has to be read
 * across.
 *
 * It is a series primitive rather than an overlay for the reason every other
 * price-anchored thing on this chart is: it has to reach the screen in the
 * same frame as the candles, or it slides against them while the chart moves.
 */

export type MiniDomLevel = {
  side: "BID" | "ASK";
  price: number;
  size: number;
};

export type MiniDomOptions = {
  /** Total ladder width in pixels: the size column plus the bars. */
  widthPx: number;
  /**
   * Gap from the price scale. The default is two pixels, which is where a
   * right-docked volume profile anchors, so the two line up rather than
   * sitting a hair apart.
   */
  rightGapPx: number;
  buyColor: string;
  sellColor: string;
  textColor: string;
  headerColor: string;
  backgroundColor: string;
  showHeader: boolean;
  showSizes: boolean;
  /** Rows either side of the spread. */
  depth: number;
  opacity: number;
  fontSize: number;
};

export const DEFAULT_MINI_DOM_OPTIONS: MiniDomOptions = {
  widthPx: 190,
  rightGapPx: 2,
  buyColor: "#14B8B0",
  sellColor: "#B4174B",
  textColor: "#E5E7EB",
  headerColor: "#9AA3AF",
  backgroundColor: "rgba(8,10,14,0.55)",
  showHeader: true,
  showSizes: true,
  depth: 20,
  opacity: 0.92,
  fontSize: 10,
};

/**
 * The ladder's geometry for one frame.
 *
 * Pulled out of the renderer so the layout can be checked without a canvas:
 * every bar shares its right edge and grows left, so no bar may run under the
 * size column, and the ladder may never be wider than the pane it sits in.
 */
export function miniDomLayout(input: {
  paneWidth: number;
  widthPx: number;
  rightGapPx: number;
}) {
  const width = Math.max(60, Math.min(input.widthPx, Math.max(60, input.paneWidth - 40)));
  // Anchored where a right-docked volume profile anchors: the pane's own right
  // edge, which is the chart side of the price scale. The scale is a separate
  // canvas, so the pane width IS the boundary — the ladder can never run under
  // it however wide it is set.
  const right = Math.max(width, input.paneWidth - Math.max(0, input.rightGapPx));
  const left = right - width;
  const numberColumn = Math.min(52, Math.max(26, width * 0.24));
  return {
    left,
    right,
    width,
    /** Every bar starts here and grows LEFT, so one edge is common to all. */
    barRight: right,
    /** Sizes sit in one aligned column at the far left, clear of the bars. */
    numberX: left + numberColumn - 6,
    /** How far a full-size bar may reach before it reaches the numbers. */
    barExtent: Math.max(4, width - numberColumn),
  };
}

export function miniDomBarWidth(size: number, peak: number, extent: number) {
  if (!(size > 0) || !(peak > 0) || !(extent > 0)) return 0;
  // Clamped: a level larger than the peak the frame was scaled from — which a
  // late update can produce — must not run under the size column.
  return Math.max(1, Math.min(extent, (size / peak) * extent));
}

export class MiniDomPrimitive implements ISeriesPrimitive<Time> {
  private attachedParams: SeriesAttachedParameter<Time> | null = null;
  private levels: MiniDomLevel[] = [];
  private tickSize = 0.25;
  private options: MiniDomOptions = DEFAULT_MINI_DOM_OPTIONS;
  private readonly paneView: ISeriesPrimitivePaneView;

  constructor() {
    const renderer: ISeriesPrimitivePaneRenderer = {
      draw: (target: CanvasRenderingTarget2D) => this.draw(target),
    };
    this.paneView = {
      // Above the candles: the ladder is read against price, and a candle
      // drawn over a row hides the size that row is reporting.
      zOrder: () => "top" as const,
      renderer: () => renderer,
    };
  }

  setBook(levels: MiniDomLevel[], tickSize: number, options: MiniDomOptions) {
    this.levels = levels;
    this.tickSize = tickSize > 0 ? tickSize : this.tickSize;
    this.options = options;
    this.attachedParams?.requestUpdate();
  }

  /**
   * Restyle without touching the book.
   *
   * A width or colour change has to show at once. Pushing an empty book to
   * carry new options would blank the ladder until the next frame arrives,
   * which on a quiet tape can be seconds.
   */
  setOptions(options: MiniDomOptions) {
    this.options = options;
    this.attachedParams?.requestUpdate();
  }

  /** Drop the book, for when the study is switched off or the symbol changes. */
  clear() {
    this.levels = [];
    this.attachedParams?.requestUpdate();
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this.attachedParams = param;
  }

  detached() {
    this.attachedParams = null;
    this.levels = [];
  }

  paneViews() {
    return [this.paneView];
  }

  private draw(target: CanvasRenderingTarget2D) {
    const params = this.attachedParams;
    if (!params || !this.levels.length) return;
    const options = this.options;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const layout = miniDomLayout({
        paneWidth: mediaSize.width,
        widthPx: options.widthPx,
        rightGapPx: options.rightGapPx,
      });

      const asks = this.levels.filter((level) => level.side === "ASK").sort((a, b) => a.price - b.price).slice(0, options.depth);
      const bids = this.levels.filter((level) => level.side === "BID").sort((a, b) => b.price - a.price).slice(0, options.depth);
      const shown = [...asks, ...bids];
      if (!shown.length) return;
      const peak = Math.max(1, ...shown.map((level) => level.size));

      // One row is one tick, measured on the live scale so the ladder breathes
      // with the chart instead of assuming a zoom.
      const anchor = shown[0].price;
      const anchorY = params.series.priceToCoordinate(anchor);
      const nextY = params.series.priceToCoordinate(anchor + this.tickSize);
      if (anchorY === null || nextY === null) return;
      const rowHeight = Math.max(1, Math.abs(nextY - anchorY));

      context.save();
      context.globalAlpha = options.opacity;

      if (options.backgroundColor) {
        context.fillStyle = options.backgroundColor;
        context.fillRect(layout.left, 0, layout.width, mediaSize.height);
      }

      context.font = `600 ${options.fontSize}px 'JetBrains Mono', ui-monospace, monospace`;
      context.textBaseline = "middle";

      if (options.showHeader) {
        // One column now, so one label. Sides are told apart by colour.
        context.fillStyle = options.headerColor;
        context.textAlign = "center";
        context.fillText("DOM", layout.left + layout.width / 2, 10);
      }

      for (const level of shown) {
        const y = params.series.priceToCoordinate(level.price);
        if (y === null) continue;
        const top = y - rowHeight / 2;
        if (top + rowHeight < 0 || top > mediaSize.height) continue;
        const sell = level.side === "ASK";
        const barWidth = miniDomBarWidth(level.size, peak, layout.barExtent);
        const barHeight = Math.max(1, rowHeight - 1);
        context.fillStyle = sell ? options.sellColor : options.buyColor;
        // Every bar shares its right edge against the price scale and grows
        // left, so lengths are read off one baseline rather than two. Which
        // side a row is on is carried by colour.
        context.fillRect(layout.barRight - barWidth, top, barWidth, barHeight);

        if (options.showSizes && rowHeight >= options.fontSize - 1) {
          context.fillStyle = sell ? options.sellColor : options.buyColor;
          context.textAlign = "right";
          context.fillText(String(Math.round(level.size)), layout.numberX, y);
        }
      }

      context.restore();
    });
  }
}
