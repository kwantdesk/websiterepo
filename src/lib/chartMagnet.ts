/**
 * Chart magnet: locks a drawing anchor onto the nearest candle OHLC value.
 *
 * Two behaviours the previous implementation lacked, and which caused the
 * "spazzing" anchors:
 *
 * 1. **Stickiness.** Snapping purely to "whichever candidate is nearest right
 *    now" makes the anchor flip between a candle's open and close — or between
 *    two neighbouring bars — on sub-pixel pointer movement, because those
 *    candidates are near-equidistant. Once locked, a target is held until the
 *    pointer clearly leaves it, so the anchor stays put while the hand shakes.
 *
 * 2. **Velocity gating.** A magnet that snaps at every speed fights the user
 *    while they are still deciding where to put the anchor. Dragging quickly
 *    runs free; easing off near the target lets it lock. The two speed
 *    thresholds form a Schmitt trigger so a drag hovering at one threshold
 *    cannot rattle between free and locked.
 *
 * Placement clicks ignore velocity entirely: a click is a deliberate act, so
 * it always takes the nearest candidate inside the radius.
 */

export type MagnetMode = "off" | "weak" | "medium" | "strong";

export type MagnetCandidate = {
  /** Candidate position in pane pixels. */
  x: number;
  y: number;
  /** Chart time the candidate belongs to. */
  time: number;
  /** The OHLC value itself. */
  price: number;
  /** Stable identity used for lock stickiness (e.g. `${time}:high`). */
  key: string;
};

export type MagnetCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type MagnetSourceCandle = Omit<MagnetCandle, "time"> & { timestamp: number };

/**
 * Give the drawing layer the exact same time coordinates as the candle
 * series. Event bars can complete several times inside one wall-clock second;
 * collapsing those timestamps made every such bar point at the same screen
 * column and left the magnet snapping to an apparently random neighbour.
 */
export function buildMagnetCandles(
  candles: readonly MagnetSourceCandle[],
  preserveEventBars: boolean,
): MagnetCandle[] {
  let previousChartTime = Number.NEGATIVE_INFINITY;
  return candles.map((candle) => {
    const naturalTime = Math.floor(Number(candle.timestamp) / 1_000);
    const time = preserveEventBars
      ? Math.max(naturalTime, previousChartTime + 1)
      : naturalTime;
    previousChartTime = time;
    return {
      time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    };
  });
}

/**
 * Resolve against every candle visibly inside the horizontal capture band,
 * not just the candle whose timestamp happens to be nearest. At compressed
 * zoom levels several bars share that band; the nearest wick/body on screen
 * is the target the trader is actually pointing at.
 */
export function nearestCandleMagnetCandidate(args: {
  candles: readonly MagnetCandle[];
  pointerTime: number;
  x: number;
  y: number;
  radiusPx: number;
  toX: (time: number) => number | null;
  toY: (price: number) => number | null;
}): MagnetCandidate | null {
  const { candles, pointerTime, x, y, radiusPx, toX, toY } = args;
  if (!candles.length || radiusPx <= 0) return null;

  let low = 0;
  let high = candles.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (candles[middle].time < pointerTime) low = middle + 1;
    else high = middle;
  }

  let best: MagnetCandidate | null = null;
  let bestDistance = radiusPx;
  const inspect = (index: number) => {
    const candle = candles[index];
    const candleX = toX(candle.time);
    if (candleX == null || !Number.isFinite(candleX)) return candleX;
    const horizontalDistance = Math.abs(candleX - x);
    if (horizontalDistance > radiusPx) return candleX;

    // Wick extremes deliberately win exact ties against body edges.
    for (const [field, price] of [
      ["high", candle.high],
      ["low", candle.low],
      ["open", candle.open],
      ["close", candle.close],
    ] as const) {
      const candidateY = toY(price);
      if (candidateY == null || !Number.isFinite(candidateY)) continue;
      const distance = Math.hypot(candleX - x, candidateY - y);
      if (distance > radiusPx || (best !== null && distance >= bestDistance)) continue;
      bestDistance = distance;
      best = {
        key: `${candle.time}:${field}`,
        time: candle.time,
        price,
        x: candleX,
        y: candidateY,
      };
    }
    return candleX;
  };

  // Screen X is monotonic with candle order. Walk out from the time insertion
  // point and stop each direction only after it has left the capture band.
  for (let index = low; index < candles.length; index += 1) {
    const candleX = inspect(index);
    if (candleX != null && candleX > x + radiusPx) break;
  }
  for (let index = Math.min(low - 1, candles.length - 1); index >= 0; index -= 1) {
    const candleX = inspect(index);
    if (candleX != null && candleX < x - radiusPx) break;
  }

  return best;
}

/** Pixel radius inside which a pointer can lock onto a candidate. */
export function magnetRadiusPx(mode: MagnetMode): number {
  return mode === "weak" ? 10 : mode === "medium" ? 18 : 28;
}

/**
 * A locked target is only released once the pointer travels this much further
 * than the capture radius, which is what stops open/close flip-flopping.
 */
const RELEASE_RADIUS_MULTIPLIER = 1.75;

/**
 * A rival candidate must be clearly closer than the locked one before the lock
 * moves, so near-ties resolve in favour of the anchor already showing.
 */
const RIVAL_ADVANTAGE = 0.62;

/** Above this pointer speed (px/ms) a drag runs free — no snapping at all. */
const FREE_SPEED_PX_PER_MS = 1.15;

/** Below this pointer speed (px/ms) a drag is "aiming" and may lock. */
const LOCK_SPEED_PX_PER_MS = 0.5;

/** Smoothing applied to instantaneous speed so one jittery sample cannot flip the gate. */
const SPEED_SMOOTHING = 0.35;

export type MagnetIntent = "place" | "drag";

export type MagnetResolveInput = {
  x: number;
  y: number;
  /** event.timeStamp — monotonic, in milliseconds. */
  timestampMs: number;
  mode: MagnetMode;
  intent: MagnetIntent;
  /** Snap targets in pane pixels; typically each visible candle's O/H/L/C. */
  candidates: readonly MagnetCandidate[];
};

export type MagnetResolver = {
  /** The candidate to lock onto, or null to follow the raw pointer. */
  resolve(input: MagnetResolveInput): MagnetCandidate | null;
  /** Forget speed history and any held lock (call when a gesture ends). */
  reset(): void;
};

export function createMagnetResolver(): MagnetResolver {
  let lastX: number | null = null;
  let lastY: number | null = null;
  let lastTimestampMs: number | null = null;
  let smoothedSpeed = 0;
  let lockedKey: string | null = null;
  // Schmitt trigger state: true while the pointer is moving slowly enough to aim.
  let aiming = true;

  const reset = () => {
    lastX = null;
    lastY = null;
    lastTimestampMs = null;
    smoothedSpeed = 0;
    lockedKey = null;
    aiming = true;
  };

  return {
    reset,
    resolve({ x, y, timestampMs, mode, intent, candidates }) {
      if (mode === "off" || candidates.length === 0) {
        lockedKey = null;
        return null;
      }

      if (intent === "drag") {
        if (lastX !== null && lastY !== null && lastTimestampMs !== null) {
          const elapsed = timestampMs - lastTimestampMs;
          // Guard against a zero/negative delta from coalesced or replayed events.
          if (elapsed > 0) {
            const instantSpeed = Math.hypot(x - lastX, y - lastY) / elapsed;
            smoothedSpeed = smoothedSpeed + (instantSpeed - smoothedSpeed) * SPEED_SMOOTHING;
          }
        }
        lastX = x;
        lastY = y;
        lastTimestampMs = timestampMs;
        if (aiming && smoothedSpeed > FREE_SPEED_PX_PER_MS) aiming = false;
        else if (!aiming && smoothedSpeed < LOCK_SPEED_PX_PER_MS) aiming = true;
        if (!aiming) {
          // Moving fast: follow the pointer exactly and drop any held lock so
          // the next slow-down re-evaluates from scratch.
          lockedKey = null;
          return null;
        }
      } else {
        // A click is deliberate; never let leftover drag speed suppress it.
        lastX = null;
        lastY = null;
        lastTimestampMs = null;
        smoothedSpeed = 0;
        aiming = true;
        // It is also a new anchor. Reusing the previous hover/anchor lock can
        // pull a second click back to the first candle even when another wick
        // is now visibly nearer.
        lockedKey = null;
      }

      const radius = magnetRadiusPx(mode);
      const releaseRadius = radius * RELEASE_RADIUS_MULTIPLIER;

      let nearest: MagnetCandidate | null = null;
      let nearestDistance = Infinity;
      let held: MagnetCandidate | null = null;
      let heldDistance = Infinity;

      for (const candidate of candidates) {
        const distance = Math.hypot(candidate.x - x, candidate.y - y);
        if (candidate.key === lockedKey) {
          held = candidate;
          heldDistance = distance;
        }
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = candidate;
        }
      }

      // Keep the current lock while the pointer stays near it, unless another
      // candidate is decisively closer.
      if (held && heldDistance <= releaseRadius) {
        if (!nearest || nearest.key === held.key || nearestDistance > heldDistance * RIVAL_ADVANTAGE) {
          return held;
        }
      }

      if (nearest && nearestDistance <= radius) {
        lockedKey = nearest.key;
        return nearest;
      }

      lockedKey = null;
      return null;
    },
  };
}
