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
