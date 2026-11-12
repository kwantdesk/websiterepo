import { futuresInstrumentRoot } from "./futuresInstrumentIdentity";
import type { OptionsFlowPrint } from "./optionsFlow";
import { GEXBOT_FLOW_TICKER, newYorkSessionKey, type GexBotFlowPayload } from "./gexBotFlow";

export function classicGexSupportsInstrument(instrument: string, broker?: string) {
  return (broker === undefined || broker === "Databento") && ["NQ", "MNQ"].includes(futuresInstrumentRoot(instrument));
}

export type ClassicGexMappingSource = "NDX" | "QQQ";
export type ClassicGexExpiry = "ZERO_DTE" | "NEXT_EXPIRY" | "ALL";
export type ClassicGexSource = "VOLUME" | "OPEN_INTEREST";
export type ClassicGexStatus = "LIVE" | "EOD" | "STALE";

export type ClassicGexProfileRow = {
  strike: number;
  mappedPrice: number;
  call: number;
  put: number;
  net: number;
  callContracts: number | null;
  putContracts: number | null;
  gamma: number | null;
};

export type ClassicGexMajor = {
  strike: number;
  mappedPrice: number;
  value: number;
} | null;

export type ClassicGexHistorySnapshot = {
  timestamp: number;
  rows: ClassicGexProfileRow[];
};

export type ClassicGexProfilePayload = {
  instrument: "NQ";
  sourceSymbol: ClassicGexMappingSource;
  sessionDate: string;
  expiration: string | null;
  expiry: ClassicGexExpiry;
  profileSource: ClassicGexSource;
  representation: "PER_ONE_PERCENT_MOVE";
  status: ClassicGexStatus;
  snapshotMode: "LIVE" | "NEW_YORK_EOD";
  asOf: string;
  refreshAfterMs: number;
  dataAgeMs: number;
  stale: boolean;
  sourcePrice: number | null;
  futuresPrice: number | null;
  mapping: {
    mode: "AUTO" | "MANUAL";
    scale: number;
    offset: number;
    // Live-implied source→futures ratio at build time. A MANUAL multiplier is
    // user-frozen, so the renderer compares it against this to badge a stale
    // or insane manual ratio.
    referenceScale: number | null;
    // LIVE: both ratio legs (futures and cash source) were fresh when the
    // scale was formed. PINNED: the cash leg was frozen (overnight / provider
    // stale), so the scale is held at the last live-verified basis instead of
    // being recomputed — a live numerator over a frozen denominator makes
    // every mapped line track the futures tick for tick.
    basis: "LIVE" | "PINNED";
  };
  rows: ClassicGexProfileRow[];
  majors: {
    positiveVolume: ClassicGexMajor;
    negativeVolume: ClassicGexMajor;
    positiveOpenInterest: ClassicGexMajor;
    negativeOpenInterest: ClassicGexMajor;
  };
  zeroGamma: ClassicGexMajor;
  methodology: {
    exposureSource: string;
    contractSource: string;
    volumeMethod: string;
    version: string;
  };
};

export function classicGexMajor(
  rows: ClassicGexProfileRow[],
  side: "POSITIVE" | "NEGATIVE",
): ClassicGexMajor {
  const candidates = rows.filter((row) => side === "POSITIVE" ? row.net > 0 : row.net < 0);
  if (!candidates.length) return null;
  const selected = candidates.reduce((best, row) => (
    side === "POSITIVE"
      ? row.net > best.net ? row : best
      : row.net < best.net ? row : best
  ));
  return {
    strike: selected.strike,
    mappedPrice: selected.mappedPrice,
    value: selected.net,
  };
}

export function mapClassicGexPrice(
  strike: number,
  mapping: { mode: "AUTO" | "MANUAL"; scale: number; offset: number },
) {
  return strike * mapping.scale + mapping.offset;
}

export function normalizeClassicGexRow(args: {
  strike: number;
  mappedPrice: number;
  call: number;
  put: number;
  callContracts?: number | null;
  putContracts?: number | null;
  gamma?: number | null;
}): ClassicGexProfileRow {
  // QuantData's PER_ONE_PERCENT_MOVE values are already risk values. Preserve
  // their absolute magnitude; only apply the Classic call/put sign convention.
  const call = Math.abs(args.call);
  const put = -Math.abs(args.put);
  return {
    strike: args.strike,
    mappedPrice: args.mappedPrice,
    call,
    put,
    net: call + put,
    callContracts: args.callContracts ?? null,
    putContracts: args.putContracts ?? null,
    gamma: args.gamma ?? null,
  };
}

type ClassicGexVolumePrint = Pick<OptionsFlowPrint, "expirationDate" | "strikePrice" | "contractType" | "volume">;

export function classicGexObservedVolumes(prints: ClassicGexVolumePrint[]) {
  const contracts = new Map<string, { strike: number; side: "call" | "put"; volume: number }>();
  for (const { expirationDate, strikePrice, contractType, volume } of prints) {
    if (!expirationDate || strikePrice == null || !Number.isFinite(strikePrice) || strikePrice <= 0
      || volume == null || !Number.isFinite(volume) || volume <= 0
      || (contractType !== "CALL" && contractType !== "PUT")) continue;
    const key = expirationDate + ":" + strikePrice + ":" + contractType;
    if (volume <= (contracts.get(key)?.volume ?? 0)) continue;
    contracts.set(key, { strike: strikePrice, side: contractType === "CALL" ? "call" : "put", volume });
  }
  const strikes = new Map<number, { call?: number; put?: number }>();
  for (const { strike, side, volume } of contracts.values()) {
    const totals = strikes.get(strike) ?? {};
    totals[side] = (totals[side] ?? 0) + volume;
    strikes.set(strike, totals);
  }
  return strikes;
}

export function selectClassicGexRows(
  source: ClassicGexSource,
  volumeRows: ClassicGexProfileRow[],
  openInterestRows: ClassicGexProfileRow[],
) {
  return source === "VOLUME" ? volumeRows : openInterestRows;
}

export function interpolateScenarioZeroGamma(
  curve: Array<{ price: number; netGex: number }>,
  referencePrice: number,
) {
  const ordered = curve
    .filter((point) => Number.isFinite(point.price) && Number.isFinite(point.netGex))
    .sort((left, right) => left.price - right.price);
  const crossings: number[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const left = ordered[index - 1];
    const right = ordered[index];
    if (left.netGex === 0) crossings.push(left.price);
    if (right.netGex === 0) crossings.push(right.price);
    if (left.netGex === 0 || right.netGex === 0 || Math.sign(left.netGex) === Math.sign(right.netGex)) continue;
    const weight = Math.abs(left.netGex) / (Math.abs(left.netGex) + Math.abs(right.netGex));
    crossings.push(left.price + (right.price - left.price) * weight);
  }
  if (!crossings.length) return null;
  return crossings.reduce((best, crossing) => (
    Math.abs(crossing - referencePrice) < Math.abs(best - referencePrice) ? crossing : best
  ));
}

export function classicGexLadderGeometry(width: number, widthPercent: number, right: boolean) {
  const percent = Number.isFinite(widthPercent) ? Math.max(8, Math.min(45, widthPercent)) : 24;
  const halfWidth = width * percent / 200;
  return { halfWidth, spineX: right ? width - halfWidth - 5 : halfWidth + 5 };
}

export function classicGexBarWidth(value: number, maximum: number, halfWidth: number, minimum: number, logarithmic: boolean) {
  if (!value) return 0;
  const ratio = logarithmic
    ? Math.log1p(Math.abs(value)) / Math.log1p(maximum)
    : Math.abs(value) / maximum;
  return Math.min(halfWidth, Math.max(minimum, ratio * halfWidth));
}

export function classicGexLookbacks(history: ClassicGexHistorySnapshot[], asOf: number) {
  if (!Number.isFinite(asOf)) return [];
  return [1, 5, 10, 15, 30].flatMap(minutes => {
    const target = asOf - minutes * 60_000;
    let index = history.length - 1;
    while (index >= 0 && history[index].timestamp > target) index -= 1;
    const snapshot = history[index];
    return snapshot && target - snapshot.timestamp <= 90_000 ? [{ minutes, snapshot }] : [];
  });
}

export function classicGexRequest(settings: Record<string, unknown>) {
  const source = settings.mappingSource === "NDX" ? "NDX" : "QQQ";
  const expiry = settings.expiry === "NEXT_EXPIRY" || settings.expiry === "ALL" ? settings.expiry : "ZERO_DTE";
  const profileSource = settings.profileSource === "OPEN_INTEREST" ? "OPEN_INTEREST" : "VOLUME";
  const mapping = settings.mappingMode === "MANUAL" ? "MANUAL" : "AUTO";
  const query = new URLSearchParams({ source, expiry, profileSource, mapping });
  if (mapping === "MANUAL") {
    const multiplier = Number(settings.manualMultiplier ?? 1);
    const offset = Number(settings.premiumOffset ?? 0);
    query.set("multiplier", String(Number.isFinite(multiplier) ? Math.max(0.000001, multiplier) : 1));
    query.set("offset", String(Number.isFinite(offset) ? offset : 0));
  }
  return query.toString();
}

export function isClassicGexResponse(value: unknown, query: URLSearchParams): value is ClassicGexProfilePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<ClassicGexProfilePayload>;
  const mapping = payload.mapping;
  return payload.instrument === "NQ" && payload.sourceSymbol === query.get("source")
    && payload.expiry === query.get("expiry") && payload.profileSource === query.get("profileSource")
    && mapping != null && mapping.mode === query.get("mapping") && Number.isFinite(mapping.scale) && mapping.scale > 0
    && Number.isFinite(mapping.offset) && (mapping.mode !== "MANUAL"
      || (mapping.scale === Number(query.get("multiplier")) && mapping.offset === Number(query.get("offset"))))
    && Number.isFinite(Date.parse(payload.asOf ?? ""))
    && payload.majors != null && Array.isArray(payload.rows);
}

export function classicGexNativeMajorsEligible(instrument: string, source: unknown, expiry: unknown, mapping: unknown) {
  return futuresInstrumentRoot(instrument) === "NQ" && source === "NDX" && expiry !== "NEXT_EXPIRY" && expiry !== "ALL" && mapping !== "MANUAL";
}

export function classicGexNativeMajors(instrument: string, profile: ClassicGexProfilePayload, flow?: GexBotFlowPayload | null) {
  const majors = flow?.majors;
  if (!classicGexNativeMajorsEligible(instrument, profile.sourceSymbol, profile.expiry, profile.mapping.mode)
    || flow?.ticker !== GEXBOT_FLOW_TICKER || flow.status !== "LIVE" || profile.status !== "LIVE"
    || !majors || !Number.isFinite(majors.fetchedAtMs) || newYorkSessionKey(majors.fetchedAtMs) !== profile.sessionDate) return null;
  return majors;
}

export function classicGexRefreshDelay(requested: unknown, suggested?: number) {
  const value = Number(requested);
  const userDelay = Number.isFinite(value) ? Math.max(1_000, Math.min(10_000, value)) : 1_000;
  const sourceDelay = suggested != null && Number.isFinite(suggested) ? Math.min(300_000, suggested) : 0;
  return Math.max(userDelay, sourceDelay);
}

export function shouldPublishClassicGex(lastPublishedAt: number | null, now: number, intervalMs = 1_000) {
  return lastPublishedAt === null || now - lastPublishedAt >= Math.max(1_000, intervalMs);
}

export function appendClassicGexHistory(
  history: ClassicGexHistorySnapshot[],
  snapshot: ClassicGexHistorySnapshot,
  windowMs = 31 * 60_000,
) {
  const previous = history.at(-1);
  if (previous && snapshot.timestamp <= previous.timestamp) return history;
  return [...history, snapshot].filter((row) => snapshot.timestamp - row.timestamp <= windowMs);
}

export function classicGexStatus(args: {
  marketOpen: boolean;
  providerStale: boolean;
  dataAgeMs: number;
  staleAfterMs?: number;
}): ClassicGexStatus {
  if (!args.marketOpen) return "STALE";
  return args.providerStale || args.dataAgeMs > (args.staleAfterMs ?? 20_000) ? "STALE" : "LIVE";
}
