export const DARK_POOL_MAP_INDICATOR_ID = "dark-pool-map";
export const DARK_POOL_MAP_WORKSPACE_TOOL_ID = "tool-dark-pool-map";
export const DARK_POOL_MAP_SCHEMA_VERSION = 1;

/**
 * Every underlying exposed by the options-flow instrument picker. Index
 * underlyings do not trade, so their off-exchange source is the corresponding
 * liquid ETF and is mapped into the index's native price space.
 */
export const DARK_POOL_OPTIONS_UNDERLYING_SOURCES = {
  SPX: "SPY",
  SPY: "SPY",
  NDX: "QQQ",
  QQQ: "QQQ",
  IWM: "IWM",
  AAPL: "AAPL",
  NVDA: "NVDA",
  TSLA: "TSLA",
  MSFT: "MSFT",
  AMZN: "AMZN",
  META: "META",
  AMD: "AMD",
} as const;

export type DarkPoolTradeSide = "ABOVE_ASK" | "ASK" | "MID_MARKET" | "BID" | "BELOW_BID" | "UNKNOWN";
export type DarkPoolLocation = "ASK_SIDE" | "BID_SIDE" | "MID" | "UNKNOWN";
export type DarkPoolMappingMode = "direct" | "rolling-affine" | "live-ratio" | "manual";
export type DarkPoolPriceBinMode = "exact-source-price" | "source-cents" | "mapped-points" | "display-ticks";
export type DarkPoolVisualMode = "heat-circles" | "zones" | "circles-and-zones" | "lines" | "historical-ribbons";
export type DarkPoolStatus = "LIVE" | "CACHED" | "DELAYED" | "RESYNCING" | "RATE_LIMITED" | "MAPPING_STALE" | "UNAVAILABLE";
export type DarkPoolOffExchangeClassification = "ATS_CONFIRMED" | "TRF_REPORTED" | "OFF_EXCHANGE_REPORTED" | "UNKNOWN";
export type DarkPoolCorrectionState = "ORIGINAL" | "CORRECTED" | "CANCELED";

export type DarkPoolPrint = {
  id: string;
  ticker: string;
  price: number;
  size: number;
  notionalValue: number;
  printType: "DARK_POOL";
  tradeSide: DarkPoolTradeSide;
  askPrice: number | null;
  askSize: number | null;
  bidPrice: number | null;
  bidSize: number | null;
  isDelayedPrint: boolean;
  tradeTimeMs: number;
  executionTimestampMs?: number;
  reportTimestampMs?: number | null;
  observableTimestampMs?: number;
  source?: string;
  recordId?: string;
  originalRecordId?: string | null;
  offExchangeClassification?: DarkPoolOffExchangeClassification;
  venue?: string | null;
  trf?: string | null;
  tradeConditions?: string[];
  correctionState?: DarkPoolCorrectionState;
  cancellationState?: "ACTIVE" | "CANCELED";
  rawPrice?: number;
  rawShares?: number;
  rawNotional?: number;
  corporateActionAdjustmentFactor?: number;
  adjustedChartPrice?: number;
  corporateAction?: string | null;
};

export type DarkPoolMappingReceipt = {
  method: DarkPoolMappingMode;
  alpha: number;
  beta: number;
  sourceMid: number | null;
  displayMid: number | null;
  rSquared: number | null;
  sampleCount: number;
  calculatedAtMs: number;
  confidence: number;
};

export type MappedDarkPoolPrint = DarkPoolPrint & {
  displayInstrument: string;
  mappedPrice: number;
  mappedTick: number;
  mapping: DarkPoolMappingReceipt;
};

export type DarkPoolLevelAggregate = {
  id: string;
  sourceTicker: string;
  displayInstrument: string;
  sourcePrice: number;
  mappedPrice: number;
  mappedTick: number;
  totalNotional: number;
  totalShares: number;
  tradeCount: number;
  askSideNotional: number;
  bidSideNotional: number;
  midMarketNotional: number;
  unknownSideNotional: number;
  delayedNotional: number;
  nonDelayedNotional: number;
  firstPrintTimeMs: number | null;
  lastPrintTimeMs: number | null;
  sessionCount: number;
  contributingPrintIds: string[];
  strengthScore: number;
  recencyScore: number;
  persistenceScore: number;
  isZoneMember: boolean;
  zoneId: string | null;
};

export type DarkPoolZone = {
  id: string;
  lowerPrice: number;
  upperPrice: number;
  weightedPrice: number;
  totalNotional: number;
  totalShares: number;
  tradeCount: number;
  levelCount: number;
  sessionCount: number;
  firstPrintTimeMs: number | null;
  lastPrintTimeMs: number | null;
  strengthScore: number;
  memberLevelIds: string[];
};

export type DarkPoolMapPayload = {
  schemaVersion: 1;
  provider: "quantdata";
  sourceTicker: string;
  displayInstrument: string;
  direct: boolean;
  status: DarkPoolStatus;
  checkedAtMs: number;
  dataAgeMs: number | null;
  pollIntervalMs: number;
  mapping: DarkPoolMappingReceipt | null;
  prints: MappedDarkPoolPrint[];
  levels: DarkPoolLevelAggregate[];
  zones: DarkPoolZone[];
  baseline: { latestStockPrice: number | null; levelCount: number; totalNotional: number } | null;
  limitations: string[];
};

export type DarkPoolMapSettings = {
  preset: string;
  sourceTicker: string;
  mappingMode: DarkPoolMappingMode;
  visualMode: DarkPoolVisualMode;
  priceBinMode: DarkPoolPriceBinMode;
  historyDays: number;
  pollSeconds: number;
  minimumPrintNotional: number;
  maximumPrintNotional: number;
  minimumPrintShares: number;
  maximumPrintShares: number;
  minimumLevelNotional: number;
  minimumLevelShares: number;
  minimumTradeCount: number;
  topLevels: number;
  minimumStrengthScore: number;
  mappedBinPoints: number;
  sourceBinCents: number;
  displayTickMultiple: number;
  mergeNearbyLevels: boolean;
  mergeTolerancePoints: number;
  maximumZoneWidthPoints: number;
  recencyHalfLifeHours: number;
  sessionsForFullPersistenceScore: number;
  showDelayedPrints: boolean;
  includeDelayedInLevels: boolean;
  includeAskSide: boolean;
  includeBidSide: boolean;
  includeMid: boolean;
  includeUnknown: boolean;
  maximumVisibleCircles: number;
  maximumVisibleZones: number;
  minimumRadius: number;
  maximumRadius: number;
  opacity: number;
  zoneOpacity: number;
  showLevelLabels: boolean;
  showMappingBadge: boolean;
  showMappingConfidence: boolean;
  showLevelTable: boolean;
  useThemeColors: boolean;
  neutralColor: string;
  askSideColor: string;
  bidSideColor: string;
  midColor: string;
  delayedColor: string;
  manualAlpha: number;
  manualBeta: number;
  minimumMappingR2: number;
  mappingWindowMinutes: number;
  minimumMappingSamples: number;
  staleAllowanceSeconds: number;
  enableAlerts: boolean;
  alertNewLargePrint: boolean;
  alertNewLargeLevel: boolean;
  alertScoreThreshold: boolean;
  alertPriceApproach: boolean;
  alertPriceTouch: boolean;
  browserNotifications: boolean;
  alertPrintNotional: number;
  alertLevelNotional: number;
  alertScore: number;
  alertDistancePoints: number;
  alertCooldownSeconds: number;
};

export const defaultDarkPoolMapSettings: DarkPoolMapSettings = {
  preset: "balanced",
  sourceTicker: "AUTO",
  mappingMode: "rolling-affine",
  visualMode: "circles-and-zones",
  priceBinMode: "mapped-points",
  historyDays: 2,
  pollSeconds: 2,
  minimumPrintNotional: 100_000,
  maximumPrintNotional: 0,
  minimumPrintShares: 0,
  maximumPrintShares: 0,
  minimumLevelNotional: 5_000_000,
  minimumLevelShares: 0,
  minimumTradeCount: 1,
  topLevels: 50,
  minimumStrengthScore: 30,
  mappedBinPoints: 2,
  sourceBinCents: 5,
  displayTickMultiple: 4,
  mergeNearbyLevels: true,
  mergeTolerancePoints: 3,
  maximumZoneWidthPoints: 20,
  recencyHalfLifeHours: 24,
  sessionsForFullPersistenceScore: 5,
  showDelayedPrints: true,
  includeDelayedInLevels: true,
  includeAskSide: true,
  includeBidSide: true,
  includeMid: true,
  includeUnknown: true,
  maximumVisibleCircles: 2_000,
  maximumVisibleZones: 100,
  minimumRadius: 3,
  maximumRadius: 18,
  opacity: 58,
  zoneOpacity: 16,
  showLevelLabels: true,
  showMappingBadge: true,
  showMappingConfidence: true,
  showLevelTable: false,
  useThemeColors: true,
  neutralColor: "#A1A1AA",
  askSideColor: "#22C55E",
  bidSideColor: "#EF4444",
  midColor: "#A1A1AA",
  delayedColor: "#F59E0B",
  manualAlpha: 0,
  manualBeta: 1,
  minimumMappingR2: 0.95,
  mappingWindowMinutes: 60,
  minimumMappingSamples: 120,
  staleAllowanceSeconds: 30,
  enableAlerts: false,
  alertNewLargePrint: true,
  alertNewLargeLevel: true,
  alertScoreThreshold: true,
  alertPriceApproach: false,
  alertPriceTouch: false,
  browserNotifications: false,
  alertPrintNotional: 5_000_000,
  alertLevelNotional: 25_000_000,
  alertScore: 80,
  alertDistancePoints: 5,
  alertCooldownSeconds: 60,
};

export const DARK_POOL_MAP_PRESETS: Record<string, Partial<DarkPoolMapSettings>> = {
  balanced: {},
  institutional: { minimumPrintNotional: 1_000_000, minimumLevelNotional: 25_000_000, topLevels: 20, maximumRadius: 24 },
  live: { historyDays: 1, visualMode: "heat-circles", minimumPrintNotional: 250_000, minimumLevelNotional: 0, pollSeconds: 2 },
  persistent: { historyDays: 20, visualMode: "lines", topLevels: 15, minimumStrengthScore: 45 },
  "nq-qqq": { sourceTicker: "QQQ", mappingMode: "rolling-affine", historyDays: 2 },
  minimal: { visualMode: "lines", topLevels: 5, showLevelTable: false, opacity: 45 },
};

const finite = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

export function normalizeDarkPoolInstrument(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/U\d+$/, "").replace(/V0$/, "");
}

export function defaultDarkPoolSource(displayInput: string) {
  const display = normalizeDarkPoolInstrument(displayInput);
  if (display === "NQ" || display === "MNQ") return "QQQ";
  if (display === "ES" || display === "MES") return "SPY";
  if (display === "RTY" || display === "M2K") return "IWM";
  if (display === "YM" || display === "MYM") return "DIA";
  if (display in DARK_POOL_OPTIONS_UNDERLYING_SOURCES) {
    return DARK_POOL_OPTIONS_UNDERLYING_SOURCES[display as keyof typeof DARK_POOL_OPTIONS_UNDERLYING_SOURCES];
  }
  return display;
}

export function isDirectDarkPoolSource(displayInput: string, sourceInput?: string) {
  const display = normalizeDarkPoolInstrument(displayInput);
  const source = normalizeDarkPoolInstrument(sourceInput ?? defaultDarkPoolSource(display));
  return display === source;
}

export function displayTickSize(displayInput: string) {
  const display = normalizeDarkPoolInstrument(displayInput);
  if (["NQ", "MNQ", "ES", "MES", "RTY", "M2K"].includes(display)) return 0.25;
  if (["YM", "MYM"].includes(display)) return 1;
  return 0.01;
}

export function classifyDarkPoolLocation(side: DarkPoolTradeSide): DarkPoolLocation {
  if (side === "ABOVE_ASK" || side === "ASK") return "ASK_SIDE";
  if (side === "BELOW_BID" || side === "BID") return "BID_SIDE";
  if (side === "MID_MARKET") return "MID";
  return "UNKNOWN";
}

function recordValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) if (record[key] !== undefined && record[key] !== null) return record[key];
  return undefined;
}

function timestampMs(value: unknown) {
  if (typeof value === "number" && value > 10_000_000_000) return value;
  if (typeof value === "number") return value * 1_000;
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return ["1", "TRUE", "YES", "Y", "CANCELED", "CANCELLED"].includes(String(value ?? "").trim().toUpperCase());
}

function stringList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value ?? "").split(/[|,;]/).map((item) => item.trim()).filter(Boolean);
}

function offExchangeClassification(row: Record<string, unknown>): DarkPoolOffExchangeClassification {
  const venue = String(recordValue(row, ["ATS", "ats", "ATS_VENUE", "atsVenue", "VENUE", "venue", "MARKET_CENTER", "marketCenter"]) ?? "").toUpperCase();
  const trf = String(recordValue(row, ["TRF", "trf", "TRF_ID", "trfId", "REPORTING_FACILITY", "reportingFacility"]) ?? "").toUpperCase();
  const classification = String(recordValue(row, ["OFF_EXCHANGE_CLASSIFICATION", "offExchangeClassification", "PRINT_TYPE", "printType", "TRADE_TYPE", "tradeType"]) ?? "").toUpperCase();
  if (classification.includes("ATS") || venue.includes("ATS")) return "ATS_CONFIRMED";
  if (classification.includes("TRF") || trf.includes("TRF") || trf.length > 0) return "TRF_REPORTED";
  // This adapter is fed only by QuantData's dark-pool/off-exchange endpoint.
  // Without venue metadata it proves off-exchange reporting, not a specific ATS.
  return "OFF_EXCHANGE_REPORTED";
}

export function normalizeDarkPoolPrint(value: unknown): DarkPoolPrint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const price = finite(recordValue(row, ["PRICE", "price", "tradePrice"]));
  const size = finite(recordValue(row, ["SIZE", "size", "shares", "volume"]));
  const rawNotional = finite(recordValue(row, ["NOTIONAL_VALUE", "notionalValue", "notional"]));
  const executionTimestampMs = timestampMs(recordValue(row, ["EXECUTION_TIME", "executionTime", "executionTimestamp", "TRADE_TIME", "tradeTime", "trade_time", "timestamp", "time"]));
  const reportTimestampMs = timestampMs(recordValue(row, ["REPORT_TIME", "reportTime", "reportTimestamp", "RECEIVED_TIME", "receivedTime", "publishedAt"]));
  const tradeTimeMs = executionTimestampMs;
  if (!(price && price > 0) || !(size && size > 0) || !Number.isFinite(tradeTimeMs)) return null;
  const validTradeTimeMs = tradeTimeMs as number;
  const sideValue = String(recordValue(row, ["TRADE_SIDE", "tradeSide", "side"]) ?? "UNKNOWN").toUpperCase().replace(/[ -]/g, "_");
  const side = (["ABOVE_ASK", "ASK", "MID_MARKET", "BID", "BELOW_BID"] as const).includes(sideValue as never)
    ? sideValue as DarkPoolTradeSide
    : "UNKNOWN";
  const recordId = String(recordValue(row, ["RECORD_ID", "recordId", "ID", "id", "tradeId", "trade_id"]) ?? `${recordValue(row, ["TICKER", "ticker"])}:${tradeTimeMs}:${price}:${size}`);
  const originalRecordId = String(recordValue(row, ["ORIGINAL_RECORD_ID", "originalRecordId", "ORIGINAL_TRADE_ID", "originalTradeId", "CORRECTS_ID", "correctsId"]) ?? "").trim() || null;
  const correctionCode = String(recordValue(row, ["CORRECTION_STATE", "correctionState", "ACTION", "action", "STATUS", "status", "RECORD_TYPE", "recordType"]) ?? "").toUpperCase();
  const canceled = booleanValue(recordValue(row, ["IS_CANCELED", "isCanceled", "IS_CANCELLED", "isCancelled", "CANCELED", "cancelled"])) || /CANCEL|DELETE|VOID/.test(correctionCode);
  const corrected = Boolean(originalRecordId) || /CORRECT|REPLACE|AMEND/.test(correctionCode);
  const factor = finite(recordValue(row, ["CORPORATE_ACTION_ADJUSTMENT_FACTOR", "corporateActionAdjustmentFactor", "ADJUSTMENT_FACTOR", "adjustmentFactor"])) ?? 1;
  const adjustedPrice = finite(recordValue(row, ["ADJUSTED_PRICE", "adjustedPrice", "adjustedChartPrice"])) ?? price * factor;
  const venue = String(recordValue(row, ["ATS_VENUE", "atsVenue", "VENUE", "venue", "MARKET_CENTER", "marketCenter"]) ?? "").trim() || null;
  const trf = String(recordValue(row, ["TRF", "trf", "TRF_ID", "trfId", "REPORTING_FACILITY", "reportingFacility"]) ?? "").trim() || null;
  return {
    id: recordId,
    ticker: String(recordValue(row, ["TICKER", "ticker", "symbol"]) ?? "").toUpperCase(),
    price,
    size,
    notionalValue: rawNotional && rawNotional > 0 ? rawNotional : price * size,
    printType: "DARK_POOL",
    tradeSide: side,
    askPrice: finite(recordValue(row, ["ASK_PRICE", "askPrice", "ask"])),
    askSize: finite(recordValue(row, ["ASK_SIZE", "askSize"])),
    bidPrice: finite(recordValue(row, ["BID_PRICE", "bidPrice", "bid"])),
    bidSize: finite(recordValue(row, ["BID_SIZE", "bidSize"])),
    isDelayedPrint: Boolean(recordValue(row, ["IS_DELAYED_PRINT", "isDelayedPrint", "delayed"])),
    tradeTimeMs: validTradeTimeMs,
    executionTimestampMs: validTradeTimeMs,
    reportTimestampMs,
    observableTimestampMs: reportTimestampMs ?? validTradeTimeMs,
    source: "QuantData off-exchange endpoint",
    recordId,
    originalRecordId,
    offExchangeClassification: offExchangeClassification(row),
    venue,
    trf,
    tradeConditions: stringList(recordValue(row, ["TRADE_CONDITIONS", "tradeConditions", "CONDITIONS", "conditions"])),
    correctionState: canceled ? "CANCELED" : corrected ? "CORRECTED" : "ORIGINAL",
    cancellationState: canceled ? "CANCELED" : "ACTIVE",
    rawPrice: price,
    rawShares: size,
    rawNotional: rawNotional && rawNotional > 0 ? rawNotional : price * size,
    corporateActionAdjustmentFactor: factor,
    adjustedChartPrice: adjustedPrice,
    corporateAction: String(recordValue(row, ["CORPORATE_ACTION", "corporateAction"]) ?? "").trim() || null,
  };
}

export function deduplicateDarkPoolPrints<T extends DarkPoolPrint>(prints: T[], maximumIds = 100_000) {
  const byId = new Map<string, T>();
  const ordered = [...prints].sort((a, b) => (a.observableTimestampMs ?? a.tradeTimeMs) - (b.observableTimestampMs ?? b.tradeTimeMs));
  for (const print of ordered) {
    const canonicalId = print.originalRecordId || print.recordId || print.id;
    byId.set(canonicalId, print);
    if (byId.size > maximumIds) byId.delete(byId.keys().next().value as string);
  }
  return [...byId.values()].sort((a, b) => (a.observableTimestampMs ?? a.tradeTimeMs) - (b.observableTimestampMs ?? b.tradeTimeMs));
}

export function fitRollingAffine(samples: Array<{ source: number; display: number }>, calculatedAtMs = Date.now()): DarkPoolMappingReceipt | null {
  const valid = samples.filter((sample) => Number.isFinite(sample.source) && Number.isFinite(sample.display) && sample.source > 0 && sample.display > 0);
  if (valid.length < 2) return null;
  const ratios = valid.map((sample) => sample.display / sample.source).sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)];
  const deviations = ratios.map((ratio) => Math.abs(ratio - median)).sort((a, b) => a - b);
  const mad = deviations[Math.floor(deviations.length / 2)] || Math.abs(median) * 0.0025;
  const filtered = valid.filter((sample) => Math.abs(sample.display / sample.source - median) <= mad * 6);
  if (filtered.length < 2) return null;
  const sourceMean = filtered.reduce((sum, sample) => sum + sample.source, 0) / filtered.length;
  const displayMean = filtered.reduce((sum, sample) => sum + sample.display, 0) / filtered.length;
  let covariance = 0;
  let variance = 0;
  for (const sample of filtered) {
    covariance += (sample.source - sourceMean) * (sample.display - displayMean);
    variance += (sample.source - sourceMean) ** 2;
  }
  if (variance <= 0) return null;
  const beta = covariance / variance;
  const alpha = displayMean - beta * sourceMean;
  const total = filtered.reduce((sum, sample) => sum + (sample.display - displayMean) ** 2, 0);
  const residual = filtered.reduce((sum, sample) => sum + (sample.display - (alpha + beta * sample.source)) ** 2, 0);
  const rSquared = total > 0 ? Math.max(0, Math.min(1, 1 - residual / total)) : 1;
  return { method: "rolling-affine", alpha, beta, sourceMid: sourceMean, displayMid: displayMean, rSquared, sampleCount: filtered.length, calculatedAtMs, confidence: rSquared };
}

export function createMappingReceipt(args: {
  mode: DarkPoolMappingMode;
  direct: boolean;
  sourceMid: number | null;
  displayMid: number | null;
  samples?: Array<{ source: number; display: number }>;
  alpha?: number;
  beta?: number;
  minimumSamples?: number;
  minimumR2?: number;
  calculatedAtMs?: number;
}) {
  const calculatedAtMs = args.calculatedAtMs ?? Date.now();
  if (args.direct) return { method: "direct", alpha: 0, beta: 1, sourceMid: args.sourceMid, displayMid: args.displayMid, rSquared: 1, sampleCount: 1, calculatedAtMs, confidence: 1 } satisfies DarkPoolMappingReceipt;
  if (args.mode === "manual" && Number.isFinite(args.alpha) && Number.isFinite(args.beta) && args.beta !== 0) {
    return { method: "manual", alpha: args.alpha ?? 0, beta: args.beta ?? 1, sourceMid: args.sourceMid, displayMid: args.displayMid, rSquared: null, sampleCount: 0, calculatedAtMs, confidence: 1 } satisfies DarkPoolMappingReceipt;
  }
  if (args.mode === "rolling-affine") {
    const affine = fitRollingAffine(args.samples ?? [], calculatedAtMs);
    if (affine && affine.sampleCount >= Math.max(2, args.minimumSamples ?? 120) && (affine.rSquared ?? 0) >= (args.minimumR2 ?? 0.95)) return affine;
  }
  if (args.sourceMid && args.displayMid) {
    return { method: "live-ratio", alpha: 0, beta: args.displayMid / args.sourceMid, sourceMid: args.sourceMid, displayMid: args.displayMid, rSquared: null, sampleCount: 1, calculatedAtMs, confidence: 0.65 } satisfies DarkPoolMappingReceipt;
  }
  return null;
}

export function mapDarkPoolPrint(print: DarkPoolPrint, displayInstrument: string, receipt: DarkPoolMappingReceipt): MappedDarkPoolPrint {
  const tick = displayTickSize(displayInstrument);
  const sourcePrice = print.adjustedChartPrice ?? print.price;
  // Preserve the exact underlying transaction price. Tick size is metadata for
  // display and interaction tolerances; it must not mutate the analytical level.
  const mappedPrice = receipt.method === "direct" ? sourcePrice : receipt.alpha + receipt.beta * sourcePrice;
  return { ...print, displayInstrument, mappedPrice, mappedTick: Math.round(mappedPrice / tick), mapping: { ...receipt } };
}

function percentileRanks(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return values.map((value) => {
    if (sorted.length <= 1) return 1;
    let rank = 0;
    for (let index = 0; index < sorted.length; index += 1) if (sorted[index] <= value) rank = index;
    return rank / (sorted.length - 1);
  });
}

function sessionKey(timeMs: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timeMs));
}

function binKey(print: MappedDarkPoolPrint, settings: DarkPoolMapSettings) {
  if (settings.priceBinMode === "exact-source-price") return `s:${Math.round(print.price * 10_000)}`;
  if (settings.priceBinMode === "source-cents") return `s:${Math.round(print.price / Math.max(0.01, settings.sourceBinCents / 100))}`;
  if (settings.priceBinMode === "display-ticks") return `d:${Math.round(print.mappedTick / Math.max(1, settings.displayTickMultiple))}`;
  return `d:${Math.round(print.mappedPrice / Math.max(displayTickSize(print.displayInstrument), settings.mappedBinPoints))}`;
}

export function aggregateDarkPoolLevels(printsInput: MappedDarkPoolPrint[], settingsInput: Partial<DarkPoolMapSettings> = {}, nowMs = Date.now()) {
  const settings = { ...defaultDarkPoolMapSettings, ...settingsInput };
  const prints = deduplicateDarkPoolPrints(printsInput)
    .filter((print) => print.notionalValue >= settings.minimumPrintNotional)
    .filter((print) => !settings.maximumPrintNotional || print.notionalValue <= settings.maximumPrintNotional)
    .filter((print) => print.size >= settings.minimumPrintShares)
    .filter((print) => !settings.maximumPrintShares || print.size <= settings.maximumPrintShares)
    .filter((print) => settings.showDelayedPrints || !print.isDelayedPrint)
    .filter((print) => {
      const location = classifyDarkPoolLocation(print.tradeSide);
      return location === "ASK_SIDE" ? settings.includeAskSide : location === "BID_SIDE" ? settings.includeBidSide : location === "MID" ? settings.includeMid : settings.includeUnknown;
    });
  const groups = new Map<string, MappedDarkPoolPrint[]>();
  for (const print of prints) {
    if (print.isDelayedPrint && !settings.includeDelayedInLevels) continue;
    const key = binKey(print, settings);
    groups.set(key, [...(groups.get(key) ?? []), print]);
  }
  const raw = [...groups.entries()].map(([key, group]): DarkPoolLevelAggregate => {
    const totalNotional = group.reduce((sum, print) => sum + print.notionalValue, 0);
    const totalShares = group.reduce((sum, print) => sum + print.size, 0);
    const weightedMapped = group.reduce((sum, print) => sum + print.mappedPrice * print.notionalValue, 0) / Math.max(1, totalNotional);
    const weightedSource = group.reduce((sum, print) => sum + print.price * print.notionalValue, 0) / Math.max(1, totalNotional);
    const locationNotional = (location: DarkPoolLocation) => group.filter((print) => classifyDarkPoolLocation(print.tradeSide) === location).reduce((sum, print) => sum + print.notionalValue, 0);
    const sessionCount = new Set(group.map((print) => sessionKey(print.tradeTimeMs))).size;
    const latest = Math.max(...group.map((print) => print.tradeTimeMs));
    const recencyScore = Math.exp(-(nowMs - latest) / Math.max(1, settings.recencyHalfLifeHours * 3_600_000));
    return {
      id: `dark-pool-level:${key}`,
      sourceTicker: group[0].ticker,
      displayInstrument: group[0].displayInstrument,
      sourcePrice: weightedSource,
      mappedPrice: weightedMapped,
      mappedTick: Math.round(weightedMapped / displayTickSize(group[0].displayInstrument)),
      totalNotional,
      totalShares,
      tradeCount: group.length,
      askSideNotional: locationNotional("ASK_SIDE"),
      bidSideNotional: locationNotional("BID_SIDE"),
      midMarketNotional: locationNotional("MID"),
      unknownSideNotional: locationNotional("UNKNOWN"),
      delayedNotional: group.filter((print) => print.isDelayedPrint).reduce((sum, print) => sum + print.notionalValue, 0),
      nonDelayedNotional: group.filter((print) => !print.isDelayedPrint).reduce((sum, print) => sum + print.notionalValue, 0),
      firstPrintTimeMs: Math.min(...group.map((print) => print.tradeTimeMs)),
      lastPrintTimeMs: latest,
      sessionCount,
      contributingPrintIds: group.slice(-200).map((print) => print.id),
      strengthScore: 0,
      recencyScore,
      persistenceScore: Math.min(1, sessionCount / Math.max(1, settings.sessionsForFullPersistenceScore)),
      isZoneMember: false,
      zoneId: null,
    };
  });
  const notional = percentileRanks(raw.map((level) => Math.log1p(level.totalNotional)));
  const shares = percentileRanks(raw.map((level) => Math.log1p(level.totalShares)));
  const counts = percentileRanks(raw.map((level) => Math.log1p(level.tradeCount)));
  raw.forEach((level, index) => {
    level.strengthScore = 100 * (0.5 * notional[index] + 0.15 * shares[index] + 0.1 * counts[index] + 0.15 * level.recencyScore + 0.1 * level.persistenceScore);
  });
  return raw
    .filter((level) => level.totalNotional >= settings.minimumLevelNotional && level.totalShares >= settings.minimumLevelShares && level.tradeCount >= settings.minimumTradeCount && level.strengthScore >= settings.minimumStrengthScore)
    .sort((a, b) => b.strengthScore - a.strengthScore)
    .slice(0, Math.max(1, settings.topLevels));
}

export function clusterDarkPoolZones(levelsInput: DarkPoolLevelAggregate[], settingsInput: Partial<DarkPoolMapSettings> = {}) {
  const settings = { ...defaultDarkPoolMapSettings, ...settingsInput };
  if (!settings.mergeNearbyLevels) return levelsInput.map((level) => levelToZone(level));
  const levels = [...levelsInput].sort((a, b) => a.mappedPrice - b.mappedPrice);
  const groups: DarkPoolLevelAggregate[][] = [];
  for (const level of levels) {
    const group = groups.at(-1);
    const lower = group?.[0].mappedPrice ?? level.mappedPrice;
    const upper = group?.at(-1)?.mappedPrice ?? level.mappedPrice;
    if (group && level.mappedPrice - upper <= settings.mergeTolerancePoints && level.mappedPrice - lower <= settings.maximumZoneWidthPoints) group.push(level);
    else groups.push([level]);
  }
  return groups.map((group, index) => {
    const totalNotional = group.reduce((sum, level) => sum + level.totalNotional, 0);
    const zone: DarkPoolZone = {
      id: `dark-pool-zone:${index}:${group.map((level) => level.id).join("|")}`,
      lowerPrice: Math.min(...group.map((level) => level.mappedPrice)),
      upperPrice: Math.max(...group.map((level) => level.mappedPrice)),
      weightedPrice: group.reduce((sum, level) => sum + level.mappedPrice * level.totalNotional, 0) / Math.max(1, totalNotional),
      totalNotional,
      totalShares: group.reduce((sum, level) => sum + level.totalShares, 0),
      tradeCount: group.reduce((sum, level) => sum + level.tradeCount, 0),
      levelCount: group.length,
      sessionCount: Math.max(...group.map((level) => level.sessionCount)),
      firstPrintTimeMs: Math.min(...group.map((level) => level.firstPrintTimeMs ?? Number.MAX_SAFE_INTEGER)),
      lastPrintTimeMs: Math.max(...group.map((level) => level.lastPrintTimeMs ?? 0)),
      strengthScore: group.reduce((sum, level) => sum + level.strengthScore * level.totalNotional, 0) / Math.max(1, totalNotional),
      memberLevelIds: group.map((level) => level.id),
    };
    group.forEach((level) => { level.isZoneMember = true; level.zoneId = zone.id; });
    return zone;
  });
}

function levelToZone(level: DarkPoolLevelAggregate): DarkPoolZone {
  return { id: `dark-pool-zone:${level.id}`, lowerPrice: level.mappedPrice, upperPrice: level.mappedPrice, weightedPrice: level.mappedPrice, totalNotional: level.totalNotional, totalShares: level.totalShares, tradeCount: level.tradeCount, levelCount: 1, sessionCount: level.sessionCount, firstPrintTimeMs: level.firstPrintTimeMs, lastPrintTimeMs: level.lastPrintTimeMs, strengthScore: level.strengthScore, memberLevelIds: [level.id] };
}

export function isDarkPoolMapPayload(value: unknown): value is DarkPoolMapPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Partial<DarkPoolMapPayload>;
  return payload.schemaVersion === 1 && payload.provider === "quantdata" && typeof payload.sourceTicker === "string" && typeof payload.displayInstrument === "string" && Array.isArray(payload.prints) && Array.isArray(payload.levels) && Array.isArray(payload.zones);
}
