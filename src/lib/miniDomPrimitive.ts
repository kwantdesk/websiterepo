import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";

/**
 * The Mini DOM: the liquidity map's resting-book rail, drawn against the
 * chart's own price scale.
 *
 * This is the same ladder the liq map paints down its price axis — resting bid
 * and ask size banded into price levels, one thick bar per band with its
 * contract count sitting on it — brought onto the chart so resting size lines
 * up with the candles instead of living in another window.
 *
 * The geometry is deliberately the liq map's, not a new one:
 *
 *   - Size is BANDED, not drawn per tick. A tick is a couple of pixels at
 *     normal zoom, so per-tick bars are hairlines nobody can read and no
 *     number fits between them. The liq map picks a band step that leaves
 *     roughly 25px between levels and sums every resting order inside a band,
 *     which is what makes the bars thick.
 *   - Bid and ask are two rails growing away from each other, each able to be
 *     switched off on its own.
 *   - Bar length is the band's size against the largest band on screen.
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
  /** Total ladder width in pixels, shared by whichever rails are shown. */
  widthPx: number;
  /**
   * Gap from the price scale. The default is two pixels, which is where a
   * right-docked volume profile anchors, so the two line up rather than
   * sitting a hair apart.
   */
  rightGapPx: number;
  buyColor: string;
  sellColor: string;
  backgroundColor: string;
  showBids: boolean;
  showAsks: boolean;
  /**
   * Both rails grow left off one shared baseline, which is how lengths get
   * compared at a glance. Off puts them back to the liq map's mirrored pair,
   * growing away from each other.
   */
  alignLeft: boolean;
  showSizes: boolean;
  /** Rough pixels between banded price levels. Ten is the stock setting. */
  levelSpacingPx: number;
  barOpacity: number;
  fontSize: number;
};

export const DEFAULT_MINI_DOM_OPTIONS: MiniDomOptions = {
  widthPx: 95,
  rightGapPx: 2,
  buyColor: "#14B8B0",
  sellColor: "#B4174B",
  // No panel. The chart reserves the ladder's width on the time scale, so
  // nothing draws underneath it any more and there is nothing to cover up —
  // a filled panel is just a slab of colour over the chart. Empty means the
  // fill is skipped entirely; an opacity can be dialled back in per chart.
  backgroundColor: "",
  showBids: true,
  showAsks: true,
  alignLeft: true,
  showSizes: true,
  levelSpacingPx: 10,
  barOpacity: 0.56,
  fontSize: 8,
};

/**
 * The ladder's geometry for one frame.
 *
 * Pulled out of the renderer so the layout can be checked without a canvas.
 * The rails split whatever width is left after the gap, so switching one side
 * off gives the other the whole ladder rather than leaving a hole.
 */
export function miniDomLayout(input: {
  paneWidth: number;
  widthPx: number;
  rightGapPx: number;
  showBids: boolean;
  showAsks: boolean;
  /** Both rails off one baseline instead of the liq map's mirrored pair. */
  alignLeft?: boolean;
}) {
  const sideCount = Number(input.showBids) + Number(input.showAsks);
  const width = Math.max(40, Math.min(input.widthPx, Math.max(40, input.paneWidth - 40)));
  // Anchored where a right-docked volume profile anchors: the pane's own right
  // edge, which is the chart side of the price scale. The scale is a separate
  // canvas, so the pane width IS the boundary — the ladder can never run under
  // it however wide it is set.
  const right = Math.max(width, input.paneWidth - Math.max(0, input.rightGapPx));
  const left = right - width;
  const sideWidth = sideCount > 0 ? width / sideCount : 0;
  // Asks sit on the outside and bids on the inside, the way the liq map stacks
  // them down its own axis.
  const sellLeft = left;
  const sellRight = left + (input.showAsks ? sideWidth : 0);
  const buyLeft = sellRight;
  const buyRight = buyLeft + (input.showBids ? sideWidth : 0);
  // Aligned, the two rails collapse onto ONE baseline and every bar runs from
  // it in the same direction, so a bid and an ask of equal size draw equal.
  // Mirrored, each rail keeps its own edge and they grow apart.
  //
  // The baseline is the ladder's own right edge, hard against the price
  // scale. Anchoring it at the middle instead left the whole right half of
  // the ladder empty — a band of black between the bars and the scale, with
  // the bars floating away from the prices they belong to. The counts live in
  // a column of their own to the LEFT of every bar, out of the way of a bar
  // that runs long.
  const numberColumn = Math.min(52, Math.max(26, width * 0.24));
  const baselineX = input.alignLeft ? right : null;
  const alignedExtent = baselineX === null
    ? 0
    : Math.max(1, baselineX - left - numberColumn);
  return {
    left,
    right,
    width,
    sideWidth,
    sellLeft,
    sellRight,
    buyLeft,
    buyRight,
    /** Where every bar starts when the rails are aligned. */
    baselineX,
    /** One aligned column for the counts, clear of the bars. */
    numberX: left + numberColumn - 6,
    /** Bars stop short of the rail edge so neighbouring rails stay apart. */
    barExtent: baselineX === null ? Math.max(1, sideWidth - 5) : alignedExtent,
    /**
     * What the rest of the chart may use. The ladder is opaque and fixed to
     * the price scale, so everything else — a docked volume profile above all
     * — has to treat this as the pane's right edge rather than sliding
     * underneath it.
     */
    reservedWidth: Math.max(0, input.paneWidth - (right - width)),
    /** Below this the contract counts do not fit and are dropped. */
    sizesFit: input.alignLeft ? width >= 68 : sideWidth >= 42,
  };
}

/**
 * How many ticks one drawn band covers.
 *
 * A tick is a couple of pixels at normal zoom. Drawing one bar per tick gives
 * hairlines with no room for a number between them, so the step is chosen to
 * leave roughly `spacingPx` between bands and every resting order inside a
 * band is summed into one thick bar.
 */
export function miniDomBandStep(visibleTickSpan: number, plotHeight: number, spacingPx: number) {
  if (!(visibleTickSpan > 0) || !(plotHeight > 0)) return 1;
  const targetLevels = Math.max(12, plotHeight / Math.max(4, spacingPx));
  return Math.max(1, Math.round(visibleTickSpan / targetLevels));
}

/**
 * Bar thickness. Floored at 8px so a zoomed-out ladder still reads as bars
 * with numbers on them, and capped at 16 so a zoomed-in one does not become
 * blocks that swallow the price levels between them.
 */
export function miniDomBarHeight(levelSpacing: number) {
  return Math.max(8, Math.min(16, levelSpacing * 0.62));
}

export function miniDomBarWidth(size: number, peak: number, extent: number) {
  if (!(size > 0) || !(peak > 0) || !(extent > 0)) return 0;
  // Clamped: a level larger than the peak the frame was scaled from — which a
  // late update can produce — must not run past its own rail.
  return Math.max(1, Math.min(extent, (size / peak) * extent));
}

/**
 * Sum resting size into price bands, the liq map's `aggregateRestingBook`.
 *
 * The peak returned is the largest single band on screen, which is what bar
 * lengths are scaled against — so the ladder rescales as the view moves rather
 * than being flattened by one far-away wall.
 */
export function aggregateMiniDomBook(
  levels: readonly MiniDomLevel[],
  tickSize: number,
  bandTicks: number,
  bottomTick: number,
  topTick: number,
) {
  const step = Math.max(1, Math.round(bandTicks) || 1);
  const bands = new Map<number, { buy: number; sell: number }>();
  let peak = 0;
  if (!(tickSize > 0)) return { bands, peak, step };
  for (const level of levels) {
    const size = Math.max(0, Number(level.size) || 0);
    if (!(size > 0)) continue;
    const tick = level.price / tickSize;
    if (!Number.isFinite(tick) || tick < bottomTick || tick > topTick) continue;
    const bucket = Math.round(tick / step) * step;
    if (bucket < bottomTick || bucket > topTick) continue;
    const band = bands.get(bucket) ?? { buy: 0, sell: 0 };
    if (level.side === "ASK") band.sell += size;
    else band.buy += size;
    bands.set(bucket, band);
    peak = Math.max(peak, band.buy, band.sell);
  }
  return { bands, peak, step };
}

const withAlpha = (color: string, alpha: number) => {
  const hex = color.trim();
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const int = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},${alpha})`;
};

export class MiniDomPrimitive implements ISeriesPrimitive<Time> {
  private attachedParams: SeriesAttachedParameter<Time> | null = null;
  private levels: MiniDomLevel[] = [];
  /** When a frame last carried an actual book. */
  private booked = 0;
  private tickSize = 0.25;
  private options: MiniDomOptions = DEFAULT_MINI_DOM_OPTIONS;
  private readonly paneView: ISeriesPrimitivePaneView;

  constructor() {
    const renderer: ISeriesPrimitivePaneRenderer = {
      draw: (target: CanvasRenderingTarget2D) => this.draw(target),
    };
    this.paneView = {
      // Above the candles: the ladder is read against price, and a candle
      // drawn over a band hides the size that band is reporting.
      zOrder: () => "top" as const,
      renderer: () => renderer,
    };
  }

  /**
   * Take a depth frame.
   *
   * An empty frame is not an empty book. Frames occasionally arrive carrying
   * nothing — a resync, a heartbeat, one that crossed a reconnect — and taking
   * those at face value emptied the ladder until the next real frame refilled
   * it. The last book actually received stands instead.
   *
   * Nothing here expires it on a timer. A quiet tape is not a dead feed, and
   * a clock-based cutoff made the ladder hide itself and reappear on its own
   * every time the book went still. The feed's own status decides when there
   * is nothing to show: see the stream's onStatus, which clears it.
   */
  setBook(levels: MiniDomLevel[], tickSize: number, options: MiniDomOptions) {
    this.tickSize = tickSize > 0 ? tickSize : this.tickSize;
    this.options = options;
    if (levels.length) {
      this.levels = levels;
      this.booked = Date.now();
    }
    this.attachedParams?.requestUpdate();
  }

  /** The last book received, so a rebuilt chart can be given it back at once. */
  book(): { levels: MiniDomLevel[]; tickSize: number } | null {
    return this.levels.length ? { levels: this.levels, tickSize: this.tickSize } : null;
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
    this.booked = 0;
    this.attachedParams?.requestUpdate();
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this.attachedParams = param;
  }

  detached() {
    this.attachedParams = null;
    this.levels = [];
    this.booked = 0;
  }

  paneViews() {
    return [this.paneView];
  }

  private draw(target: CanvasRenderingTarget2D) {
    const params = this.attachedParams;
    if (!params || !this.levels.length) return;
    const options = this.options;
    if (!options.showBids && !options.showAsks) return;

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const layout = miniDomLayout({
        paneWidth: mediaSize.width,
        widthPx: options.widthPx,
        rightGapPx: options.rightGapPx,
        showBids: options.showBids,
        showAsks: options.showAsks,
        alignLeft: options.alignLeft,
      });

      // Band against what is actually on screen, so the ladder rescales as the
      // view moves rather than being flattened by one far-away wall.
      const topPrice = params.series.coordinateToPrice(0);
      const bottomPrice = params.series.coordinateToPrice(mediaSize.height);
      if (topPrice === null || bottomPrice === null) return;
      const tick = this.tickSize > 0 ? this.tickSize : 0.25;
      const bottomTick = Math.min(topPrice, bottomPrice) / tick;
      const topTick = Math.max(topPrice, bottomPrice) / tick;
      const visibleTickSpan = topTick - bottomTick;
      if (!(visibleTickSpan > 0)) return;

      const bandTicks = miniDomBandStep(visibleTickSpan, mediaSize.height, options.levelSpacingPx);
      const book = aggregateMiniDomBook(this.levels, tick, bandTicks, bottomTick, topTick);
      if (!book.peak) return;
      const barHeight = miniDomBarHeight(mediaSize.height / Math.max(1, visibleTickSpan / book.step));

      context.save();
      if (options.backgroundColor) {
        context.fillStyle = options.backgroundColor;
        context.fillRect(layout.left, 0, layout.width, mediaSize.height);
      }
      context.font = `600 ${options.fontSize}px 'JetBrains Mono', ui-monospace, monospace`;
      context.textBaseline = "middle";

      const first = Math.ceil(bottomTick / book.step) * book.step;
      for (let band = first; band <= topTick; band += book.step) {
        const value = book.bands.get(band);
        if (!value) continue;
        const y = params.series.priceToCoordinate(band * tick);
        if (y === null || y < -barHeight || y > mediaSize.height + barHeight) continue;
        const top = y - barHeight / 2;

        const baseline = layout.baselineX;
        if (baseline !== null) {
          // Aligned: one baseline, everything running left off it. A price
          // band in a real book carries resting size on one side or the
          // other, so the two practically never land on the same row; where
          // they do, the larger is drawn first so neither is hidden.
          const rows: Array<{ size: number; color: string }> = [];
          if (value.sell > 0 && options.showAsks) rows.push({ size: value.sell, color: options.sellColor });
          if (value.buy > 0 && options.showBids) rows.push({ size: value.buy, color: options.buyColor });
          rows.sort((left, right) => right.size - left.size);
          for (const row of rows) {
            const width = miniDomBarWidth(row.size, book.peak, layout.barExtent);
            context.fillStyle = withAlpha(row.color, options.barOpacity);
            context.fillRect(baseline - width - 1, top, width, barHeight);
          }
          // A count needs a row tall enough to hold it. At tight level
          // spacing the bars are still readable but the numbers would print
          // over one another, so they drop out and the bars carry the read.
          if (options.showSizes && layout.sizesFit && rows.length && barHeight >= options.fontSize) {
            // Left of every bar, in one column, at full strength.
            context.textAlign = "right";
            context.fillStyle = rows[0].color;
            context.fillText(String(Math.round(rows[0].size)), layout.numberX, y + 0.5);
          }
        } else {
          if (value.sell > 0 && options.showAsks) {
            const width = miniDomBarWidth(value.sell, book.peak, layout.barExtent);
            context.fillStyle = withAlpha(options.sellColor, options.barOpacity);
            // The ask rail grows left, away from the bid rail beside it.
            context.fillRect(layout.sellRight - width - 1, top, width, barHeight);
          }
          if (value.buy > 0 && options.showBids) {
            const width = miniDomBarWidth(value.buy, book.peak, layout.barExtent);
            context.fillStyle = withAlpha(options.buyColor, options.barOpacity);
            context.fillRect(layout.buyLeft + 1, top, width, barHeight);
          }
          // The count sits on the rail at full strength, so it stays legible
          // over a bar drawn at the band's own translucent colour.
          if (options.showSizes && layout.sizesFit && barHeight >= options.fontSize) {
            if (value.sell > 0 && options.showAsks) {
              context.textAlign = "left";
              context.fillStyle = options.sellColor;
              context.fillText(String(Math.round(value.sell)), layout.sellLeft + 3, y + 0.5);
            }
            if (value.buy > 0 && options.showBids) {
              context.textAlign = "right";
              context.fillStyle = options.buyColor;
              context.fillText(String(Math.round(value.buy)), layout.buyRight - 3, y + 0.5);
            }
          }
        }
      }
      context.restore();
    });
  }
}
