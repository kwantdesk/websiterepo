import { cmeSessionDateKey } from "./chartHistoryWindow.ts";
import type { FootprintBar } from "./footprint.ts";
import { exchangeMinuteOfDay } from "./volumeProfileSessions.ts";

export const UNFINISHED_AUCTION_SETTINGS_VERSION = 1;

export type UnfinishedAuctionSettings = {
  schemaVersion: number;
  daysToLoad: number;
  lineWidth: number;
  badHighColor: string;
  badLowColor: string;
  showRectangle: boolean;
  showBackground: boolean;
  opacity: number;
  filterMode: "none" | "manual";
  manualMinimumVolume: number;
  extendLines: boolean;
  resetMode: "none" | "session-open" | "eth-and-rth-open";
  removeOnShadowTouch: boolean;
  filterTime: "none" | "eth" | "rth" | "custom";
  customStartMinutes: number;
  customEndMinutes: number;
  useThemeColors: boolean;
};

export type UnfinishedAuctionLevel = {
  id: string;
  side: "high" | "low";
  priceTick: number;
  sourceStartMs: number;
  sourceEndMs: number;
  extensionEndMs: number;
  anomalyVolume: number;
  totalVolume: number;
  state: "fresh" | "triggered";
  rawTickData: boolean;
};

export type UnfinishedAuctionFrame = {
  instrument: string;
  tickSize: number;
  status: "LIVE" | "HISTORICAL" | "WAITING_FOR_VOLUME_AT_PRICE" | "GROUPED_EXTREMES";
  levels: UnfinishedAuctionLevel[];
};

export const DEFAULT_UNFINISHED_AUCTION_SETTINGS: UnfinishedAuctionSettings = {
  schemaVersion: UNFINISHED_AUCTION_SETTINGS_VERSION,
  daysToLoad: 5,
  lineWidth: 1,
  badHighColor: "#EF4444",
  badLowColor: "#22C55E",
  showRectangle: true,
  showBackground: true,
  opacity: 22,
  filterMode: "none",
  manualMinimumVolume: 0,
  extendLines: true,
  resetMode: "session-open",
  removeOnShadowTouch: true,
  filterTime: "none",
  customStartMinutes: 8 * 60 + 30,
  customEndMinutes: 15 * 60,
  useThemeColors: true,
};

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function normalizeUnfinishedAuctionSettings(input?: Record<string, unknown> | null): UnfinishedAuctionSettings {
  const source = input ?? {};
  const settings = { ...DEFAULT_UNFINISHED_AUCTION_SETTINGS, ...source } as UnfinishedAuctionSettings;
  settings.schemaVersion = UNFINISHED_AUCTION_SETTINGS_VERSION;
  settings.daysToLoad = Math.round(clamp(finite(source.daysToLoad, 5), 1, 365));
  settings.lineWidth = clamp(finite(source.lineWidth, 1), 1, 8);
  settings.opacity = clamp(finite(source.opacity, 22), 0, 100);
  settings.manualMinimumVolume = Math.round(clamp(finite(source.manualMinimumVolume, 0), 0, 10_000_000));
  settings.customStartMinutes = Math.round(clamp(finite(source.customStartMinutes, 8 * 60 + 30), 0, 1_439));
  settings.customEndMinutes = Math.round(clamp(finite(source.customEndMinutes, 15 * 60), 0, 1_439));
  if (!(["none", "manual"] as const).includes(settings.filterMode)) settings.filterMode = "none";
  if (!(["none", "session-open", "eth-and-rth-open"] as const).includes(settings.resetMode)) settings.resetMode = "session-open";
  if (!(["none", "eth", "rth", "custom"] as const).includes(settings.filterTime)) settings.filterTime = "none";
  return settings;
}

function inClockWindow(minute: number, start: number, end: number) {
  return start <= end ? minute >= start && minute < end : minute >= start || minute < end;
}

function includeBarForSession(bar: FootprintBar, settings: UnfinishedAuctionSettings) {
  if (settings.filterTime === "none") return true;
  const minute = exchangeMinuteOfDay(bar.startTime);
  const inRth = inClockWindow(minute, 8 * 60 + 30, 15 * 60);
  if (settings.filterTime === "rth") return inRth;
  if (settings.filterTime === "eth") return !inRth;
  return inClockWindow(minute, settings.customStartMinutes, settings.customEndMinutes);
}

function isTriggered(level: UnfinishedAuctionLevel, bar: FootprintBar, shadow: boolean) {
  if (level.side === "high") return shadow ? bar.highTick >= level.priceTick : bar.closeTick > level.priceTick;
  return shadow ? bar.lowTick <= level.priceTick : bar.closeTick < level.priceTick;
}

function extensionResetBucket(timestamp: number, mode: UnfinishedAuctionSettings["resetMode"]) {
  if (mode === "none") return "continuous";
  const session = cmeSessionDateKey(timestamp);
  if (mode === "session-open") return session;
  const minute = exchangeMinuteOfDay(timestamp);
  // The CME trading day opens at 17:00 Chicago. The second supported reset is
  // the 08:30 RTH open; the 15:00 close is deliberately not a reset boundary.
  return `${session}:${minute >= 8 * 60 + 30 && minute < 17 * 60 ? "rth" : "eth"}`;
}

/**
 * DeepCharts' Unfinished Auction contract is an extreme-price auction check:
 * a normal high has zero Bid at its highest traded tick and a normal low has
 * zero Ask at its lowest traded tick. A non-zero opposite-side print is the
 * anomaly. Exact one-tick rows are mandatory when available; OHLC is never
 * used to invent an auction.
 */
export function buildUnfinishedAuctionFrame(
  displayBarsInput: FootprintBar[],
  rawBarsInput: FootprintBar[],
  instrument: string,
  tickSize: number,
  input?: Record<string, unknown> | null,
): UnfinishedAuctionFrame {
  const settings = normalizeUnfinishedAuctionSettings(input);
  const latestMs = Math.max(0, ...displayBarsInput.map((bar) => bar.endTime));
  const cutoff = latestMs - settings.daysToLoad * 86_400_000;
  const displayBars = displayBarsInput.filter((bar) => bar.endTime >= cutoff && includeBarForSession(bar, settings));
  const rawById = new Map(rawBarsInput.filter((bar) => bar.endTime >= cutoff && includeBarForSession(bar, settings)).map((bar) => [bar.id, bar]));
  if (!displayBars.some((bar) => bar.hasPriceLevelFlow)) {
    return { instrument, tickSize, status: "WAITING_FOR_VOLUME_AT_PRICE", levels: [] };
  }

  const levels: UnfinishedAuctionLevel[] = [];
  let usedGroupedExtreme = false;
  for (let index = 0; index < displayBars.length; index += 1) {
    const displayBar = displayBars[index];
    const rawBar = rawById.get(displayBar.id);
    const source = rawBar?.hasPriceLevelFlow ? rawBar : displayBar;
    if (!rawBar?.hasPriceLevelFlow) usedGroupedExtreme = true;
    for (const side of ["high", "low"] as const) {
      const priceTick = side === "high" ? source.highTick : source.lowTick;
      const row = source.rows.find((candidate) => candidate.tickIndex === priceTick);
      if (!row) continue;
      const anomalyVolume = side === "high" ? row.bidVolume : row.askVolume;
      if (anomalyVolume <= 0) continue;
      if (settings.filterMode === "manual" && anomalyVolume < settings.manualMinimumVolume) continue;

      const level: UnfinishedAuctionLevel = {
        id: `unfinished-auction:${displayBar.id}:${side}:${priceTick}`,
        side,
        priceTick,
        sourceStartMs: displayBar.startTime,
        sourceEndMs: displayBar.endTime,
        extensionEndMs: displayBar.endTime,
        anomalyVolume,
        totalVolume: row.bidVolume + row.askVolume + row.unknownVolume,
        state: "fresh",
        rawTickData: Boolean(rawBar?.hasPriceLevelFlow),
      };

      if (settings.extendLines) {
        const sourceResetBucket = extensionResetBucket(displayBar.startTime, settings.resetMode);
        for (let laterIndex = index + 1; laterIndex < displayBars.length; laterIndex += 1) {
          const later = displayBars[laterIndex];
          if (extensionResetBucket(later.startTime, settings.resetMode) !== sourceResetBucket) break;
          level.extensionEndMs = later.endTime;
          if (isTriggered(level, later, settings.removeOnShadowTouch)) {
            level.state = "triggered";
            break;
          }
        }
      }
      levels.push(level);
    }
  }

  const latest = displayBars.at(-1);
  return {
    instrument,
    tickSize,
    status: usedGroupedExtreme ? "GROUPED_EXTREMES" : latest && !latest.isClosed ? "LIVE" : "HISTORICAL",
    levels,
  };
}
