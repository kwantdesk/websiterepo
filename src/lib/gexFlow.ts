export const GEX_FLOW_SCORE_VERSION = "kwant-flow-v1";

export type GexFlowMode = "CONSOLIDATED" | "RAW" | "HYBRID";
export type GexFlowStatus = "LIVE" | "DELAYED" | "STALE" | "HISTORICAL" | "MARKET_CLOSED";
export type GexFlowSide = "ABOVE_ASK" | "ASK" | "MID" | "BID" | "BELOW_BID" | "UNKNOWN";
export type GexFlowDirection = "BULLISH" | "BEARISH" | "NEUTRAL";

export type GexFlowScoreBreakdown = {
  direction: -1 | 0 | 1;
  directionSource: "PROVIDER" | "ESTIMATED" | "UNAVAILABLE";
  premium: number;
  size: number;
  volumeOi: number;
  sizeOi: number;
  execution: number;
  contractRatio: number;
  unusual: number;
  opening: number;
  consolidation: number;
  liquidity: number;
};

export type GexFlowContractRatio = {
  bidContracts: number;
  midContracts: number;
  askContracts: number;
  totalContracts: number;
  classifiedShare: number;
  bidRatio: number;
  midRatio: number;
  askRatio: number;
  dominant: "BID" | "MID" | "ASK" | "UNAVAILABLE";
  source: "PROVIDER" | "SERVER_SESSION_AGGREGATION" | "UNAVAILABLE";
};

export type GexFlowRow = {
  id: string;
  parentId: string | null;
  childCount: number;
  ticker: string;
  osi: string | null;
  contractType: "CALL" | "PUT" | "UNKNOWN";
  expirationDate: string | null;
  dte: number | null;
  strikePrice: number | null;
  fill: number | null;
  fillKind: "PROVIDER" | "WEIGHTED_AVERAGE" | "UNAVAILABLE";
  bid: number | null;
  mid: number | null;
  ask: number | null;
  spreadWidth: number | null;
  spreadPercent: number | null;
  spreadPosition: number | null;
  side: GexFlowSide;
  sideSource: "PROVIDER" | "ESTIMATED" | "UNAVAILABLE";
  sentiment: GexFlowDirection;
  sentimentSource: "PROVIDER" | "ESTIMATED" | "UNAVAILABLE";
  consolidationType: string;
  tradeType: string;
  strategy: string | null;
  strategyConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNAVAILABLE";
  size: number;
  premium: number;
  premiumSource: "PROVIDER" | "DERIVED" | "UNAVAILABLE";
  volume: number | null;
  openInterest: number | null;
  previousOpenInterest: number | null;
  deltaOpenInterest: number | null;
  volumeToOi: number | null;
  sizeToOi: number | null;
  sizeGreaterThanOi: boolean;
  volumeGreaterThanOi: boolean;
  stockPrice: number | null;
  moneynessPercent: number | null;
  moneynessType: "ITM" | "ATM" | "OTM" | "UNKNOWN";
  impliedVolatility: number | null;
  previousImpliedVolatility: number | null;
  ivReaction: "RISING" | "FALLING" | "FLAT" | "UNKNOWN";
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  vanna: number | null;
  charm: number | null;
  unusual: boolean;
  opening: boolean;
  goldenSweep: boolean;
  multiLeg: boolean;
  sweep: boolean;
  block: boolean;
  split: boolean;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  underlyingType: "STOCK" | "ETF" | "INDEX" | "UNKNOWN";
  tradeTime: number;
  dataSource: string;
  contractRatio: GexFlowContractRatio;
  flowScore: number;
  flowScoreBreakdown: GexFlowScoreBreakdown;
};

export type GexFlowSummary = {
  bias: GexFlowDirection;
  netFlow: number;
  callContracts: number;
  callPremium: number;
  putContracts: number;
  putPremium: number;
  putCallRatio: number | null;
  relativeVolume: number | null;
  sweepCount: number;
  blockCount: number;
  splitCount: number;
  unusualCount: number;
  openingCount: number;
  sizeOiCount: number;
  volumeOiCount: number;
};

export type GexFlowPayload = {
  schemaVersion: 1;
  mode: GexFlowMode;
  status: GexFlowStatus;
  asOf: string;
  sessionDate: string;
  marketOpen: boolean;
  replayAt: string | null;
  source: "KwantData";
  rows: GexFlowRow[];
  children: GexFlowRow[];
  summary: GexFlowSummary;
  nextCursor: string[] | null;
  rawAvailable: boolean;
  consolidatedAvailable: boolean;
  stale: boolean;
  refreshAfterMs: number;
  diagnostics: {
    lastPoll: string;
    latencyMs: number;
    rateLimitRemaining: number | null;
    rowsFetched: number;
    rowsVisible: number;
    contractRatioSource: string;
    oiSource: string;
    earningsSource: string;
    flowScoreVersion: string;
    limitations: string[];
  };
};

export const GEX_FLOW_SCORE_WEIGHTS = {
  premium: 0.20,
  size: 0.12,
  volumeOi: 0.14,
  sizeOi: 0.12,
  execution: 0.10,
  contractRatio: 0.10,
  unusual: 0.08,
  opening: 0.06,
  consolidation: 0.05,
  liquidity: 0.03,
} as const;

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function normalizeGexFlowSide(value: unknown): GexFlowSide {
  const original = String(value ?? "").trim().toUpperCase();
  const side = original.replace(/[ +\-]/g, "_");
  if (side === "AA" || original === "A+" || side.includes("ABOVE_ASK")) return "ABOVE_ASK";
  if (side === "ASK" || side === "A" || side === "AT_ASK") return "ASK";
  if (side === "BB" || original === "B-" || side.includes("BELOW_BID")) return "BELOW_BID";
  if (side === "BID" || side === "B" || side === "AT_BID") return "BID";
  if (side.includes("MID")) return "MID";
  return "UNKNOWN";
}

export function estimateGexFlowDirection(
  contractType: GexFlowRow["contractType"],
  side: GexFlowSide,
): GexFlowDirection {
  const bought = side === "ABOVE_ASK" || side === "ASK";
  const sold = side === "BELOW_BID" || side === "BID";
  if ((!bought && !sold) || contractType === "UNKNOWN") return "NEUTRAL";
  if ((contractType === "CALL" && bought) || (contractType === "PUT" && sold)) return "BULLISH";
  return "BEARISH";
}

export function gexFlowSpreadPosition(fill: number | null, bid: number | null, ask: number | null) {
  if (fill === null || bid === null || ask === null || !Number.isFinite(fill + bid + ask) || ask <= bid) return null;
  return (fill - bid) / (ask - bid);
}

export function gexFlowMoneyness(
  contractType: GexFlowRow["contractType"],
  strike: number | null,
  spot: number | null,
) {
  if (strike === null || spot === null || spot <= 0 || contractType === "UNKNOWN") {
    return { percent: null, type: "UNKNOWN" as const };
  }
  const signed = contractType === "CALL" ? (strike - spot) / spot : (spot - strike) / spot;
  const percent = signed * 100;
  const type = Math.abs(percent) <= 0.25 ? "ATM" : percent > 0 ? "OTM" : "ITM";
  return { percent, type } as const;
}

export function gexFlowPremium(fill: number | null, size: number, multiplier: number, providerPremium: number | null) {
  if (providerPremium !== null && providerPremium >= 0) return { value: providerPremium, source: "PROVIDER" as const };
  if (fill !== null && fill >= 0 && size > 0 && multiplier > 0) {
    return { value: fill * size * multiplier, source: "DERIVED" as const };
  }
  return { value: 0, source: "UNAVAILABLE" as const };
}

export function gexFlowOiAnalysis(size: number, volume: number | null, openInterest: number | null) {
  return {
    volumeToOi: openInterest === null || volume === null ? null : openInterest === 0 ? Number.POSITIVE_INFINITY : volume / openInterest,
    sizeToOi: openInterest === null ? null : openInterest === 0 ? Number.POSITIVE_INFINITY : size / openInterest,
    sizeGreaterThanOi: openInterest !== null && size > openInterest,
    volumeGreaterThanOi: openInterest !== null && volume !== null && volume > openInterest,
  };
}

export function filterGexFlowRowsAtCutoff<T extends Pick<GexFlowRow, "tradeTime">>(rows: T[], cutoff: number | null) {
  return cutoff === null ? rows : rows.filter((row) => row.tradeTime <= cutoff);
}

export function gexFlowContractKey(row: Pick<GexFlowRow, "osi" | "ticker" | "expirationDate" | "strikePrice" | "contractType">) {
  return row.osi || `${row.ticker}:${row.expirationDate ?? "?"}:${row.strikePrice ?? "?"}:${row.contractType}`;
}

export function deriveGexFlowContractRatios(rows: Array<Pick<GexFlowRow, "osi" | "ticker" | "expirationDate" | "strikePrice" | "contractType" | "side" | "size">>) {
  const buckets = new Map<string, { bid: number; mid: number; ask: number; unknown: number }>();
  for (const row of rows) {
    const key = gexFlowContractKey(row);
    const bucket = buckets.get(key) ?? { bid: 0, mid: 0, ask: 0, unknown: 0 };
    const size = Math.max(0, row.size);
    if (row.side === "ABOVE_ASK" || row.side === "ASK") bucket.ask += size;
    else if (row.side === "BELOW_BID" || row.side === "BID") bucket.bid += size;
    else if (row.side === "MID") bucket.mid += size;
    else bucket.unknown += size;
    buckets.set(key, bucket);
  }
  return new Map([...buckets].map(([key, bucket]) => {
    const total = bucket.ask + bucket.mid + bucket.bid;
    const observed = total + bucket.unknown;
    const unavailable = total <= 0;
    const askRatio = unavailable ? 0 : bucket.ask / total;
    const midRatio = unavailable ? 0 : bucket.mid / total;
    const bidRatio = unavailable ? 0 : bucket.bid / total;
    const dominant = unavailable ? "UNAVAILABLE" : askRatio >= bidRatio && askRatio >= midRatio ? "ASK" : bidRatio >= midRatio ? "BID" : "MID";
    return [key, {
      bidContracts: bucket.bid,
      midContracts: bucket.mid,
      askContracts: bucket.ask,
      totalContracts: total,
      classifiedShare: observed > 0 ? total / observed : 0,
      bidRatio,
      midRatio,
      askRatio,
      dominant,
      source: unavailable ? "UNAVAILABLE" : "SERVER_SESSION_AGGREGATION",
    } satisfies GexFlowContractRatio];
  }));
}

function percentile(values: number[], value: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let count = 0;
  while (count < sorted.length && sorted[count] <= value) count += 1;
  return count / sorted.length;
}

export function scoreGexFlowRows(rows: GexFlowRow[]) {
  const byTicker = new Map<string, GexFlowRow[]>();
  rows.forEach((row) => byTicker.set(row.ticker, [...(byTicker.get(row.ticker) ?? []), row]));
  return rows.map((row) => {
    const context = byTicker.get(row.ticker) ?? rows;
    const direction = row.sentiment === "BULLISH" ? 1 : row.sentiment === "BEARISH" ? -1 : 0;
    const spreadQuality = row.spreadPercent === null ? 0.5 : clamp01(1 - row.spreadPercent / 0.5);
    const execution = row.side === "ABOVE_ASK" || row.side === "BELOW_BID" ? 1 : row.side === "ASK" || row.side === "BID" ? 0.8 : row.side === "MID" ? 0.3 : 0;
    const directionalRatio = direction === 0
      ? 0
      : row.contractType === "CALL"
        ? direction > 0 ? row.contractRatio.askRatio : row.contractRatio.bidRatio
        : row.contractType === "PUT"
          ? direction > 0 ? row.contractRatio.bidRatio : row.contractRatio.askRatio
          : 0;
    const breakdown: GexFlowScoreBreakdown = {
      direction: direction as -1 | 0 | 1,
      directionSource: row.sentimentSource,
      premium: percentile(context.map((item) => item.premium), row.premium),
      size: percentile(context.map((item) => item.size), row.size),
      volumeOi: clamp01((row.volumeToOi ?? 0) / 10),
      sizeOi: clamp01((row.sizeToOi ?? 0) / 2),
      execution,
      contractRatio: directionalRatio,
      unusual: row.unusual ? 1 : 0,
      opening: row.opening ? 1 : 0,
      consolidation: row.sweep ? 1 : row.block || row.split ? 0.8 : row.multiLeg ? 0.7 : 0.35,
      liquidity: spreadQuality,
    };
    const quality = Object.entries(GEX_FLOW_SCORE_WEIGHTS).reduce((sum, [key, weight]) => sum + breakdown[key as keyof typeof GEX_FLOW_SCORE_WEIGHTS] * weight, 0);
    return { ...row, flowScore: Math.round(100 * direction * clamp01(quality)), flowScoreBreakdown: breakdown };
  });
}

export function summarizeGexFlow(rows: GexFlowRow[], relativeVolume: number | null = null): GexFlowSummary {
  const callRows = rows.filter((row) => row.contractType === "CALL");
  const putRows = rows.filter((row) => row.contractType === "PUT");
  const callContracts = callRows.reduce((sum, row) => sum + row.size, 0);
  const putContracts = putRows.reduce((sum, row) => sum + row.size, 0);
  const callPremium = callRows.reduce((sum, row) => sum + row.premium, 0);
  const putPremium = putRows.reduce((sum, row) => sum + row.premium, 0);
  const netFlow = rows.reduce((sum, row) => sum + (row.sentiment === "BULLISH" ? row.premium : row.sentiment === "BEARISH" ? -row.premium : 0), 0);
  return {
    bias: netFlow > 0 ? "BULLISH" : netFlow < 0 ? "BEARISH" : "NEUTRAL",
    netFlow,
    callContracts,
    callPremium,
    putContracts,
    putPremium,
    putCallRatio: callContracts > 0 ? putContracts / callContracts : null,
    relativeVolume,
    sweepCount: rows.filter((row) => row.sweep).length,
    blockCount: rows.filter((row) => row.block).length,
    splitCount: rows.filter((row) => row.split).length,
    unusualCount: rows.filter((row) => row.unusual).length,
    openingCount: rows.filter((row) => row.opening).length,
    sizeOiCount: rows.filter((row) => row.sizeGreaterThanOi).length,
    volumeOiCount: rows.filter((row) => row.volumeGreaterThanOi).length,
  };
}
