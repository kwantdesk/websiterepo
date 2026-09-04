import type { InstitutionalVolumeProfile, InstitutionalVolumeProfileLevel } from "./institutionalMarketData.ts";

export const CONFLUENCE_IDENTIFIER_SETTINGS_VERSION = 1;

export type ConfluenceProfilePeriod = "daily" | "weekly" | "monthly" | "composite";
export type ConfluenceProfileSlot = "first" | "second" | "third";
export type ConfluenceInputStatus = "LIVE" | "HISTORICAL" | "WAITING_FOR_VOLUME_AT_PRICE" | "WAITING_FOR_ORDER_HISTORY";

export type ConfluenceIdentifierSettings = {
  schemaVersion: number;
  inputData: "volume" | "order";
  filterMin: number;
  filterMax: number;
  tickSensitivity: number;
  minimumConfluences: number;
  startMode: "zig-zag" | "date";
  startDateMs: number;
  trendReversalPercent: number;
  trendSwingCount: number;
  swingReversalPercent: number;
  enableZigZagSwing: boolean;
  includeSwingBeforeMidTrend: boolean;
  enableRetracements: boolean;
  enableRetracement382: boolean;
  enableRetracement50: boolean;
  enableRetracement618: boolean;
  enableRetracement75: boolean;
  excludePreviousRetracements: boolean;
  showDevelopingLines: boolean;
  showSourceLines: boolean;
  showLabels: boolean;
  lineWidth: number;
  zoneOpacity: number;
  firstEnabled: boolean;
  firstPeriod: ConfluenceProfilePeriod;
  firstGroupingMode: "automatic" | "manual";
  firstGroupTicks: number;
  firstIncludeByNumber: boolean;
  firstProfileCount: number;
  firstUsePoc: boolean;
  firstUseValueArea: boolean;
  firstUsePeaks: boolean;
  firstUseValleys: boolean;
  firstUseDeltaImbalances: boolean;
  secondEnabled: boolean;
  secondPeriod: ConfluenceProfilePeriod;
  secondGroupingMode: "automatic" | "manual";
  secondGroupTicks: number;
  secondIncludeByNumber: boolean;
  secondProfileCount: number;
  secondUsePoc: boolean;
  secondUseValueArea: boolean;
  secondUsePeaks: boolean;
  secondUseValleys: boolean;
  secondUseDeltaImbalances: boolean;
  thirdEnabled: boolean;
  thirdPeriod: ConfluenceProfilePeriod;
  thirdGroupingMode: "automatic" | "manual";
  thirdGroupTicks: number;
  thirdIncludeByNumber: boolean;
  thirdProfileCount: number;
  thirdUsePoc: boolean;
  thirdUseValueArea: boolean;
  thirdUsePeaks: boolean;
  thirdUseValleys: boolean;
  thirdUseDeltaImbalances: boolean;
  peakMinimumVolumePercent: number;
  valleyMaximumVolumePercent: number;
  deltaImbalancePercent: number;
  supportRange2: number;
  supportRange3: number;
  supportRange4: number;
  resistanceRange2: number;
  resistanceRange3: number;
  resistanceRange4: number;
  supportColor1: string;
  supportColor2: string;
  supportColor3: string;
  supportColor4: string;
  resistanceColor1: string;
  resistanceColor2: string;
  resistanceColor3: string;
  resistanceColor4: string;
  trendUpColor: string;
  trendDownColor: string;
  swingUpColor: string;
  swingDownColor: string;
  startLineColor: string;
  useThemeColors: boolean;
};

export type ConfluenceProfileInput = {
  slot: ConfluenceProfileSlot;
  status: ConfluenceInputStatus;
  profiles: readonly InstitutionalVolumeProfile[];
};

export type ConfluenceCandle = { timestamp: number; high: number; low: number; close: number };
export type ConfluencePivot = { timestamp: number; price: number; kind: "high" | "low" };
export type ConfluenceSourceLevel = {
  id: string;
  price: number;
  timestamp: number;
  source: string;
  sideHint: "support" | "resistance" | "neutral";
};
export type ConfluenceZone = {
  id: string;
  low: number;
  high: number;
  centre: number;
  side: "support" | "resistance";
  confluences: number;
  tier: 1 | 2 | 3 | 4;
  sources: string[];
  color: string;
};
export type ConfluenceIdentifierFrame = {
  status: "LIVE" | "HISTORICAL" | "PARTIAL" | "WAITING_FOR_VOLUME_AT_PRICE" | "WAITING_FOR_ORDER_HISTORY";
  startTime: number | null;
  pivots: ConfluencePivot[];
  sourceLevels: ConfluenceSourceLevel[];
  zones: ConfluenceZone[];
};

export const DEFAULT_CONFLUENCE_IDENTIFIER_SETTINGS: ConfluenceIdentifierSettings = {
  schemaVersion: CONFLUENCE_IDENTIFIER_SETTINGS_VERSION,
  inputData: "volume", filterMin: 0, filterMax: 0,
  tickSensitivity: 3, minimumConfluences: 5,
  startMode: "zig-zag", startDateMs: 0, trendReversalPercent: 3, trendSwingCount: 9,
  swingReversalPercent: 1, enableZigZagSwing: true, includeSwingBeforeMidTrend: true,
  enableRetracements: true, enableRetracement382: true, enableRetracement50: true,
  enableRetracement618: true, enableRetracement75: true, excludePreviousRetracements: true,
  showDevelopingLines: false, showSourceLines: false, showLabels: true,
  lineWidth: 1, zoneOpacity: 18,
  firstEnabled: true, firstPeriod: "daily", firstGroupingMode: "automatic", firstGroupTicks: 4,
  firstIncludeByNumber: true, firstProfileCount: 6, firstUsePoc: true, firstUseValueArea: true,
  firstUsePeaks: true, firstUseValleys: true, firstUseDeltaImbalances: false,
  secondEnabled: true, secondPeriod: "weekly", secondGroupingMode: "automatic", secondGroupTicks: 4,
  secondIncludeByNumber: true, secondProfileCount: 4, secondUsePoc: true, secondUseValueArea: true,
  secondUsePeaks: true, secondUseValleys: true, secondUseDeltaImbalances: false,
  thirdEnabled: true, thirdPeriod: "composite", thirdGroupingMode: "automatic", thirdGroupTicks: 4,
  thirdIncludeByNumber: true, thirdProfileCount: 1, thirdUsePoc: true, thirdUseValueArea: true,
  thirdUsePeaks: true, thirdUseValleys: true, thirdUseDeltaImbalances: false,
  peakMinimumVolumePercent: 60, valleyMaximumVolumePercent: 25, deltaImbalancePercent: 70,
  supportRange2: 6, supportRange3: 8, supportRange4: 10,
  resistanceRange2: 6, resistanceRange3: 8, resistanceRange4: 10,
  supportColor1: "#22C55E", supportColor2: "#16A34A", supportColor3: "#15803D", supportColor4: "#14532D",
  resistanceColor1: "#EF4444", resistanceColor2: "#DC2626", resistanceColor3: "#B91C1C", resistanceColor4: "#7F1D1D",
  trendUpColor: "#22C55E", trendDownColor: "#EF4444", swingUpColor: "#4ADE80", swingDownColor: "#FB7185",
  startLineColor: "#94A3B8", useThemeColors: true,
};

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const integer = (value: unknown, fallback: number, low: number, high: number) => Math.round(clamp(finite(value, fallback), low, high));
const choice = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => values.includes(value as T) ? value as T : fallback;

export function normalizeConfluenceIdentifierSettings(input?: Record<string, unknown> | null): ConfluenceIdentifierSettings {
  const source = input ?? {};
  const result = { ...DEFAULT_CONFLUENCE_IDENTIFIER_SETTINGS, ...source } as ConfluenceIdentifierSettings;
  result.schemaVersion = CONFLUENCE_IDENTIFIER_SETTINGS_VERSION;
  result.inputData = choice(source.inputData, ["volume", "order"], "volume");
  result.startMode = choice(source.startMode, ["zig-zag", "date"], "zig-zag");
  for (const slot of ["first", "second", "third"] as const) {
    result[`${slot}Period`] = choice(source[`${slot}Period`], ["daily", "weekly", "monthly", "composite"], DEFAULT_CONFLUENCE_IDENTIFIER_SETTINGS[`${slot}Period`]);
    result[`${slot}GroupingMode`] = choice(source[`${slot}GroupingMode`], ["automatic", "manual"], "automatic");
    result[`${slot}GroupTicks`] = integer(source[`${slot}GroupTicks`], 4, 1, 500);
    result[`${slot}ProfileCount`] = integer(source[`${slot}ProfileCount`], DEFAULT_CONFLUENCE_IDENTIFIER_SETTINGS[`${slot}ProfileCount`], 1, 250);
  }
  result.filterMin = clamp(finite(source.filterMin, 0), 0, 10_000_000);
  result.filterMax = clamp(finite(source.filterMax, 0), 0, 10_000_000);
  result.tickSensitivity = integer(source.tickSensitivity, 3, 1, 500);
  result.minimumConfluences = integer(source.minimumConfluences, 5, 1, 500);
  result.startDateMs = Math.max(0, finite(source.startDateMs, 0));
  result.trendReversalPercent = clamp(finite(source.trendReversalPercent, 3), 0.01, 10);
  result.trendSwingCount = integer(source.trendSwingCount, 9, 1, 100);
  result.swingReversalPercent = clamp(finite(source.swingReversalPercent, 1), 0.01, 10);
  result.peakMinimumVolumePercent = clamp(finite(source.peakMinimumVolumePercent, 60), 0, 100);
  result.valleyMaximumVolumePercent = clamp(finite(source.valleyMaximumVolumePercent, 25), 0, 100);
  result.deltaImbalancePercent = clamp(finite(source.deltaImbalancePercent, 70), 0, 100);
  result.lineWidth = clamp(finite(source.lineWidth, 1), 0.5, 6);
  result.zoneOpacity = clamp(finite(source.zoneOpacity, 18), 0, 100);
  for (const side of ["support", "resistance"] as const) {
    result[`${side}Range2`] = integer(source[`${side}Range2`], 6, 1, 500);
    result[`${side}Range3`] = integer(source[`${side}Range3`], 8, result[`${side}Range2`], 500);
    result[`${side}Range4`] = integer(source[`${side}Range4`], 10, result[`${side}Range3`], 500);
  }
  return result;
}

function zigZag(candles: readonly ConfluenceCandle[], reversalPercent: number): ConfluencePivot[] {
  if (candles.length < 2) return [];
  const pivots: ConfluencePivot[] = [];
  let direction: 1 | -1 | 0 = 0;
  let extremeIndex = 0;
  let extreme = candles[0].close;
  for (let index = 1; index < candles.length; index += 1) {
    const candle = candles[index];
    if (direction === 0) {
      const base = Math.max(Math.abs(candles[0].close), Number.EPSILON);
      const move = (candle.close - candles[0].close) / base * 100;
      if (Math.abs(move) >= reversalPercent) {
        direction = move > 0 ? 1 : -1;
        extremeIndex = index;
        extreme = direction > 0 ? candle.high : candle.low;
      }
      continue;
    }
    const candidate = direction > 0 ? candle.high : candle.low;
    if ((direction > 0 && candidate >= extreme) || (direction < 0 && candidate <= extreme)) {
      extreme = candidate;
      extremeIndex = index;
    }
    const reversed = direction > 0
      ? (extreme - candle.low) / Math.max(Math.abs(extreme), Number.EPSILON) * 100 >= reversalPercent
      : (candle.high - extreme) / Math.max(Math.abs(extreme), Number.EPSILON) * 100 >= reversalPercent;
    if (!reversed) continue;
    pivots.push({ timestamp: candles[extremeIndex].timestamp, price: extreme, kind: direction > 0 ? "high" : "low" });
    direction = direction > 0 ? -1 : 1;
    extremeIndex = index;
    extreme = direction > 0 ? candle.high : candle.low;
  }
  if (direction !== 0) pivots.push({ timestamp: candles[extremeIndex].timestamp, price: extreme, kind: direction > 0 ? "high" : "low" });
  return pivots;
}

function localProfileLevels(levels: readonly InstitutionalVolumeProfileLevel[], minimumPeak: number, maximumValley: number) {
  const maximum = Math.max(1, ...levels.map((level) => level.volume));
  const peaks: InstitutionalVolumeProfileLevel[] = [];
  const valleys: InstitutionalVolumeProfileLevel[] = [];
  for (let index = 1; index < levels.length - 1; index += 1) {
    const previous = levels[index - 1].volume;
    const current = levels[index].volume;
    const next = levels[index + 1].volume;
    const percent = current / maximum * 100;
    if (current > previous && current >= next && percent >= minimumPeak) peaks.push(levels[index]);
    if (current < previous && current <= next && percent <= maximumValley) valleys.push(levels[index]);
  }
  return { peaks, valleys };
}

function tierFor(side: "support" | "resistance", count: number, settings: ConfluenceIdentifierSettings): 1 | 2 | 3 | 4 {
  const p = side === "support" ? "support" : "resistance";
  if (count >= settings[`${p}Range4`]) return 4;
  if (count >= settings[`${p}Range3`]) return 3;
  if (count >= settings[`${p}Range2`]) return 2;
  return 1;
}

function zoneColor(side: "support" | "resistance", tier: 1 | 2 | 3 | 4, settings: ConfluenceIdentifierSettings) {
  return settings[`${side}Color${tier}`];
}

export function buildConfluenceIdentifierFrame(args: {
  candles: readonly ConfluenceCandle[];
  profileInputs: readonly ConfluenceProfileInput[];
  tickSize: number;
  settings?: Record<string, unknown> | null;
  isLive?: boolean;
}): ConfluenceIdentifierFrame {
  const settings = normalizeConfluenceIdentifierSettings(args.settings);
  const candles = args.candles.filter((candle) => Number.isFinite(candle.timestamp) && Number.isFinite(candle.high) && Number.isFinite(candle.low) && Number.isFinite(candle.close));
  const empty: ConfluenceIdentifierFrame = { status: args.isLive === false ? "HISTORICAL" : "LIVE", startTime: null, pivots: [], sourceLevels: [], zones: [] };
  if (!candles.length) return { ...empty, status: settings.inputData === "order" ? "WAITING_FOR_ORDER_HISTORY" : "WAITING_FOR_VOLUME_AT_PRICE" };

  const trendPivots = zigZag(candles, settings.trendReversalPercent);
  const startTime = settings.startMode === "date" && settings.startDateMs > 0
    ? settings.startDateMs
    : trendPivots[Math.max(0, trendPivots.length - settings.trendSwingCount)]?.timestamp ?? candles[0].timestamp;
  const scopedCandles = candles.filter((candle) => candle.timestamp >= startTime);
  let pivots = zigZag(scopedCandles, settings.swingReversalPercent);
  if (!settings.includeSwingBeforeMidTrend && scopedCandles.length) {
    const midpoint = (scopedCandles[0].timestamp + scopedCandles.at(-1)!.timestamp) / 2;
    pivots = pivots.filter((pivot) => pivot.timestamp >= midpoint);
  }

  const sourceLevels: ConfluenceSourceLevel[] = [];
  const add = (price: number | null | undefined, timestamp: number, source: string, sideHint: ConfluenceSourceLevel["sideHint"] = "neutral") => {
    if (!Number.isFinite(price)) return;
    const safePrice = Number(price);
    sourceLevels.push({ id: `${source}:${timestamp}:${safePrice}:${sourceLevels.length}`, price: safePrice, timestamp, source, sideHint });
  };

  if (settings.enableZigZagSwing) {
    pivots.forEach((pivot, index) => add(pivot.price, pivot.timestamp, `Swing ${index + 1}`, pivot.kind === "low" ? "support" : "resistance"));
  }
  if (settings.enableRetracements && pivots.length >= 2) {
    const pairs = settings.excludePreviousRetracements ? [pivots.slice(-2)] : pivots.slice(1).map((pivot, index) => [pivots[index], pivot]);
    const ratios = [
      [settings.enableRetracement382, 0.382, "38.2%"], [settings.enableRetracement50, 0.5, "50%"],
      [settings.enableRetracement618, 0.618, "61.8%"], [settings.enableRetracement75, 0.75, "75%"],
    ] as const;
    pairs.forEach(([from, to], pairIndex) => ratios.forEach(([enabled, ratio, label]) => {
      if (enabled && from && to) add(to.price + (from.price - to.price) * ratio, to.timestamp, `Retracement ${label} · ${pairIndex + 1}`);
    }));
  }

  let missingProfiles = false;
  let missingOrders = settings.inputData === "order";
  for (const input of args.profileInputs) {
    const prefix = input.slot;
    if (!settings[`${prefix}Enabled`]) continue;
    if (input.status === "WAITING_FOR_ORDER_HISTORY") missingOrders = true;
    if (input.status === "WAITING_FOR_VOLUME_AT_PRICE") missingProfiles = true;
    const profiles = settings[`${prefix}IncludeByNumber`] ? input.profiles.slice(-settings[`${prefix}ProfileCount`]) : input.profiles;
    profiles.filter((profile) => profile.endMs >= startTime).forEach((profile, profileIndex) => {
      const label = `${prefix[0].toUpperCase()}${prefix.slice(1)} VBP ${profileIndex + 1}`;
      if (settings[`${prefix}UsePoc`]) add(profile.poc, profile.endMs, `${label} POC`);
      if (settings[`${prefix}UseValueArea`]) {
        add(profile.vah, profile.endMs, `${label} VAH`, "resistance");
        add(profile.val, profile.endMs, `${label} VAL`, "support");
      }
      const local = localProfileLevels(profile.levels, settings.peakMinimumVolumePercent, settings.valleyMaximumVolumePercent);
      if (settings[`${prefix}UsePeaks`]) local.peaks.forEach((level) => add(level.price, profile.endMs, `${label} Peak`));
      if (settings[`${prefix}UseValleys`]) local.valleys.forEach((level) => add(level.price, profile.endMs, `${label} Valley`));
      if (settings[`${prefix}UseDeltaImbalances`]) profile.levels.forEach((level) => {
        const total = Math.max(0, level.volume);
        if (total > 0 && Math.abs(level.delta) / total * 100 >= settings.deltaImbalancePercent) {
          add(level.price, profile.endMs, `${label} Delta imbalance`, level.delta >= 0 ? "support" : "resistance");
        }
      });
    });
  }

  sourceLevels.sort((left, right) => left.price - right.price || left.timestamp - right.timestamp);
  const tolerance = Math.max(args.tickSize, args.tickSize * settings.tickSensitivity);
  const clusters: ConfluenceSourceLevel[][] = [];
  let active: ConfluenceSourceLevel[] = [];
  for (const level of sourceLevels) {
    if (!active.length || level.price - active[0].price <= tolerance + 1e-9) active.push(level);
    else { clusters.push(active); active = [level]; }
  }
  if (active.length) clusters.push(active);
  const latest = candles.at(-1)!.close;
  const zones = clusters.flatMap((cluster, index): ConfluenceZone[] => {
    const distinct = new Set(cluster.map((level) => level.source)).size;
    if (distinct < settings.minimumConfluences) return [];
    const centre = cluster.reduce((sum, level) => sum + level.price, 0) / cluster.length;
    const side = centre <= latest ? "support" : "resistance";
    const tier = tierFor(side, distinct, settings);
    const halfTick = Math.max(args.tickSize / 2, Number.EPSILON);
    return [{
      id: `confluence:${index}:${Math.round(centre / Math.max(args.tickSize, Number.EPSILON))}`,
      low: Math.min(...cluster.map((level) => level.price)) - halfTick,
      high: Math.max(...cluster.map((level) => level.price)) + halfTick,
      centre, side, confluences: distinct, tier,
      sources: [...new Set(cluster.map((level) => level.source))],
      color: zoneColor(side, tier, settings),
    }];
  });

  const profileRequested = args.profileInputs.some((input) => settings[`${input.slot}Enabled`]);
  const structuralAvailable = sourceLevels.length > 0;
  const status = missingOrders
    ? (structuralAvailable ? "PARTIAL" : "WAITING_FOR_ORDER_HISTORY")
    : missingProfiles && profileRequested
      ? (structuralAvailable ? "PARTIAL" : "WAITING_FOR_VOLUME_AT_PRICE")
      : args.isLive === false ? "HISTORICAL" : "LIVE";
  return { status, startTime, pivots, sourceLevels, zones };
}
