import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import { ladderBandStep, ladderBarHeight, ladderBarWidth } from "@/lib/priceLadderGeometry";

/**
 * Delta Bar, docked to the side of the chart.
 *
 * In a lower pane the Delta Bar answers "what was the delta of each bar". Moved
 * to the side it answers a different question — "at which PRICES did the delta
 * happen" — which is the one you ask while watching the candles come toward a
 * level. It draws one vertical spine at the chosen edge and a horizontal spike
 * per price band: buying spikes one colour, selling the other, each at the
 * height of the price it traded at, so a spike lines up with the candles beside
 * it.
 *
 * The ladder spans the WHOLE visible price range, top to bottom of the pane,
 * and rescales as the chart moves: the longest spike is the biggest net delta
 * currently on screen. That keeps the read local — a huge print from a level
 * long since scrolled past cannot flatten everything you are actually looking
 * at.
 *
 * Docked right the spikes grow left, into the chart and away from the price
 * scale. Docked left they mirror, growing right, so in both cases they reach
 * toward the candles rather than off the edge of the pane.
 */

export type DeltaLadderLevel = {
  price: number;
  /** Net signed delta at this price: positive is buying, negative selling. */
  delta: number;
};

export type DeltaLadderSide = "right" | "left";

export type DeltaLadderOptions = {
  side: DeltaLadderSide;
  /** How far the longest spike reaches, in pixels. */
  widthPx: number;
  /** Gap between the spine and the pane edge it is docked against. */
  edgeGapPx: number;
  buyColor: string;
  sellColor: string;
  spineColor: string;
  /** Rough pixels between banded price levels. */
  levelSpacingPx: number;
  barOpacity: number;
  showValues: boolean;
  fontSize: number;
};

export const DEFAULT_DELTA_LADDER_OPTIONS: DeltaLadderOptions = {
  side: "right",
  widthPx: 150,
  edgeGapPx: 2,
  buyColor: "#22C55E",
  sellColor: "#EF4444",
  spineColor: "#6B7280",
  levelSpacingPx: 22,
  barOpacity: 0.85,
  showValues: true,
  fontSize: 8,
};

/**
 * Where the spine sits and which way the spikes grow.
 *
 * `direction` is +1 when spikes grow right and -1 when they grow left, so the
 * renderer never has to branch on the side again.
 */
export function deltaLadderLayout(input: {
  paneWidth: number;
  widthPx: number;
  edgeGapPx: number;
  side: DeltaLadderSide;
}) {
  const gap = Math.max(0, input.edgeGapPx);
  // Never wider than the pane can hold, so the spikes cannot run off the far
  // side however wide the setting is pushed.
  const extent = Math.max(20, Math.min(input.widthPx, Math.max(20, input.paneWidth - gap - 20)));
  const spineX = input.side === "right"
    ? Math.max(extent, input.paneWidth - gap)
    : Math.min(input.paneWidth - extent, gap);
  const direction = input.side === "right" ? -1 : 1;
  return {
    spineX,
    direction,
    extent,
    /** The far end a full-length spike reaches. */
    farX: spineX + direction * extent,
  };
}

/**
 * Sum executed delta into price bands across the visible range.
 *
 * The peak is the largest ABSOLUTE band, because a spike's length reads as
 * "how much delta", with the side carried by colour — scaling buying and
 * selling separately would make a small sell look like a big one.
 */
export function aggregateDeltaLadder(
  levels: readonly DeltaLadderLevel[],
  tickSize: number,
  bandTicks: number,
  bottomTick: number,
  topTick: number,
) {
  const step = Math.max(1, Math.round(bandTicks) || 1);
  const bands = new Map<number, number>();
  let peak = 0;
  if (!(tickSize > 0)) return { bands, peak, step };
  for (const level of levels) {
    const delta = Number(level.delta);
    if (!Number.isFinite(delta) || delta === 0) continue;
    const tick = level.price / tickSize;
    if (!Number.isFinite(tick) || tick < bottomTick || tick > topTick) continue;
    const bucket = Math.round(tick / step) * step;
    if (bucket < bottomTick || bucket > topTick) continue;
    bands.set(bucket, (bands.get(bucket) ?? 0) + delta);
  }
  // Measured only once every band is final. Tracking the peak while summing
  // would let a band that later cancels toward zero set the scale on the way
  // past, shortening every other spike against a level that isn't there.
  for (const total of bands.values()) peak = Math.max(peak, Math.abs(total));
  return { bands, peak, step };
}

const withAlpha = (color: string, alpha: number) => {
  const hex = color.trim();
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const int = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},${alpha})`;
};

export class DeltaLadderPrimitive implements ISeriesPrimitive<Time> {
  private attachedParams: SeriesAttachedParameter<Time> | null = null;
  private levels: DeltaLadderLevel[] = [];
  private tickSize = 0.25;
  private options: DeltaLadderOptions | null = null;
  private readonly paneView: ISeriesPrimitivePaneView;

  constructor() {
    const renderer: ISeriesPrimitivePaneRenderer = {
      draw: (target: CanvasRenderingTarget2D) => this.draw(target),
    };
    this.paneView = {
      // Above the candles: a spike is read against the price beside it, and a
      // candle drawn over one hides the delta it is reporting.
      zOrder: () => "top" as const,
      renderer: () => renderer,
    };
  }

  setLevels(levels: DeltaLadderLevel[], tickSize: number, options: DeltaLadderOptions) {
    this.levels = levels;
    this.tickSize = tickSize > 0 ? tickSize : this.tickSize;
    this.options = options;
    this.attachedParams?.requestUpdate();
  }

  /**
   * Restyle without touching the data. A width, side or colour change has to
   * show at once rather than waiting for the next execution to arrive.
   */
  setOptions(options: DeltaLadderOptions) {
    this.options = options;
    this.attachedParams?.requestUpdate();
  }

  /** Stop drawing, for when the study is switched off or moved back to a pane. */
  clear() {
    this.levels = [];
    this.options = null;
    this.attachedParams?.requestUpdate();
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this.attachedParams = param;
  }

  detached() {
    this.attachedParams = null;
    this.levels = [];
    this.options = null;
  }

  paneViews() {
    return [this.paneView];
  }

  private draw(target: CanvasRenderingTarget2D) {
    const params = this.attachedParams;
    const options = this.options;
    if (!params || !options || !this.levels.length) return;

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const layout = deltaLadderLayout({
        paneWidth: mediaSize.width,
        widthPx: options.widthPx,
        edgeGapPx: options.edgeGapPx,
        side: options.side,
      });

      // Band across what is on screen, so the ladder covers the pane top to
      // bottom and rescales as the view moves.
      const topPrice = params.series.coordinateToPrice(0);
      const bottomPrice = params.series.coordinateToPrice(mediaSize.height);
      if (topPrice === null || bottomPrice === null) return;
      const tick = this.tickSize > 0 ? this.tickSize : 0.25;
      const bottomTick = Math.min(topPrice, bottomPrice) / tick;
      const topTick = Math.max(topPrice, bottomPrice) / tick;
      const visibleTickSpan = topTick - bottomTick;
      if (!(visibleTickSpan > 0)) return;

      const bandTicks = ladderBandStep(visibleTickSpan, mediaSize.height, options.levelSpacingPx);
      const profile = aggregateDeltaLadder(this.levels, tick, bandTicks, bottomTick, topTick);
      if (!profile.peak) return;
      const barHeight = ladderBarHeight(mediaSize.height / Math.max(1, visibleTickSpan / profile.step));

      context.save();

      // The spine: one vertical line the spikes hang off, drawn the full height
      // of the pane so the ladder reads as a single instrument rather than a
      // scatter of unconnected bars.
      context.strokeStyle = options.spineColor;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(Math.round(layout.spineX) + 0.5, 0);
      context.lineTo(Math.round(layout.spineX) + 0.5, mediaSize.height);
      context.stroke();

      context.font = `600 ${options.fontSize}px 'JetBrains Mono', ui-monospace, monospace`;
      context.textBaseline = "middle";

      const first = Math.ceil(bottomTick / profile.step) * profile.step;
      for (let band = first; band <= topTick; band += profile.step) {
        const delta = profile.bands.get(band);
        if (!delta) continue;
        const y = params.series.priceToCoordinate(band * tick);
        if (y === null || y < -barHeight || y > mediaSize.height + barHeight) continue;

        const length = ladderBarWidth(Math.abs(delta), profile.peak, layout.extent);
        const buying = delta > 0;
        const color = buying ? options.buyColor : options.sellColor;
        // Every spike leaves the spine in the same direction — toward the
        // candles — with the sign carried by colour, so lengths compare
        // against one baseline instead of two.
        const near = layout.spineX;
        const far = near + layout.direction * length;
        context.fillStyle = withAlpha(color, options.barOpacity);
        context.fillRect(Math.min(near, far), y - barHeight / 2, length, barHeight);

        if (options.showValues && barHeight >= options.fontSize) {
          context.fillStyle = color;
          // Printed just past the tip so the number never sits on the bar it
          // is describing, and never crosses the spine.
          context.textAlign = layout.direction < 0 ? "right" : "left";
          context.fillText(
            `${buying ? "+" : "−"}${Math.round(Math.abs(delta)).toLocaleString()}`,
            far + layout.direction * 3,
            y,
          );
        }
      }
      context.restore();
    });
  }
}
