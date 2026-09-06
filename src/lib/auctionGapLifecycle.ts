import { detectAuctionGaps, type AuctionGapCandidate, type AuctionGapBar } from "./auctionGapTracker.ts";

export type AuctionGapZone = AuctionGapCandidate & {
  sourceIndex: number;
  endIndex: number;
  state: "fresh" | "triggered";
  triggeredAtBarId: string | null;
  triggeredAtIndex: number | null;
  stoppedBy: "extension" | "reset" | null;
};

export type AuctionGapLifecycleSettings = {
  extendedBars: number;
  // Explicit internal contract; do not assume native TriggerOnlyTouch mapping.
  retestMode: "touch" | "cross";
  showTriggered: boolean;
  onlyTriggered: boolean;
};

export type AuctionGapSourceBar = {
  bar: AuctionGapBar;
  detectionBar?: AuctionGapBar;
  /** Reset subsegments can share an actual chart index. */
  chartIndex?: number;
  /** Exchange-aware bucket resolved by caller. Null disables resets. */
  resetKey: string | null;
  /** Detection filtering only: excluded bars can still retest existing zones. */
  detect: boolean;
};

export type AuctionGapActiveZone = { zone: AuctionGapZone; resetKey: string | null; expires: number };

function tradedInRange(ticks: readonly number[], low: number, high: number) {
  let left = 0, right = ticks.length;
  while (left < right) {
    const middle = (left + right) >>> 1;
    if (ticks[middle] < low) left = middle + 1;
    else right = middle;
  }
  return left < ticks.length && ticks[left] <= high;
}

/** Shared transition for historical rebuilds and incremental tail replacements.
 * Mutates only supplied active zones; caller owns correction checkpoints.
 */
export function advanceAuctionGapActive(active: AuctionGapActiveZone[], bar: AuctionGapBar,
  index: number, resetKey: string | null, settings: AuctionGapLifecycleSettings) {
  const tradedTicks = bar.rows.filter(row => row.bidVolume + row.askVolume + row.unknownVolume > 0)
    .map(row => row.tickIndex).sort((a, b) => a - b);
  let write = 0;
  for (const item of active) {
    const { zone } = item;
    const reset = item.resetKey !== resetKey;
    if (reset || index > item.expires) {
      zone.stoppedBy = reset ? "reset" : "extension";
      continue;
    }
    zone.endIndex = index;
    if (zone.state === "fresh" && index > zone.sourceIndex) {
      const touched = tradedInRange(tradedTicks, zone.lowTick, zone.highTick);
      const crossed = touched && Number.isSafeInteger(bar.closeTick)
        && (zone.side === "buy" ? bar.closeTick < zone.lowTick : bar.closeTick > zone.highTick);
      if (settings.retestMode === "touch" ? touched : crossed) {
        zone.state = "triggered";
        zone.triggeredAtBarId = bar.id;
        zone.triggeredAtIndex = index;
      }
    }
    active[write++] = item;
  }
  active.length = write;
}

/** Deterministic rebuild, including historical corrections and forming-bar
 * replacements. Takes source-ordered, replay-clipped, contract-specific rows.
 * Extension counts actual chart bars (including same-ms event bars), not time.
 * A source bar cannot retest its own zone; later prints alone provide evidence.
 */
export function buildAuctionGapLifecycle(
  input: readonly AuctionGapSourceBar[],
  source: { groupTicks: number; inputType: "volume" | "num-trades"; sizeFiltered: boolean },
  detection: Record<string, unknown>,
  settings: AuctionGapLifecycleSettings,
): { status: "ready" | "requires-raw-volume" | "invalid-data"; zones: AuctionGapZone[] } {
  if (!Number.isInteger(settings.extendedBars) || settings.extendedBars < 0 || settings.extendedBars > 10000
    || !["touch", "cross"].includes(settings.retestMode)) return { status: "invalid-data", zones: [] };
  const all: AuctionGapZone[] = [];
  const active: AuctionGapActiveZone[] = [];
  const ids = new Set<string>();
  let priorTime = -Infinity;
  let instrument: string | null = null;
  let previousChartIndex = -1;
  for (let position = 0; position < input.length; position++) {
    const { bar, resetKey, detect, detectionBar } = input[position];
    const index = input[position].chartIndex ?? position;
    if (!Number.isInteger(index) || index < previousChartIndex || index < 0) return { status: "invalid-data", zones: [] };
    previousChartIndex = index;
    if (ids.has(bar.id) || bar.startTime < priorTime || (instrument !== null && bar.instrument !== instrument)) {
      return { status: "invalid-data", zones: [] };
    }
    ids.add(bar.id); priorTime = bar.startTime; instrument = bar.instrument;
    const result = detectAuctionGaps(bar, source, detection);
    // Never leave zones falsely fresh when intervening data is unavailable.
    if (result.status !== "ready") return { status: result.status, zones: [] };
    const detectionResult = detectionBar ? detectAuctionGaps(detectionBar, source, detection) : result;
    if (detectionResult.status !== "ready") return { status: detectionResult.status, zones: [] };
    advanceAuctionGapActive(active, bar, index, resetKey, settings);
    if (!detect) continue;
    for (const gap of detectionResult.gaps) {
      const zone: AuctionGapZone = { ...gap, sourceIndex: index, endIndex: index,
        state: "fresh", triggeredAtBarId: null, triggeredAtIndex: null, stoppedBy: null };
      all.push(zone);
      active.push({ zone, resetKey, expires: index + settings.extendedBars });
    }
  }
  return { status: "ready", zones: all.filter(zone => zone.state === "triggered"
    ? settings.showTriggered : !settings.onlyTriggered) };
}
