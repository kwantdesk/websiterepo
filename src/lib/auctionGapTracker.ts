import type { FootprintBar } from "./footprint.ts";

export type AuctionGapDetectionSettings = {
  minimumTickVolume: number;
  maximumOppositeVolume: number;
  includeMode: "intrabar" | "all" | "extreme-only" | "high-only" | "low-only" | "wick-only";
  minimumConsecutiveLevels: number;
};

// Observed official settings screenshot, not recovered constructor constants.
export const DEFAULT_AUCTION_GAP_DETECTION: AuctionGapDetectionSettings = {
  minimumTickVolume: 0, maximumOppositeVolume: 0,
  includeMode: "intrabar", minimumConsecutiveLevels: 3,
};

export type AuctionGapCandidate = {
  id: string;
  sourceBarId: string;
  startTime: number;
  endTime: number;
  side: "buy" | "sell";
  lowTick: number;
  highTick: number;
  levelCount: number;
  dominantVolume: number;
  oppositeVolume: number;
  provisional: boolean;
};

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}

export function normalizeAuctionGapDetection(input: Record<string, unknown> = {}): AuctionGapDetectionSettings {
  return {
    minimumTickVolume: boundedInteger(input.minimumTickVolume, 0, 0, 10_000_000),
    maximumOppositeVolume: boundedInteger(input.maximumOppositeVolume, 0, 0, 10_000_000),
    includeMode: ["intrabar", "all", "extreme-only", "high-only", "low-only", "wick-only"].includes(String(input.includeMode))
      ? input.includeMode as AuctionGapDetectionSettings["includeMode"] : "intrabar",
    minimumConsecutiveLevels: boundedInteger(input.minimumConsecutiveLevels, 3, 1, 1000),
  };
}

/** A grouped row cannot establish whether any constituent tick had zero prints.
 * Caller must supply an independently built, unfiltered, one-tick volume dataset.
 * A live bar is recomputed, not permanently confirmed: later prints can fill it.
 * No OHLC interpolation, omitted-row filling or missing-side classification.
 */
export function detectAuctionGaps(
  bar: FootprintBar,
  source: { groupTicks: number; inputType: "volume" | "num-trades"; sizeFiltered: boolean },
  input: Record<string, unknown> = {},
): { status: "ready" | "requires-raw-volume" | "invalid-data"; gaps: AuctionGapCandidate[] } {
  const empty = (status: "requires-raw-volume" | "invalid-data") => ({ status, gaps: [] });
  if (source.groupTicks !== 1 || source.inputType !== "volume" || source.sizeFiltered || !bar.hasPriceLevelFlow) {
    return empty("requires-raw-volume");
  }
  if (!bar.id || !Number.isFinite(bar.startTime) || !Number.isFinite(bar.endTime) || bar.endTime < bar.startTime
    || !Number.isSafeInteger(bar.lowTick) || !Number.isSafeInteger(bar.highTick) || bar.lowTick > bar.highTick) {
    return empty("invalid-data");
  }
  const settings = normalizeAuctionGapDetection(input);
  if (settings.includeMode === "wick-only" && (!Number.isSafeInteger(bar.openTick) || !Number.isSafeInteger(bar.closeTick)
    || Math.min(bar.openTick, bar.closeTick) < bar.lowTick || Math.max(bar.openTick, bar.closeTick) > bar.highTick)) {
    return empty("invalid-data");
  }
  const rows = [...bar.rows].sort((a, b) => a.tickIndex - b.tickIndex);
  let previous = -Infinity;
  for (const row of rows) {
    if (!Number.isSafeInteger(row.tickIndex) || row.tickIndex <= previous || row.tickIndex < bar.lowTick || row.tickIndex > bar.highTick
      || [row.bidVolume, row.askVolume, row.unknownVolume].some(v => !Number.isFinite(v) || v < 0)) {
      return empty("invalid-data");
    }
    previous = row.tickIndex;
  }
  const gaps: AuctionGapCandidate[] = [];
  for (const side of ["buy", "sell"] as const) {
    let run: AuctionGapCandidate | null = null;
    const flush = () => {
      if (run && run.levelCount >= settings.minimumConsecutiveLevels) gaps.push(run);
      run = null;
    };
    for (const row of rows) {
      const dominant = side === "buy" ? row.askVolume : row.bidVolume;
      const opposite = side === "buy" ? row.bidVolume : row.askVolume;
      const inside = settings.includeMode === "all"
        || (settings.includeMode === "intrabar" && row.tickIndex > bar.lowTick && row.tickIndex < bar.highTick)
        || (settings.includeMode === "extreme-only" && (row.tickIndex === bar.lowTick || row.tickIndex === bar.highTick))
        || (settings.includeMode === "high-only" && row.tickIndex === bar.highTick)
        || (settings.includeMode === "low-only" && row.tickIndex === bar.lowTick)
        || (settings.includeMode === "wick-only" && (row.tickIndex < Math.min(bar.openTick, bar.closeTick)
          || row.tickIndex > Math.max(bar.openTick, bar.closeTick)));
      // Unknown prints could belong to the allegedly absent side. A tie or an
      // empty row has no evidenced direction, even with a positive threshold.
      const qualifies = inside && row.unknownVolume === 0 && dominant > opposite
        && dominant + opposite >= settings.minimumTickVolume && opposite <= settings.maximumOppositeVolume;
      if (!qualifies) { flush(); continue; }
      if (run && row.tickIndex !== run.highTick + 1) flush();
      if (!run) {
        run = { id: JSON.stringify([bar.id, side, row.tickIndex]), sourceBarId: bar.id,
          startTime: bar.startTime, endTime: bar.endTime, side, lowTick: row.tickIndex,
          highTick: row.tickIndex, levelCount: 0, dominantVolume: 0, oppositeVolume: 0,
          provisional: !bar.isClosed };
      }
      run.highTick = row.tickIndex;
      run.levelCount++;
      run.dominantVolume += dominant;
      run.oppositeVolume += opposite;
    }
    flush();
  }
  return { status: "ready", gaps };
}
