#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SESSION_DATE = "2026-08-21";
// Include the pre-market Trinity anchor. OPRA trades begin at 09:30 ET, but the
// earlier boundary lets the carried state remain explicit in the same model.
const SESSION_OPEN_MS = Date.parse("2026-08-21T08:00:00.000Z");
const OPRA_FETCH_START_MS = Date.parse(process.env.OPRA_FETCH_START_ISO || "2026-08-21T08:00:00.000Z");
const FETCH_END_MS = Date.parse("2026-08-21T14:03:00.000Z");
const CONTRACT_MULTIPLIER = 100;
// Trinity's default `firstColumn` view requests the nearest expiration only.
const TRINITY_EXPIRATION_COUNT = 1;

const EXPIRATIONS_BY_TICKER = new Map();
const EXPIRATION_REQUESTS_BY_TICKER = new Map();

let TARGETS = {
  SPX: {
    label: "SPXW",
    spot: 7666.85,
    values: new Map([
      [7680, 21_915_800],
      [7675, -8_570_200],
      [7670, -1_731_800],
      [7665, -2_869_800],
      [7640, 11_647_200],
      [7610, 6_657_800],
    ]),
  },
  SPY: {
    label: "SPY",
    spot: 764.8,
    values: new Map([
      [775, -39_850_900],
      [770, 18_823_900],
      [768, 52_168_300],
      [767, 24_747_000],
      [766, -80_040_300],
      [765, -21_425_300],
      [764, 88_360_400],
      [763, 43_349_200],
      [762, 52_967_900],
      [761, 49_738_700],
      [760, 215_060_800],
    ]),
  },
  QQQ: {
    label: "QQQ",
    spot: 711.46,
    values: new Map([
      [717, -52_525_000],
      [716, -36_899_100],
      [715, 10_954_000],
      [714, 24_884_900],
      [713, 10_874_000],
      [712, -37_668_400],
      [711, -16_518_800],
      [710, -18_047_000],
      [709, -59_811_800],
      [708, -83_276_100],
      [700, 29_156_700],
    ]),
  },
};

let TRINITY_STATE_HISTORY = {
  SPX: {
    label: "SPXW",
    values: new Map([
      [7680, new Map([
        [Date.parse("2026-08-21T13:30:00.000Z"), 3_739_800],
        [Date.parse("2026-08-21T13:45:00.000Z"), 10_466_400],
        [Date.parse("2026-08-21T14:00:00.000Z"), 21_915_800],
      ])],
      [7675, new Map([
        [Date.parse("2026-08-21T13:30:00.000Z"), -6_526_300],
        [Date.parse("2026-08-21T13:45:00.000Z"), -8_369_900],
        [Date.parse("2026-08-21T14:00:00.000Z"), -8_570_200],
      ])],
    ]),
  },
  SPY: {
    label: "SPY",
    values: new Map([
      [760, new Map([
        [Date.parse("2026-08-21T13:30:00.000Z"), 173_033_700],
        [Date.parse("2026-08-21T13:45:00.000Z"), 196_831_600],
        [Date.parse("2026-08-21T14:00:00.000Z"), 215_060_800],
      ])],
      [766, new Map([
        [Date.parse("2026-08-21T13:30:00.000Z"), -87_257_500],
        [Date.parse("2026-08-21T13:45:00.000Z"), -114_703_900],
        [Date.parse("2026-08-21T14:00:00.000Z"), -80_040_300],
      ])],
      [768, new Map([
        [Date.parse("2026-08-21T13:30:00.000Z"), -21_061_900],
        [Date.parse("2026-08-21T13:45:00.000Z"), 55_602_400],
        [Date.parse("2026-08-21T14:00:00.000Z"), 52_168_300],
      ])],
    ]),
  },
  QQQ: {
    label: "QQQ",
    values: new Map([
      [708, new Map([
        [Date.parse("2026-08-21T13:30:00.000Z"), -46_027_400],
        [Date.parse("2026-08-21T13:45:00.000Z"), -74_590_800],
        [Date.parse("2026-08-21T14:00:00.000Z"), -83_276_100],
      ])],
      [714, new Map([
        [Date.parse("2026-08-21T13:30:00.000Z"), 14_340_600],
        [Date.parse("2026-08-21T13:45:00.000Z"), 18_160_400],
        [Date.parse("2026-08-21T14:00:00.000Z"), 24_884_900],
      ])],
    ]),
  },
};

const SIDE_RULES = {
  customerDirectional: { CB: 1, CS: -1, PB: -1, PS: 1, CM: 0, PM: 0 },
  dealerDirectional: { CB: -1, CS: 1, PB: 1, PS: -1, CM: 0, PM: 0 },
  dealerGammaInventory: { CB: -1, CS: 1, PB: -1, PS: 1, CM: 0, PM: 0 },
  customerGammaInventory: { CB: 1, CS: -1, PB: 1, PS: -1, CM: 0, PM: 0 },
  callMinusPut: { CB: 1, CS: 1, PB: -1, PS: -1, CM: 1, PM: -1 },
  putMinusCall: { CB: -1, CS: -1, PB: 1, PS: 1, CM: -1, PM: 1 },
  customerBuyMinusSell: { CB: 1, CS: -1, PB: 1, PS: -1, CM: 0, PM: 0 },
  dealerBuyMinusSell: { CB: -1, CS: 1, PB: -1, PS: 1, CM: 0, PM: 0 },
  bullishOnly: { CB: 1, CS: 0, PB: 0, PS: 1, CM: 0, PM: 0 },
  bearishOnly: { CB: 0, CS: -1, PB: -1, PS: 0, CM: 0, PM: 0 },
  allClassified: { CB: 1, CS: 1, PB: 1, PS: 1, CM: 0, PM: 0 },
  allVolume: { CB: 1, CS: 1, PB: 1, PS: 1, CM: 1, PM: 1 },
};

const CUTOFFS = Array.from({ length: 15 }, (_, index) => Date.parse("2026-08-21T13:56:00.000Z") + index * 30_000);
const WINDOWS = [
  { label: "SESSION", milliseconds: null },
  { label: "30m", milliseconds: 30 * 60_000 },
  { label: "20m", milliseconds: 20 * 60_000 },
  { label: "15m", milliseconds: 15 * 60_000 },
  { label: "10m", milliseconds: 10 * 60_000 },
  { label: "5m", milliseconds: 5 * 60_000 },
  { label: "2m", milliseconds: 2 * 60_000 },
];

function readDotEnv(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    values[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

const env = { ...readDotEnv(path.resolve(process.cwd(), ".env.local")), ...process.env };
const SUMMARY_ONLY = env.OPRA_REVERSE_ENGINEER_SUMMARY_ONLY === "1";

function loadFullTrinityLattices(filePath, openingFilePath) {
  if (!filePath) return;
  const payload = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
  const snapshots = payload?.targets;
  if (!snapshots?.["930"] || !snapshots?.["945"] || !snapshots?.["1000"]) {
    throw new Error("TRINITY_FULL_LATTICES must contain 930, 945 and 1000 target snapshots.");
  }

  const timestampByKey = {
    400: Date.parse(`${SESSION_DATE}T08:00:00.000Z`),
    930: Date.parse(`${SESSION_DATE}T13:30:00.000Z`),
    945: Date.parse(`${SESSION_DATE}T13:45:00.000Z`),
    1000: Date.parse(`${SESSION_DATE}T14:00:00.000Z`),
  };
  const openingPayload = openingFilePath
    ? JSON.parse(fs.readFileSync(path.resolve(openingFilePath), "utf8"))
    : null;
  if (openingPayload?.targets) {
    snapshots["400"] = Object.fromEntries(Object.entries(openingPayload.targets).map(([ticker, rows]) => [
      ticker,
      rows.map(([strike, value]) => ({ strike, value })),
    ]));
  }
  const snapshotKeys = snapshots["400"] ? ["400", "930", "945", "1000"] : ["930", "945", "1000"];
  const metadata = {
    SPX: { label: "SPXW", spot: 7666.85 },
    SPY: { label: "SPY", spot: 764.8 },
    QQQ: { label: "QQQ", spot: 711.46 },
  };

  TARGETS = {};
  TRINITY_STATE_HISTORY = {};
  for (const [ticker, meta] of Object.entries(metadata)) {
    const latestRows = snapshots["1000"][ticker] ?? [];
    TARGETS[ticker] = {
      ...meta,
      values: new Map(latestRows.map((row) => [Number(row.strike), Number(row.value)])),
    };

    const observationsByStrike = new Map();
    for (const key of snapshotKeys) {
      for (const row of snapshots[key][ticker] ?? []) {
        const strike = Number(row.strike);
        const observations = observationsByStrike.get(strike) ?? new Map();
        observations.set(timestampByKey[key], Number(row.value));
        observationsByStrike.set(strike, observations);
      }
    }
    TRINITY_STATE_HISTORY[ticker] = {
      label: meta.label,
      values: new Map([...observationsByStrike].filter(([, observations]) => observations.size >= 2)),
    };
  }
}

loadFullTrinityLattices(env.TRINITY_FULL_LATTICES, env.TRINITY_OPENING_LATTICE);

function loadExtraTrinityLattices(filePath) {
  if (!filePath) return;
  const payload = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
  const tickerByLabel = { SPXW: "SPX", SPY: "SPY", QQQ: "QQQ" };
  for (const [timestampText, panels] of Object.entries(payload)) {
    const timestamp = Date.parse(timestampText);
    if (!Number.isFinite(timestamp)) continue;
    for (const [label, panel] of Object.entries(panels ?? {})) {
      const ticker = tickerByLabel[label];
      if (!ticker || !TRINITY_STATE_HISTORY[ticker]) continue;
      for (const [strikeText, value] of Object.entries(panel?.values ?? {})) {
        const strike = Number(strikeText);
        const observations = TRINITY_STATE_HISTORY[ticker].values.get(strike) ?? new Map();
        observations.set(timestamp, Number(value));
        TRINITY_STATE_HISTORY[ticker].values.set(strike, observations);
      }
    }
  }
}

loadExtraTrinityLattices(env.TRINITY_EXTRA_LATTICES);
const gatewayUrl = String(env.KWANTIFY_MARKET_DATA_GATEWAY_URL || "").replace(/\/$/, "");
const gatewayToken = String(env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN || "");
if (!gatewayUrl || !gatewayToken) throw new Error("The VPS market-data gateway is not configured.");

let nextQuantDataRequestAt = 0;

async function waitForQuantDataSlot() {
  const scheduledAt = Math.max(Date.now(), nextQuantDataRequestAt);
  nextQuantDataRequestAt = scheduledAt + 275;
  const waitMs = scheduledAt - Date.now();
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
}

async function quantDataPost(endpoint, body) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await waitForQuantDataSlot();
    const response = await fetch(`${gatewayUrl}/v1/vendors/quantdata/v1${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${gatewayToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload;
    if (response.status === 429 && attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt));
      continue;
    }
    throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(payload)}`);
  }
  throw new Error(`${endpoint} exhausted its retry budget.`);
}

function numberAt(row, ...keys) {
  for (const key of keys) {
    const parts = key.split(".");
    let value = row;
    for (const part of parts) value = value && typeof value === "object" ? value[part] : undefined;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function textAt(row, ...keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function timestampAt(row) {
  const raw = row?.tradeTime ?? row?.timestamp ?? row?.tsEvent ?? row?.time;
  if (typeof raw === "string" && !/^\d+(\.\d+)?$/.test(raw.trim())) return Date.parse(raw);
  let value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  if (value > 10_000_000_000_000_000) value /= 1_000_000;
  else if (value > 10_000_000_000_000) value /= 1_000;
  else if (value > 0 && value < 10_000_000_000) value *= 1_000;
  return Math.round(value);
}

function optionTypeAt(row) {
  const value = textAt(row, "contractType", "optionType", "putCall").toUpperCase();
  if (value.includes("CALL") || value === "C") return "CALL";
  if (value.includes("PUT") || value === "P") return "PUT";
  return "UNKNOWN";
}

function sideAt(row) {
  const provider = textAt(row, "tradeSideCode", "tradeSide", "side").toUpperCase();
  if (provider.includes("ABOVE_ASK")) return "BUY";
  if (provider.includes("BELOW_BID")) return "SELL";
  if (provider.includes("ASK") || provider === "A" || provider === "AA") return "BUY";
  if (provider.includes("BID") || provider === "B" || provider === "BB") return "SELL";
  if (provider.includes("MID")) return "MID";
  const fill = numberAt(row, "optionPrice", "fillPrice", "averagePrice", "price");
  const bid = numberAt(row, "bidPrice", "bid", "bestBid");
  const ask = numberAt(row, "askPrice", "ask", "bestAsk");
  if (fill !== null && bid !== null && ask !== null) {
    if (fill >= ask) return "BUY";
    if (fill <= bid) return "SELL";
    return "MID";
  }
  return "UNKNOWN";
}

function normalizeTrade(row, source) {
  const type = optionTypeAt(row);
  const side = sideAt(row);
  const size = Math.max(0, numberAt(row, "size", "quantity", "contracts", "totalSize") ?? 0);
  const fill = numberAt(row, "optionPrice", "fillPrice", "averagePrice", "price") ?? 0;
  const premium = numberAt(row, "premium", "notionalValue") ?? fill * size * CONTRACT_MULTIPLIER;
  const gamma = numberAt(row, "gamma", "greeks.gamma") ?? 0;
  const delta = numberAt(row, "delta", "greeks.delta") ?? 0;
  const vega = numberAt(row, "vega", "greeks.vega") ?? 0;
  const volume = Math.max(0, numberAt(row, "volume", "contractVolume", "sessionVolume") ?? 0);
  const openInterest = Math.max(0, numberAt(row, "openInterest", "oi") ?? 0);
  const previousOpenInterest = Math.max(0, numberAt(row, "previousOpenInterest", "priorOpenInterest", "previousOi") ?? 0);
  const deltaOpenInterest = numberAt(row, "openInterestChange", "deltaOpenInterest", "deltaOi", "deltaOI", "oiChange")
    ?? (openInterest > 0 && previousOpenInterest > 0 ? openInterest - previousOpenInterest : 0);
  const strike = numberAt(row, "strikePrice", "strike");
  const stockPrice = numberAt(row, "stockPrice", "underlyingPrice", "spotPrice");
  const consolidation = textAt(row, "tradeConsolidationType", "consolidationType", "tradeType").toUpperCase();
  const tradeType = textAt(row, "tradeType", "executionType").toUpperCase();
  const strategy = textAt(row, "strategy", "strategyType", "detectedStrategy");
  const parentTradeType = textAt(row, "parentTradeType").toUpperCase();
  const multiLeg = row?.isMultiLeg === true
    || row?.multiLeg === true
    || row?.complexTrade === true
    || Boolean(strategy)
    || tradeType.includes("MULTI_")
    || tradeType.includes("_COB")
    || parentTradeType.includes("MULTI_")
    || parentTradeType.includes("_COB");
  const opening = row?.isOpeningPosition === true || row?.opening === true;
  const unusual = row?.isUnusual === true || row?.unusual === true;
  const goldenSweep = row?.isGoldenSweep === true || row?.goldenSweep === true;
  const volumeGreaterThanOpenInterest = row?.isVolumeGreaterThanOpenInterest === true
    || row?.volumeGreaterThanOpenInterest === true;
  const impliedVolatility = numberAt(row, "impliedVolatility", "iv", "greeks.impliedVolatility") ?? 0;
  const bid = numberAt(row, "bidPrice", "bid", "bestBid") ?? 0;
  const ask = numberAt(row, "askPrice", "ask", "bestAsk") ?? 0;
  const bidAskSpread = numberAt(row, "bidAskSpread", "spread") ?? Math.max(0, ask - bid);
  const spreadPosition = ask > bid
    ? Math.max(-1, Math.min(2, (fill - bid) / (ask - bid)))
    : side === "BUY" ? 1 : side === "SELL" ? 0 : 0.5;
  const bucket = type === "CALL"
    ? side === "BUY" ? "CB" : side === "SELL" ? "CS" : "CM"
    : type === "PUT"
      ? side === "BUY" ? "PB" : side === "SELL" ? "PS" : "PM"
      : "UNKNOWN";
  return {
    id: textAt(row, "id", "tradeId", "eventId") || `${source}:${timestampAt(row)}:${strike}:${type}:${size}:${fill}`,
    source,
    timestamp: timestampAt(row),
    expirationDate: textAt(row, "expirationDate", "expiration", "expiry"),
    strike,
    type,
    side,
    bucket,
    size,
    fill,
    premium,
    gamma,
    delta,
    vega,
    volume,
    openInterest,
    previousOpenInterest,
    deltaOpenInterest,
    osi: textAt(row, "osi", "optionSymbol", "contractSymbol", "instrumentId"),
    sentiment: textAt(row, "sentimentType", "sentiment", "direction").toUpperCase(),
    stockPrice,
    opening,
    multiLeg,
    consolidation,
    tradeType,
    unusual,
    goldenSweep,
    volumeGreaterThanOpenInterest,
    impliedVolatility,
    bid,
    ask,
    bidAskSpread,
    spreadPosition,
    exchange: textAt(row, "exchange", "marketCenter").toUpperCase(),
    moneyness: (typeof row?.moneyness === "string" ? row.moneyness : row?.moneyness?.moneyType ?? "").toUpperCase(),
  };
}

async function getTrinityExpirations(ticker) {
  const cached = EXPIRATIONS_BY_TICKER.get(ticker);
  if (cached?.length) return cached;
  const pending = EXPIRATION_REQUESTS_BY_TICKER.get(ticker);
  if (pending) return pending;
  const request = (async () => {
    const payload = await quantDataPost("/options/tool/exposure-by-strike", {
      sessionDate: SESSION_DATE,
      greekMode: "GAMMA",
      representationMode: "PER_ONE_PERCENT_MOVE",
      filter: { ticker },
    });
    const exposureMap = payload?.data?.[ticker]?.exposureMap;
    const expirations = exposureMap && typeof exposureMap === "object"
      ? Object.keys(exposureMap)
        .filter((expiration) => expiration >= SESSION_DATE)
        .sort()
        .slice(0, TRINITY_EXPIRATION_COUNT)
      : [];
    if (!expirations.length) throw new Error(`No expirations were returned for ${ticker} on ${SESSION_DATE}.`);
    console.log(`Using Trinity's first ${expirations.length} expirations for ${ticker}: ${expirations.join(", ")}`);
    EXPIRATIONS_BY_TICKER.set(ticker, expirations);
    return expirations;
  })();
  EXPIRATION_REQUESTS_BY_TICKER.set(ticker, request);
  return request;
}

async function walkStrikeTape(endpoint, ticker, strike, includeComprisingTrades = false) {
  const rows = [];
  await getTrinityExpirations(ticker);
  let searchAfter;
  for (let page = 0; page < 40; page += 1) {
    const body = {
      timeRange: { startTime: new Date(OPRA_FETCH_START_MS).toISOString(), endTime: new Date(FETCH_END_MS).toISOString() },
      filter: { ticker, strikePrice: strike },
      size: 100,
      sort: { field: "tradeTime", direction: "ASCENDING" },
      ...(includeComprisingTrades ? { includeComprisingTrades: true } : {}),
    };
    if (searchAfter?.length) body.searchAfter = searchAfter;
    const payload = await quantDataPost(endpoint, body);
    if (Array.isArray(payload?.data)) rows.push(...payload.data);
    searchAfter = Array.isArray(payload?.nextSearchAfter) ? payload.nextSearchAfter : null;
    if (!searchAfter?.length) break;
  }
  return rows;
}

async function mapWithConcurrency(items, concurrency, task) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function comprisingRows(parents) {
  return parents.flatMap((parent, parentIndex) => Array.isArray(parent?.comprisingTrades)
    ? parent.comprisingTrades.map((child, childIndex) => ({
      ...parent,
      ...child,
      parentTradeType: textAt(parent, "tradeType", "executionType"),
      parentTradeConsolidationType: textAt(parent, "tradeConsolidationType", "consolidationType"),
      id: textAt(child, "id", "tradeId", "eventId") || `${textAt(parent, "id", "tradeId", "eventId") || parentIndex}:child:${childIndex}`,
      comprisingTrades: undefined,
    }))
    : []);
}

function dedupe(rows, source, ticker) {
  const expirationSet = new Set(EXPIRATIONS_BY_TICKER.get(ticker) ?? [SESSION_DATE]);
  const normalized = rows
    .map((row) => normalizeTrade(row, source))
    .filter((row) => expirationSet.has(row.expirationDate) && Number.isFinite(row.strike) && row.type !== "UNKNOWN" && row.size > 0 && row.timestamp > 0);
  return [...new Map(normalized.map((row) => [row.id, row])).values()].sort((left, right) => left.timestamp - right.timestamp);
}

function valueBasis(trade, basis, configuredSpot) {
  const spot = trade.stockPrice && trade.stockPrice > 0 ? trade.stockPrice : configuredSpot;
  if (basis === "contracts") return trade.size;
  if (basis === "premium") return trade.premium;
  if (basis === "gammaContracts") return trade.gamma * trade.size;
  if (basis === "gammaPerShare") return trade.gamma * trade.size * CONTRACT_MULTIPLIER;
  if (basis === "gammaDollar") return trade.gamma * trade.size * CONTRACT_MULTIPLIER * spot;
  if (basis === "gammaOnePercent") return trade.gamma * trade.size * CONTRACT_MULTIPLIER * spot * spot * 0.01;
  if (basis === "gammaStrikeOnePercent") return trade.gamma * trade.size * CONTRACT_MULTIPLIER * trade.strike * trade.strike * 0.01;
  if (basis === "deltaNotional") return Math.abs(trade.delta) * trade.size * CONTRACT_MULTIPLIER * spot;
  if (basis === "signedDeltaNotional") return trade.delta * trade.size * CONTRACT_MULTIPLIER * spot;
  if (basis === "gammaPremium") return trade.gamma * trade.premium;
  if (basis === "vegaNotional") return Math.abs(trade.vega) * trade.size * CONTRACT_MULTIPLIER;
  return 0;
}

const BASES = [
  "contracts",
  "premium",
  "gammaContracts",
  "gammaPerShare",
  "gammaDollar",
  "gammaOnePercent",
  "gammaStrikeOnePercent",
  "deltaNotional",
  "signedDeltaNotional",
  "gammaPremium",
  "vegaNotional",
];

const FILTERS = {
  all: () => true,
  simple: (trade) => !trade.multiLeg,
  opening: (trade) => trade.opening,
  simpleOpening: (trade) => !trade.multiLeg && trade.opening,
  classified: (trade) => trade.side !== "MID" && trade.side !== "UNKNOWN",
  simpleClassified: (trade) => !trade.multiLeg && trade.side !== "MID" && trade.side !== "UNKNOWN",
};

function oneFactorFit(rows, key) {
  const numerator = rows.reduce((sum, row) => sum + row[key] * row.target, 0);
  const denominator = rows.reduce((sum, row) => sum + row[key] * row[key], 0);
  const scale = denominator ? numerator / denominator : 0;
  const residuals = rows.map((row) => row.target - scale * row[key]);
  const rmse = Math.sqrt(residuals.reduce((sum, value) => sum + value * value, 0) / Math.max(1, residuals.length));
  const mean = rows.reduce((sum, row) => sum + row.target, 0) / Math.max(1, rows.length);
  const total = rows.reduce((sum, row) => sum + (row.target - mean) ** 2, 0);
  const residual = residuals.reduce((sum, value) => sum + value * value, 0);
  const signAccuracy = rows.filter((row) => Math.sign(row.target) === Math.sign(scale * row[key])).length / Math.max(1, rows.length);
  return { scale, rmse, r2: total ? 1 - residual / total : 0, signAccuracy };
}

function holdoutRmse(rows, key) {
  const symbols = [...new Set(rows.map((row) => row.ticker))];
  let squared = 0;
  let count = 0;
  for (const symbol of symbols) {
    const train = rows.filter((row) => row.ticker !== symbol);
    const test = rows.filter((row) => row.ticker === symbol);
    const { scale } = oneFactorFit(train, key);
    for (const row of test) {
      squared += (row.target - scale * row[key]) ** 2;
      count += 1;
    }
  }
  return Math.sqrt(squared / Math.max(1, count));
}

const EXECUTION_BUCKETS = ["CB", "CS", "PB", "PS", "CM", "PM"];

function metrics(rows, predictions) {
  const residuals = rows.map((row, index) => row.target - predictions[index]);
  const rmse = Math.sqrt(residuals.reduce((sum, value) => sum + value * value, 0) / Math.max(1, rows.length));
  const mean = rows.reduce((sum, row) => sum + row.target, 0) / Math.max(1, rows.length);
  const total = rows.reduce((sum, row) => sum + (row.target - mean) ** 2, 0);
  const residual = residuals.reduce((sum, value) => sum + value * value, 0);
  const signAccuracy = rows.filter((row, index) => Math.sign(row.target) === Math.sign(predictions[index])).length / Math.max(1, rows.length);
  return { rmse, r2: total ? 1 - residual / total : 0, signAccuracy };
}

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-18) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let cell = column; cell <= size; cell += 1) augmented[column][cell] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let cell = column; cell <= size; cell += 1) augmented[row][cell] -= factor * augmented[column][cell];
    }
  }
  return augmented.map((row) => row[size]);
}

function multiFactorFit(rows, featureKey = "features") {
  if (!rows.length) return null;
  const featureCount = rows[0][featureKey].length;
  const scales = Array.from({ length: featureCount }, (_, column) => {
    const magnitude = Math.sqrt(rows.reduce((sum, row) => sum + row[featureKey][column] ** 2, 0) / Math.max(1, rows.length));
    return magnitude > 0 ? magnitude : 1;
  });
  const normalized = rows.map((row) => row[featureKey].map((value, column) => value / scales[column]));
  const matrix = Array.from({ length: featureCount }, () => Array(featureCount).fill(0));
  const vector = Array(featureCount).fill(0);
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    for (let left = 0; left < featureCount; left += 1) {
      vector[left] += normalized[rowIndex][left] * rows[rowIndex].target;
      for (let right = 0; right < featureCount; right += 1) {
        matrix[left][right] += normalized[rowIndex][left] * normalized[rowIndex][right];
      }
    }
  }
  const trace = matrix.reduce((sum, row, index) => sum + row[index], 0);
  const ridge = Math.max(1e-9, trace * 1e-8 / Math.max(1, featureCount));
  for (let index = 0; index < featureCount; index += 1) matrix[index][index] += ridge;
  const normalizedWeights = solveLinearSystem(matrix, vector);
  if (!normalizedWeights) return null;
  const weights = normalizedWeights.map((value, column) => value / scales[column]);
  const predictions = rows.map((row) => row[featureKey].reduce((sum, value, column) => sum + value * weights[column], 0));
  return { weights, predictions, ...metrics(rows, predictions) };
}

function multiFactorHoldoutRmse(rows) {
  const symbols = [...new Set(rows.map((row) => row.ticker))];
  let squared = 0;
  let count = 0;
  for (const symbol of symbols) {
    const train = rows.filter((row) => row.ticker !== symbol);
    const test = rows.filter((row) => row.ticker === symbol);
    const fit = multiFactorFit(train);
    if (!fit) return Number.POSITIVE_INFINITY;
    for (const row of test) {
      const predicted = row.features.reduce((sum, value, index) => sum + value * fit.weights[index], 0);
      squared += (row.target - predicted) ** 2;
      count += 1;
    }
  }
  return Math.sqrt(squared / Math.max(1, count));
}

function dynamicStateMetrics(rows, predictions) {
  const base = metrics(rows.map((row) => ({ target: row.current })), predictions);
  const directionAccuracy = rows.filter((row, index) => (
    Math.sign(row.current - row.prior) === Math.sign(predictions[index] - row.prior)
  )).length / Math.max(1, rows.length);
  return { ...base, directionAccuracy };
}

function fitDynamicState(rows, rho) {
  const adjusted = rows.map((row) => ({ ...row, target: row.current - rho * row.prior }));
  const fit = multiFactorFit(adjusted);
  if (!fit) return null;
  const predictions = rows.map((row) => rho * row.prior
    + row.features.reduce((sum, value, index) => sum + value * fit.weights[index], 0));
  return { rho, weights: fit.weights, predictions, ...dynamicStateMetrics(rows, predictions) };
}

function dynamicStateNestedHoldout(rows) {
  const symbols = [...new Set(rows.map((row) => row.ticker))];
  const predictions = [];
  const testRows = [];
  for (const symbol of symbols) {
    const train = rows.filter((row) => row.ticker !== symbol);
    const test = rows.filter((row) => row.ticker === symbol);
    let bestFit = null;
    for (let step = 0; step <= 200; step += 1) {
      const fit = fitDynamicState(train, step / 100);
      if (!fit) continue;
      if (!bestFit || fit.rmse < bestFit.rmse) bestFit = fit;
    }
    if (!bestFit) return { rmse: Number.POSITIVE_INFINITY, directionAccuracy: 0 };
    for (const row of test) {
      predictions.push(bestFit.rho * row.prior
        + row.features.reduce((sum, value, index) => sum + value * bestFit.weights[index], 0));
      testRows.push(row);
    }
  }
  const result = dynamicStateMetrics(testRows, predictions);
  return { rmse: result.rmse, directionAccuracy: result.directionAccuracy };
}

function dynamicCarryHoldout(rows) {
  const symbols = [...new Set(rows.map((row) => row.ticker))];
  const predictions = [];
  const testRows = [];
  for (const symbol of symbols) {
    const train = rows.filter((row) => row.ticker !== symbol);
    const test = rows.filter((row) => row.ticker === symbol);
    const fit = oneFactorFit(
      train.map((row) => ({ target: row.current, prior: row.prior })),
      "prior",
    );
    if (!Number.isFinite(fit.scale)) {
      return { rmse: Number.POSITIVE_INFINITY, directionAccuracy: 0 };
    }
    for (const row of test) {
      predictions.push(fit.scale * row.prior);
      testRows.push(row);
    }
  }
  const result = dynamicStateMetrics(testRows, predictions);
  return { rmse: result.rmse, directionAccuracy: result.directionAccuracy };
}

function gammaUnitAt(tape, timestamp, type, configuredSpot) {
  const candidates = tape.filter((trade) => trade.type === type && trade.gamma > 0);
  if (!candidates.length) return null;
  let selected = null;
  for (const trade of candidates) {
    if (trade.timestamp <= timestamp) selected = trade;
    else break;
  }
  // At the 09:30 boundary there may be no print at or before the exact second.
  // The first subsequent print is the least-assumptive estimate of that surface.
  if (!selected) selected = candidates[0];
  const spot = selected.stockPrice && selected.stockPrice > 0 ? selected.stockPrice : configuredSpot;
  return selected.gamma * CONTRACT_MULTIPLIER * spot * spot * 0.01;
}

function repricingFeatures(tape, priorTime, currentTime, configuredSpot, priorValue) {
  const priorCall = gammaUnitAt(tape, priorTime, "CALL", configuredSpot);
  const currentCall = gammaUnitAt(tape, currentTime, "CALL", configuredSpot);
  const priorPut = gammaUnitAt(tape, priorTime, "PUT", configuredSpot);
  const currentPut = gammaUnitAt(tape, currentTime, "PUT", configuredSpot);
  const callRatio = priorCall && currentCall ? currentCall / priorCall : 1;
  const putRatio = priorPut && currentPut ? currentPut / priorPut : 1;
  const grossPrior = (priorCall ?? 0) + (priorPut ?? 0);
  const grossCurrent = (currentCall ?? 0) + (currentPut ?? 0);
  const grossRatio = grossPrior > 0 && grossCurrent > 0 ? grossCurrent / grossPrior : 1;
  return {
    priorCallRepriced: priorValue * callRatio,
    priorPutRepriced: priorValue * putRatio,
    priorGrossRepriced: priorValue * grossRatio,
    callRatio,
    putRatio,
    grossRatio,
  };
}

function propagatedBucketFeatures(tape, timestamps, endIndex, configuredSpot, model) {
  const currentTime = timestamps[endIndex];
  const currentCall = gammaUnitAt(tape, currentTime, "CALL", configuredSpot);
  const currentPut = gammaUnitAt(tape, currentTime, "PUT", configuredSpot);
  const totals = Object.fromEntries(model.buckets.map((bucket) => [bucket, 0]));
  for (let intervalIndex = 1; intervalIndex <= endIndex; intervalIndex += 1) {
    const priorTime = timestamps[intervalIndex - 1];
    const intervalTime = timestamps[intervalIndex];
    const intervalCall = gammaUnitAt(tape, intervalTime, "CALL", configuredSpot);
    const intervalPut = gammaUnitAt(tape, intervalTime, "PUT", configuredSpot);
    const callCarry = currentCall && intervalCall ? currentCall / intervalCall : 1;
    const putCarry = currentPut && intervalPut ? currentPut / intervalPut : 1;
    for (const trade of tape) {
      if (trade.timestamp <= priorTime || trade.timestamp > intervalTime || !model.filter(trade)) continue;
      if (!Object.hasOwn(totals, trade.bucket)) continue;
      const carry = trade.type === "CALL" ? callCarry : putCarry;
      totals[trade.bucket] += valueBasis(trade, model.basis, configuredSpot) * carry;
    }
  }
  return model.buckets.map((bucket) => totals[bucket]);
}

function buildLatentSplitRows(source, model) {
  const rowSpecs = [];
  const strikeKeys = [];
  for (const [ticker, history] of Object.entries(TRINITY_STATE_HISTORY)) {
    const configuredSpot = TARGETS[ticker].spot;
    for (const [strike, observations] of history.values) {
      const timestamps = [...observations.keys()].sort((left, right) => left - right);
      if (timestamps.length < 2) continue;
      const tape = indexedRows.get(`${ticker}:${source}:${strike}`) ?? [];
      const firstTime = timestamps[0];
      const firstValue = observations.get(firstTime);
      const firstCall = gammaUnitAt(tape, firstTime, "CALL", configuredSpot);
      const firstPut = gammaUnitAt(tape, firstTime, "PUT", configuredSpot);
      const strikeKey = `${history.label}:${strike}`;
      strikeKeys.push(strikeKey);
      for (let endIndex = 1; endIndex < timestamps.length; endIndex += 1) {
        const currentTime = timestamps[endIndex];
        const currentCall = gammaUnitAt(tape, currentTime, "CALL", configuredSpot);
        const currentPut = gammaUnitAt(tape, currentTime, "PUT", configuredSpot);
        const callCarry = firstCall && currentCall ? currentCall / firstCall : 1;
        const putCarry = firstPut && currentPut ? currentPut / firstPut : 1;
        const basePutCarry = firstValue * putCarry;
        rowSpecs.push({
          ticker: history.label,
          strike,
          strikeKey,
          priorTime: timestamps[endIndex - 1],
          currentTime,
          prior: observations.get(timestamps[endIndex - 1]),
          current: observations.get(currentTime),
          basePutCarry,
          splitSensitivity: firstValue * (callCarry - putCarry),
          bucketFeatures: propagatedBucketFeatures(tape, timestamps, endIndex, configuredSpot, model),
        });
      }
    }
  }
  const uniqueStrikeKeys = [...new Set(strikeKeys)];
  const strikeIndex = new Map(uniqueStrikeKeys.map((key, index) => [key, index]));
  return {
    strikeKeys: uniqueStrikeKeys,
    rows: rowSpecs.map((row) => ({
      ...row,
      target: row.current - row.basePutCarry,
      features: [
        ...uniqueStrikeKeys.map((_, index) => index === strikeIndex.get(row.strikeKey) ? row.splitSensitivity : 0),
        ...row.bucketFeatures,
      ],
    })),
  };
}

function latentSplitMetrics(rows, fit) {
  const predictions = rows.map((row) => row.basePutCarry
    + row.features.reduce((sum, value, index) => sum + value * fit.weights[index], 0));
  return { predictions, ...dynamicStateMetrics(rows, predictions) };
}

function fitLatentSplitState(rows) {
  const fit = multiFactorFit(rows);
  if (!fit) return null;
  return { weights: fit.weights, ...latentSplitMetrics(rows, fit) };
}

function latentSplitTimeHoldout(rows) {
  const latestTime = Math.max(...rows.map((row) => row.currentTime));
  const train = rows.filter((row) => row.currentTime < latestTime);
  const test = rows.filter((row) => row.currentTime === latestTime);
  const fit = fitLatentSplitState(train);
  if (!fit || !test.length) {
    return { timestamp: latestTime, count: test.length, rmse: Number.POSITIVE_INFINITY, directionAccuracy: 0 };
  }
  const evaluated = latentSplitMetrics(test, fit);
  return {
    timestamp: latestTime,
    count: test.length,
    weights: fit.weights,
    predictions: evaluated.predictions,
    rmse: evaluated.rmse,
    r2: evaluated.r2,
    signAccuracy: evaluated.signAccuracy,
    directionAccuracy: evaluated.directionAccuracy,
  };
}

function fitDirectDynamicState(rows) {
  const adjusted = rows.map((row) => ({ ...row, target: row.current }));
  const fit = multiFactorFit(adjusted);
  if (!fit) return null;
  const predictions = rows.map((row) => row.features.reduce((sum, value, index) => sum + value * fit.weights[index], 0));
  return { weights: fit.weights, predictions, ...dynamicStateMetrics(rows, predictions) };
}

function directDynamicStateHoldout(rows) {
  const predictions = [];
  const testRows = [];
  for (const symbol of [...new Set(rows.map((row) => row.ticker))]) {
    const train = rows.filter((row) => row.ticker !== symbol);
    const test = rows.filter((row) => row.ticker === symbol);
    const fit = fitDirectDynamicState(train);
    if (!fit) return { rmse: Number.POSITIVE_INFINITY, directionAccuracy: 0 };
    for (const row of test) {
      predictions.push(row.features.reduce((sum, value, index) => sum + value * fit.weights[index], 0));
      testRows.push(row);
    }
  }
  const result = dynamicStateMetrics(testRows, predictions);
  return { rmse: result.rmse, directionAccuracy: result.directionAccuracy };
}

function directDynamicTimeHoldout(rows) {
  const latestTime = Math.max(...rows.map((row) => row.currentTime));
  const train = rows.filter((row) => row.currentTime < latestTime);
  const test = rows.filter((row) => row.currentTime === latestTime);
  const fit = fitDirectDynamicState(train);
  if (!fit || !test.length) {
    return { timestamp: latestTime, count: test.length, rmse: Number.POSITIVE_INFINITY, directionAccuracy: 0 };
  }
  const predictions = test.map((row) => row.features.reduce((sum, value, index) => sum + value * fit.weights[index], 0));
  const result = dynamicStateMetrics(test, predictions);
  return {
    timestamp: latestTime,
    count: test.length,
    rmse: result.rmse,
    directionAccuracy: result.directionAccuracy,
    weights: fit.weights,
  };
}

function multiFactorFitWithRidge(rows, ridgeFactor = 1) {
  if (!rows.length) return null;
  const featureCount = rows[0].features.length;
  const scales = Array.from({ length: featureCount }, (_, column) => {
    const magnitude = Math.sqrt(rows.reduce((sum, row) => sum + row.features[column] ** 2, 0) / Math.max(1, rows.length));
    return magnitude > 0 ? magnitude : 1;
  });
  const normalized = rows.map((row) => row.features.map((value, column) => value / scales[column]));
  const matrix = Array.from({ length: featureCount }, () => Array(featureCount).fill(0));
  const vector = Array(featureCount).fill(0);
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    for (let left = 0; left < featureCount; left += 1) {
      vector[left] += normalized[rowIndex][left] * rows[rowIndex].current;
      for (let right = 0; right < featureCount; right += 1) {
        matrix[left][right] += normalized[rowIndex][left] * normalized[rowIndex][right];
      }
    }
  }
  for (let index = 0; index < featureCount; index += 1) matrix[index][index] += ridgeFactor;
  const normalizedWeights = solveLinearSystem(matrix, vector);
  if (!normalizedWeights) return null;
  const weights = normalizedWeights.map((value, column) => value / scales[column]);
  const predictions = rows.map((row) => row.features.reduce((sum, value, column) => sum + value * weights[column], 0));
  return { weights, predictions, ...dynamicStateMetrics(rows, predictions) };
}

const ENHANCED_FLOW_GROUPS = {
  all: () => true,
  simple: (trade) => !trade.multiLeg,
  multiLeg: (trade) => trade.multiLeg,
  opening: (trade) => trade.opening,
  unusual: (trade) => trade.unusual,
  goldenSweep: (trade) => trade.goldenSweep,
  volumeOverOi: (trade) => trade.volumeGreaterThanOpenInterest,
  aboveAsk: (trade) => trade.spreadPosition > 1.02,
  atAsk: (trade) => trade.spreadPosition >= 0.85 && trade.spreadPosition <= 1.02,
  mid: (trade) => trade.spreadPosition > 0.15 && trade.spreadPosition < 0.85,
  atBid: (trade) => trade.spreadPosition >= -0.02 && trade.spreadPosition <= 0.15,
  belowBid: (trade) => trade.spreadPosition < -0.02,
};

const ENHANCED_SPECS = [
  { name: "gamma core", bases: ["gammaOnePercent"], groups: ["all"] },
  { name: "gamma structure", bases: ["gammaOnePercent"], groups: ["all", "simple", "multiLeg", "opening", "unusual"] },
  { name: "gamma microstructure", bases: ["gammaOnePercent"], groups: ["all", "simple", "multiLeg", "opening", "unusual", "goldenSweep", "volumeOverOi", "aboveAsk", "atAsk", "mid", "atBid", "belowBid"] },
  { name: "gamma plus premium", bases: ["gammaOnePercent", "premium"], groups: ["all", "simple", "multiLeg", "opening", "unusual"] },
  { name: "gamma premium contracts", bases: ["gammaOnePercent", "premium", "contracts"], groups: ["all", "simple", "multiLeg", "opening", "unusual"] },
];

function enhancedFeatureNames(spec, carryMode) {
  const carry = carryMode === "callPutSplit" ? ["priorCallRepriced", "priorPutRepriced"] : [carryMode];
  const flow = [];
  for (const basis of spec.bases) {
    for (const group of spec.groups) {
      for (const bucket of EXECUTION_BUCKETS) flow.push(`${basis}:${group}:${bucket}`);
    }
  }
  return [...carry, ...flow];
}

function enhancedFlowFeatures(tape, priorTime, currentTime, configuredSpot, spec) {
  const values = [];
  for (const basis of spec.bases) {
    for (const group of spec.groups) {
      const matches = ENHANCED_FLOW_GROUPS[group];
      for (const bucket of EXECUTION_BUCKETS) {
        let total = 0;
        for (const trade of tape) {
          if (trade.timestamp <= priorTime || trade.timestamp > currentTime) continue;
          if (trade.bucket !== bucket || !matches(trade)) continue;
          total += valueBasis(trade, basis, configuredSpot);
        }
        values.push(total);
      }
    }
  }
  return values;
}

function buildEnhancedTransitionRows(source, spec, carryMode) {
  const rows = [];
  for (const [ticker, history] of Object.entries(TRINITY_STATE_HISTORY)) {
    const configuredSpot = TARGETS[ticker].spot;
    for (const [strike, observations] of history.values) {
      const timestamps = [...observations.keys()].sort((left, right) => left - right);
      const tape = indexedRows.get(`${ticker}:${source}:${strike}`) ?? [];
      for (let index = 1; index < timestamps.length; index += 1) {
        const priorTime = timestamps[index - 1];
        const currentTime = timestamps[index];
        if (currentTime - priorTime > 20 * 60_000) continue;
        const prior = observations.get(priorTime);
        const repricing = repricingFeatures(tape, priorTime, currentTime, configuredSpot, prior);
        const carry = carryMode === "callPutSplit"
          ? [repricing.priorCallRepriced, repricing.priorPutRepriced]
          : [carryMode === "prior" ? prior : repricing[carryMode]];
        rows.push({
          ticker: history.label,
          strike,
          priorTime,
          currentTime,
          prior,
          current: observations.get(currentTime),
          features: [...carry, ...enhancedFlowFeatures(tape, priorTime, currentTime, configuredSpot, spec)],
        });
      }
    }
  }
  return rows;
}

function predictEnhancedRows(train, test, ridgeFactor, perSymbol) {
  const predictions = [];
  const evaluated = [];
  const groups = perSymbol ? [...new Set(test.map((row) => row.ticker))] : [null];
  for (const ticker of groups) {
    const trainRows = ticker ? train.filter((row) => row.ticker === ticker) : train;
    const testRows = ticker ? test.filter((row) => row.ticker === ticker) : test;
    const fit = multiFactorFitWithRidge(trainRows, ridgeFactor);
    if (!fit || !testRows.length) return null;
    for (const row of testRows) {
      predictions.push(row.features.reduce((sum, value, index) => sum + value * fit.weights[index], 0));
      evaluated.push(row);
    }
  }
  const result = dynamicStateMetrics(evaluated, predictions);
  return { rows: evaluated, predictions, ...result };
}

function enhancedWalkForward(rows, ridgeFactor, perSymbol, omitLatest = true) {
  const times = [...new Set(rows.map((row) => row.currentTime))].sort((left, right) => left - right);
  const testTimes = omitLatest ? times.slice(2, -1) : times.slice(2);
  const evaluated = [];
  const predictions = [];
  for (const currentTime of testTimes) {
    const train = rows.filter((row) => row.currentTime < currentTime);
    const test = rows.filter((row) => row.currentTime === currentTime);
    const result = predictEnhancedRows(train, test, ridgeFactor, perSymbol);
    if (!result) return null;
    evaluated.push(...result.rows);
    predictions.push(...result.predictions);
  }
  if (!evaluated.length) return null;
  return { rows: evaluated, predictions, ...dynamicStateMetrics(evaluated, predictions) };
}

function ternaryRules() {
  const rules = [];
  for (let encoded = 1; encoded < 3 ** EXECUTION_BUCKETS.length; encoded += 1) {
    let remainder = encoded;
    const weights = [];
    for (let index = 0; index < EXECUTION_BUCKETS.length; index += 1) {
      weights.push((remainder % 3) - 1);
      remainder = Math.floor(remainder / 3);
    }
    const firstNonZero = weights.find((value) => value !== 0);
    if (firstNonZero !== 1) continue;
    rules.push(weights);
  }
  return rules;
}

function formatEt(timestamp) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function money(value) {
  return `${value < 0 ? "-" : ""}$${Math.abs(value / 1_000_000).toFixed(2)}M`;
}

const sourceRows = new Map();
const indexedRows = new Map();
const diagnostics = [];
for (const ticker of Object.keys(TARGETS)) {
  const strikes = [...TARGETS[ticker].values.keys()];
  process.stderr.write(`Fetching ${ticker} target strikes (${strikes.length})...\n`);
  const consolidatedByStrike = await mapWithConcurrency(strikes, 4, async (strike) => {
    const rows = await walkStrikeTape("/options/tool/order-flow/consolidated", ticker, strike, true);
    process.stderr.write(`  ${ticker} ${strike}: ${rows.length} consolidated rows\n`);
    return rows;
  });
  const consolidatedRaw = consolidatedByStrike.flat();
  const rawResult = env.OPRA_REVERSE_ENGINEER_INCLUDE_RAW === "1"
    ? (await mapWithConcurrency(strikes, 3, (strike) => walkStrikeTape("/options/tool/order-flow/unconsolidated", ticker, strike).catch(() => []))).flat()
    : [];
  const sources = {
    consolidated: dedupe(consolidatedRaw, "consolidated", ticker),
    raw: dedupe(rawResult, "raw", ticker),
    comprising: dedupe(comprisingRows(consolidatedRaw), "comprising", ticker),
  };
  for (const [source, rows] of Object.entries(sources)) {
    if (!rows.length) continue;
    sourceRows.set(`${ticker}:${source}`, rows);
    for (const trade of rows) {
      const key = `${ticker}:${source}:${trade.strike}`;
      const bucket = indexedRows.get(key) ?? [];
      bucket.push(trade);
      indexedRows.set(key, bucket);
    }
  }
  diagnostics.push({
    ticker,
    consolidated: sources.consolidated.length,
    raw: sources.raw.length,
    comprising: sources.comprising.length,
    classified: sources.consolidated.filter((row) => row.side !== "MID" && row.side !== "UNKNOWN").length,
    withGamma: sources.consolidated.filter((row) => row.gamma > 0).length,
    sentiments: Object.fromEntries([...new Set(sources.consolidated.map((row) => row.sentiment).filter(Boolean))]
      .sort()
      .map((sentiment) => [sentiment, sources.consolidated.filter((row) => row.sentiment === sentiment).length])),
  });
}

const retainedCandidates = [];
const bucketModelCandidates = [];
const ternaryCandidates = [];
const snapshotCandidates = [];
const stateChangeCandidates = [];
const sentimentCandidates = [];
const dynamicStateCandidates = [];
const repricedStateCandidates = [];
const simpleRepricedStateCandidates = [];
const latentSplitStateCandidates = [];
const openingSeedCandidates = [];
const enhancedTransitionCandidates = [];
let candidateCount = 0;

function retainCandidate(candidate) {
  candidateCount += 1;
  if (!Number.isFinite(candidate.r2)) return;
  retainedCandidates.push(candidate);
  if (retainedCandidates.length < 1_200) return;
  retainedCandidates.sort((left, right) => right.r2 - left.r2);
  retainedCandidates.length = 500;
}

function retainLimited(collection, candidate, limit, compare = (left, right) => right.r2 - left.r2) {
  if (!Number.isFinite(candidate.r2)) return;
  collection.push(candidate);
  if (collection.length < limit * 2) return;
  collection.sort(compare);
  collection.length = limit;
}

const SIMPLE_TERNARY_RULES = ternaryRules();

const DYNAMIC_STATE_MODELS = [
  { name: "classified gamma CB/CS/PB/PS", basis: "gammaOnePercent", filter: FILTERS.classified, buckets: ["CB", "CS", "PB", "PS"] },
  { name: "simple classified gamma CB/CS/PB/PS", basis: "gammaOnePercent", filter: FILTERS.simpleClassified, buckets: ["CB", "CS", "PB", "PS"] },
  { name: "all gamma CB/CS/PB/PS/CM/PM", basis: "gammaOnePercent", filter: FILTERS.all, buckets: EXECUTION_BUCKETS },
  { name: "classified contracts CB/CS/PB/PS", basis: "contracts", filter: FILTERS.classified, buckets: ["CB", "CS", "PB", "PS"] },
  { name: "all contracts CB/CS/PB/PS/CM/PM", basis: "contracts", filter: FILTERS.all, buckets: EXECUTION_BUCKETS },
  { name: "classified premium CB/CS/PB/PS", basis: "premium", filter: FILTERS.classified, buckets: ["CB", "CS", "PB", "PS"] },
];

if (OPRA_FETCH_START_MS < SESSION_OPEN_MS) {
  for (const source of ["comprising", "consolidated"]) {
    if (![...sourceRows.keys()].some((key) => key.endsWith(`:${source}`))) continue;
    for (const model of DYNAMIC_STATE_MODELS) {
      const rows = [];
      for (const [ticker, history] of Object.entries(TRINITY_STATE_HISTORY)) {
        const configuredSpot = TARGETS[ticker].spot;
        for (const [strike, observations] of history.values) {
          const openingTime = Math.min(...observations.keys());
          const totals = Object.fromEntries(model.buckets.map((bucket) => [bucket, 0]));
          const tape = indexedRows.get(`${ticker}:${source}:${strike}`) ?? [];
          for (const trade of tape) {
            if (trade.timestamp < OPRA_FETCH_START_MS || trade.timestamp > openingTime || !model.filter(trade)) continue;
            if (Object.hasOwn(totals, trade.bucket)) totals[trade.bucket] += valueBasis(trade, model.basis, configuredSpot);
          }
          rows.push({
            ticker: history.label,
            strike,
            target: observations.get(openingTime),
            features: model.buckets.map((bucket) => totals[bucket]),
          });
        }
      }
      const fit = multiFactorFit(rows);
      if (!fit) continue;
      openingSeedCandidates.push({
        source,
        model: model.name,
        basis: model.basis,
        buckets: model.buckets,
        rows,
        weights: fit.weights,
        rmse: fit.rmse,
        r2: fit.r2,
        signAccuracy: fit.signAccuracy,
        holdoutRmse: multiFactorHoldoutRmse(rows),
      });
    }
  }
}

for (const source of ["raw", "comprising", "consolidated"]) {
  if (![...sourceRows.keys()].some((key) => key.endsWith(`:${source}`))) continue;
  for (const model of DYNAMIC_STATE_MODELS) {
    const rows = [];
    for (const [ticker, history] of Object.entries(TRINITY_STATE_HISTORY)) {
      const configuredSpot = TARGETS[ticker].spot;
      for (const [strike, observations] of history.values) {
        const timestamps = [...observations.keys()].sort((left, right) => left - right);
        const tape = indexedRows.get(`${ticker}:${source}:${strike}`) ?? [];
        for (let index = 1; index < timestamps.length; index += 1) {
          const priorTime = timestamps[index - 1];
          const currentTime = timestamps[index];
          const totals = Object.fromEntries(model.buckets.map((bucket) => [bucket, 0]));
          for (const trade of tape) {
            if (trade.timestamp <= priorTime || trade.timestamp > currentTime || !model.filter(trade)) continue;
            if (Object.hasOwn(totals, trade.bucket)) {
              totals[trade.bucket] += valueBasis(trade, model.basis, configuredSpot);
            }
          }
          rows.push({
            ticker: history.label,
            strike,
            priorTime,
            currentTime,
            prior: observations.get(priorTime),
            current: observations.get(currentTime),
            ...repricingFeatures(tape, priorTime, currentTime, configuredSpot, observations.get(priorTime)),
            features: model.buckets.map((bucket) => totals[bucket]),
          });
        }
      }
    }
    const nestedHoldout = dynamicStateNestedHoldout(rows);
    for (let step = 0; step <= 200; step += 1) {
      const rho = step / 100;
      const fit = fitDynamicState(rows, rho);
      if (!fit) continue;
      dynamicStateCandidates.push({
        source,
        model: model.name,
        basis: model.basis,
        buckets: model.buckets,
        rows,
        ...fit,
        holdoutRmse: nestedHoldout.rmse,
        holdoutDirectionAccuracy: nestedHoldout.directionAccuracy,
      });
    }
  }
}

// Trinity's state cannot be repriced correctly when the previous signed value
// is treated as one homogeneous gamma inventory. Calls and puts have different
// gamma surfaces, so estimate one latent call/put split per strike and carry
// classified call and put flow on their own surfaces. The split is learned
// from earlier replay observations; the latest observation remains untouched
// for a genuine walk-forward test.
for (const source of ["comprising", "consolidated"]) {
  if (![...sourceRows.keys()].some((key) => key.endsWith(`:${source}`))) continue;
  for (const model of DYNAMIC_STATE_MODELS.filter((candidate) => [
    "all gamma CB/CS/PB/PS/CM/PM",
    "all contracts CB/CS/PB/PS/CM/PM",
    "classified premium CB/CS/PB/PS",
  ].includes(candidate.name))) {
    const built = buildLatentSplitRows(source, model);
    const fit = fitLatentSplitState(built.rows);
    if (!fit) continue;
    const timeHoldout = latentSplitTimeHoldout(built.rows);
    const alphaWeights = fit.weights.slice(0, built.strikeKeys.length);
    latentSplitStateCandidates.push({
      source,
      model: model.name,
      basis: model.basis,
      buckets: model.buckets,
      strikeKeys: built.strikeKeys,
      rows: built.rows,
      ...fit,
      alphaSummary: {
        minimum: Math.min(...alphaWeights),
        median: [...alphaWeights].sort((left, right) => left - right)[Math.floor(alphaWeights.length / 2)],
        maximum: Math.max(...alphaWeights),
      },
      timeHoldoutRmse: timeHoldout.rmse,
      timeHoldoutR2: timeHoldout.r2,
      timeHoldoutSignAccuracy: timeHoldout.signAccuracy,
      timeHoldoutDirectionAccuracy: timeHoldout.directionAccuracy,
      timeHoldoutWeights: timeHoldout.weights,
      timeHoldoutPredictions: timeHoldout.predictions,
      timeHoldoutTimestamp: timeHoldout.timestamp,
    });
  }
}

for (const source of ["raw", "comprising", "consolidated"]) {
  if (![...sourceRows.keys()].some((key) => key.endsWith(`:${source}`))) continue;
  for (const model of DYNAMIC_STATE_MODELS) {
    const rows = [];
    for (const [ticker, history] of Object.entries(TRINITY_STATE_HISTORY)) {
      const configuredSpot = TARGETS[ticker].spot;
      for (const [strike, observations] of history.values) {
        const timestamps = [...observations.keys()].sort((left, right) => left - right);
        const tape = indexedRows.get(`${ticker}:${source}:${strike}`) ?? [];
        for (let index = 1; index < timestamps.length; index += 1) {
          const priorTime = timestamps[index - 1];
          const currentTime = timestamps[index];
          const totals = Object.fromEntries(model.buckets.map((bucket) => [bucket, 0]));
          for (const trade of tape) {
            if (trade.timestamp <= priorTime || trade.timestamp > currentTime || !model.filter(trade)) continue;
            if (Object.hasOwn(totals, trade.bucket)) totals[trade.bucket] += valueBasis(trade, model.basis, configuredSpot);
          }
          const prior = observations.get(priorTime);
          const repricing = repricingFeatures(tape, priorTime, currentTime, configuredSpot, prior);
          for (const priorMode of ["priorGrossRepriced", "priorCallRepriced", "priorPutRepriced", "callPutSplit"]) {
            const carryFeatures = priorMode === "callPutSplit"
              ? [repricing.priorCallRepriced, repricing.priorPutRepriced]
              : [repricing[priorMode]];
            rows.push({
              ticker: history.label,
              strike,
              priorTime,
              currentTime,
              prior,
              current: observations.get(currentTime),
              priorMode,
              features: [...carryFeatures, ...model.buckets.map((bucket) => totals[bucket])],
            });
          }
        }
      }
    }
    for (const priorMode of ["priorGrossRepriced", "priorCallRepriced", "priorPutRepriced", "callPutSplit"]) {
      const modeRows = rows.filter((row) => row.priorMode === priorMode);
      const fit = fitDirectDynamicState(modeRows);
      if (!fit) continue;
      const holdout = directDynamicStateHoldout(modeRows);
      const timeHoldout = directDynamicTimeHoldout(modeRows);
      repricedStateCandidates.push({
        source,
        model: model.name,
        priorMode,
        basis: model.basis,
        buckets: model.buckets,
        rows: modeRows,
        ...fit,
        holdoutRmse: holdout.rmse,
        holdoutDirectionAccuracy: holdout.directionAccuracy,
        timeHoldoutRmse: timeHoldout.rmse,
        timeHoldoutDirectionAccuracy: timeHoldout.directionAccuracy,
      });
    }
  }
}

// Search a constrained, auditable execution classifier instead of relying only
// on six unconstrained bucket coefficients. Each rule assigns buy/sell/mid
// call/put prints to {-1, 0, +1}; a two-factor fit then estimates one carry
// coefficient and one common contracts coefficient.
for (const candidate of repricedStateCandidates) {
  if (candidate.source !== "comprising"
    || candidate.model !== "all contracts CB/CS/PB/PS/CM/PM"
    || candidate.priorMode !== "priorPutRepriced") continue;
  for (const rule of SIMPLE_TERNARY_RULES) {
    const rows = candidate.rows.map((row) => ({
      ...row,
      features: [
        row.features[0],
        row.features.slice(1).reduce((sum, value, index) => sum + value * rule[index], 0),
      ],
    }));
    const fit = fitDirectDynamicState(rows);
    if (!fit) continue;
    const holdout = directDynamicStateHoldout(rows);
    const timeHoldout = directDynamicTimeHoldout(rows);
    simpleRepricedStateCandidates.push({
      source: candidate.source,
      model: "put-repriced carry + ternary execution classifier",
      priorMode: candidate.priorMode,
      basis: candidate.basis,
      buckets: EXECUTION_BUCKETS,
      rule,
      rows,
      ...fit,
      holdoutRmse: holdout.rmse,
      holdoutDirectionAccuracy: holdout.directionAccuracy,
      timeHoldoutRmse: timeHoldout.rmse,
      timeHoldoutDirectionAccuracy: timeHoldout.directionAccuracy,
      timeHoldoutWeights: timeHoldout.weights,
    });
  }
}

for (const source of ["comprising", "consolidated"]) {
  if (![...sourceRows.keys()].some((key) => key.endsWith(`:${source}`))) continue;
  for (const spec of ENHANCED_SPECS) {
    for (const carryMode of ["prior", "priorGrossRepriced", "priorPutRepriced", "callPutSplit"]) {
      const rows = buildEnhancedTransitionRows(source, spec, carryMode);
      if (!rows.length) continue;
      const latestTime = Math.max(...rows.map((row) => row.currentTime));
      const latestTrain = rows.filter((row) => row.currentTime < latestTime);
      const latestTest = rows.filter((row) => row.currentTime === latestTime);
      for (const ridgeFactor of [0.1, 1, 10]) {
        for (const perSymbol of [false, true]) {
          const validation = enhancedWalkForward(rows, ridgeFactor, perSymbol, true);
          const latest = predictEnhancedRows(latestTrain, latestTest, ridgeFactor, perSymbol);
          if (!validation || !latest) continue;
          enhancedTransitionCandidates.push({
            source,
            spec: spec.name,
            carryMode,
            featureNames: enhancedFeatureNames(spec, carryMode),
            featureCount: rows[0].features.length,
            ridgeFactor,
            perSymbol,
            rows,
            validationRmse: validation.rmse,
            validationR2: validation.r2,
            validationSignAccuracy: validation.signAccuracy,
            validationDirectionAccuracy: validation.directionAccuracy,
            latestTimestamp: latestTime,
            latestRows: latest.rows,
            latestPredictions: latest.predictions,
            latestRmse: latest.rmse,
            latestR2: latest.r2,
            latestSignAccuracy: latest.signAccuracy,
            latestDirectionAccuracy: latest.directionAccuracy,
          });
        }
      }
    }
  }
}

if (SUMMARY_ONLY) {
  const rankedDynamicStates = dynamicStateCandidates
    .sort((left, right) => left.holdoutRmse - right.holdoutRmse || right.r2 - left.r2);
  const baselineRows = rankedDynamicStates[0]?.rows ?? [];
  const carryScale = baselineRows.length
    ? oneFactorFit(baselineRows.map((row) => ({ target: row.current, prior: row.prior })), "prior").scale
    : 0;
  const carryPredictions = baselineRows.map((row) => carryScale * row.prior);
  const carryMetrics = baselineRows.length ? dynamicStateMetrics(baselineRows, carryPredictions) : null;
  const carryHoldout = baselineRows.length ? dynamicCarryHoldout(baselineRows) : null;
  const rankedRepricedStates = repricedStateCandidates
    .sort((left, right) => left.holdoutRmse - right.holdoutRmse || right.r2 - left.r2);
  const rankedSimpleRepricedStates = simpleRepricedStateCandidates
    .sort((left, right) => left.holdoutRmse - right.holdoutRmse || left.timeHoldoutRmse - right.timeHoldoutRmse);
  const rankedLatentSplitStates = latentSplitStateCandidates
    .sort((left, right) => left.timeHoldoutRmse - right.timeHoldoutRmse || right.r2 - left.r2);
  const rankedOpeningSeeds = openingSeedCandidates
    .sort((left, right) => left.holdoutRmse - right.holdoutRmse || right.r2 - left.r2);
  const rankedEnhancedTransitions = enhancedTransitionCandidates
    .sort((left, right) => left.validationRmse - right.validationRmse || left.latestRmse - right.latestRmse);
  const bestRepriced = rankedRepricedStates[0];
  const bestLatentSplit = rankedLatentSplitStates[0];
  const referenceStrikes = {
    SPXW: new Set([7680, 7675, 7640]),
    SPY: new Set([760, 764, 766, 768, 775]),
    QQQ: new Set([700, 708, 714, 717]),
  };
  const latestObservationTime = bestRepriced
    ? Math.max(...bestRepriced.rows.map((row) => row.currentTime))
    : null;
  const repricedReferenceSamples = bestRepriced
    ? bestRepriced.rows.map((row, index) => ({ row, predicted: bestRepriced.predictions[index] }))
      .filter(({ row }) => row.currentTime === latestObservationTime && referenceStrikes[row.ticker]?.has(row.strike))
      .map(({ row, predicted }) => ({
        ticker: row.ticker,
        strike: row.strike,
        timestamp: new Date(row.currentTime).toISOString(),
        prior: row.prior,
        repricedPrior: row.features[0],
        actual: row.current,
        predicted,
        error: predicted - row.current,
      }))
    : [];
  const latentSplitReferenceSamples = bestLatentSplit
    ? bestLatentSplit.rows.filter((row) => row.currentTime === bestLatentSplit.timeHoldoutTimestamp)
      .map((row, index) => ({ row, predicted: bestLatentSplit.timeHoldoutPredictions[index] }))
      .filter(({ row }) => referenceStrikes[row.ticker]?.has(row.strike))
      .map(({ row, predicted }) => ({
        ticker: row.ticker,
        strike: row.strike,
        timestamp: new Date(row.currentTime).toISOString(),
        prior: row.prior,
        actual: row.current,
        predicted,
        error: predicted - row.current,
      }))
    : [];
  const bestEnhanced = rankedEnhancedTransitions[0];
  const enhancedReferenceSamples = bestEnhanced
    ? bestEnhanced.latestRows.map((row, index) => ({ row, predicted: bestEnhanced.latestPredictions[index] }))
      .filter(({ row }) => referenceStrikes[row.ticker]?.has(row.strike))
      .map(({ row, predicted }) => ({
        ticker: row.ticker,
        strike: row.strike,
        timestamp: new Date(row.currentTime).toISOString(),
        prior: row.prior,
        actual: row.current,
        predicted,
        error: predicted - row.current,
      }))
    : [];
  const latestPersistenceRows = bestEnhanced?.latestRows ?? [];
  const latestPersistencePredictions = latestPersistenceRows.map((row) => row.prior);
  const latestPersistence = latestPersistenceRows.length
    ? dynamicStateMetrics(latestPersistenceRows, latestPersistencePredictions)
    : null;
  console.log(JSON.stringify({
    sessionDate: SESSION_DATE,
    diagnostics,
    observationCount: baselineRows.length,
    carryBaseline: carryMetrics ? {
      rho: carryScale,
      ...carryMetrics,
      holdoutRmse: carryHoldout.rmse,
      holdoutDirectionAccuracy: carryHoldout.directionAccuracy,
    } : null,
    dynamicStates: rankedDynamicStates.slice(0, 20).map(({ rows: _rows, predictions: _predictions, ...row }) => row),
    repricedStates: rankedRepricedStates.slice(0, 30).map(({ rows: _rows, predictions: _predictions, ...row }) => row),
    simpleRepricedStates: rankedSimpleRepricedStates.slice(0, 30).map(({ rows: _rows, predictions: _predictions, ...row }) => row),
    latentSplitStates: rankedLatentSplitStates.slice(0, 20).map(({
      rows: _rows,
      predictions: _predictions,
      strikeKeys: _strikeKeys,
      weights: _weights,
      timeHoldoutWeights: _timeHoldoutWeights,
      timeHoldoutPredictions: _timeHoldoutPredictions,
      ...row
    }) => row),
    openingSeeds: rankedOpeningSeeds.slice(0, 20).map(({ rows: _rows, ...row }) => row),
    enhancedTransitions: rankedEnhancedTransitions.slice(0, 30).map(({
      rows: _rows,
      latestRows: _latestRows,
      latestPredictions: _latestPredictions,
      featureNames: _featureNames,
      ...row
    }) => row),
    bestEnhancedFeatureNames: bestEnhanced?.featureNames ?? [],
    latestPersistence,
    repricedReferenceSamples,
    latentSplitReferenceSamples,
    enhancedReferenceSamples,
  }, null, 2));
  process.exit(0);
}

for (const source of ["raw", "comprising", "consolidated"]) {
  if (![...sourceRows.keys()].some((key) => key.endsWith(`:${source}`))) continue;
  for (const cutoff of CUTOFFS) {
    for (const window of WINDOWS) {
      const start = window.milliseconds === null ? SESSION_OPEN_MS : Math.max(SESSION_OPEN_MS, cutoff - window.milliseconds);
      for (const [filterName, filter] of Object.entries(FILTERS)) {
        for (const basis of BASES) {
          const rowsByRule = new Map(Object.keys(SIDE_RULES).map((ruleName) => [ruleName, []]));
          const bucketRows = [];
          for (const [ticker, target] of Object.entries(TARGETS)) {
            for (const [strike, targetValue] of target.values) {
              const bucketTotals = { CB: 0, CS: 0, PB: 0, PS: 0, CM: 0, PM: 0 };
              const tape = indexedRows.get(`${ticker}:${source}:${strike}`) ?? [];
              for (const trade of tape) {
                if (trade.timestamp < start || trade.timestamp > cutoff || !filter(trade)) continue;
                if (Object.hasOwn(bucketTotals, trade.bucket)) {
                  bucketTotals[trade.bucket] += valueBasis(trade, basis, target.spot);
                }
              }
              for (const [ruleName, rule] of Object.entries(SIDE_RULES)) {
                const value = Object.entries(bucketTotals)
                  .reduce((sum, [bucket, total]) => sum + total * (rule[bucket] ?? 0), 0);
                rowsByRule.get(ruleName).push({ ticker: target.label, strike, target: targetValue, candidate: value });
              }
              bucketRows.push({
                ticker: target.label,
                strike,
                target: targetValue,
                features: EXECUTION_BUCKETS.map((bucket) => bucketTotals[bucket]),
              });
            }
          }
          for (const [ruleName, rows] of rowsByRule) {
            const fit = oneFactorFit(rows, "candidate");
            retainCandidate({
              source,
              cutoff,
              window: window.label,
              filter: filterName,
              basis,
              rule: ruleName,
              ...fit,
              rows,
            });
          }
          const bucketFit = multiFactorFit(bucketRows);
          if (bucketFit) {
            retainLimited(bucketModelCandidates, {
              source,
              cutoff,
              window: window.label,
              filter: filterName,
              basis,
              weights: bucketFit.weights,
              r2: bucketFit.r2,
              rmse: bucketFit.rmse,
              signAccuracy: bucketFit.signAccuracy,
              holdoutRmse: multiFactorHoldoutRmse(bucketRows),
              rows: bucketRows,
            }, 300);
          }
          if (["all", "simpleClassified"].includes(filterName)
            && ["contracts", "premium", "gammaOnePercent", "deltaNotional", "gammaPremium"].includes(basis)) {
            for (const weights of SIMPLE_TERNARY_RULES) {
              const rows = bucketRows.map((row) => ({
                ...row,
                candidate: row.features.reduce((sum, value, index) => sum + value * weights[index], 0),
              }));
              const fit = oneFactorFit(rows, "candidate");
              retainLimited(ternaryCandidates, {
                source,
                cutoff,
                window: window.label,
                filter: filterName,
                basis,
                weights,
                ...fit,
                holdoutRmse: holdoutRmse(rows, "candidate"),
                rows,
              }, 300);
            }
          }
        }
      }
    }
  }
}

for (const source of ["raw", "comprising", "consolidated"]) {
  if (![...sourceRows.keys()].some((key) => key.endsWith(`:${source}`))) continue;
  for (const cutoff of CUTOFFS) {
    const rowsByCandidate = new Map([
      ["snapshotVolumeGamma", []],
      ["snapshotOiGamma", []],
      ["snapshotDeltaOiGamma", []],
      ["snapshotVolumeContracts", []],
      ["snapshotDeltaOiContracts", []],
    ]);
    for (const [ticker, target] of Object.entries(TARGETS)) {
      for (const [strike, targetValue] of target.values) {
        const tape = indexedRows.get(`${ticker}:${source}:${strike}`) ?? [];
        const latestByContract = new Map();
        for (const trade of tape) {
          if (trade.timestamp > cutoff) continue;
          const contractKey = trade.osi || `${trade.expirationDate}:${trade.strike}:${trade.type}`;
          const previous = latestByContract.get(contractKey);
          if (!previous || previous.timestamp <= trade.timestamp) latestByContract.set(contractKey, trade);
        }
        const candidates = {
          snapshotVolumeGamma: 0,
          snapshotOiGamma: 0,
          snapshotDeltaOiGamma: 0,
          snapshotVolumeContracts: 0,
          snapshotDeltaOiContracts: 0,
        };
        for (const trade of latestByContract.values()) {
          const optionSign = trade.type === "CALL" ? 1 : -1;
          const spot = trade.stockPrice && trade.stockPrice > 0 ? trade.stockPrice : target.spot;
          const gammaFactor = trade.gamma * CONTRACT_MULTIPLIER * spot * spot * 0.01;
          candidates.snapshotVolumeGamma += optionSign * trade.volume * gammaFactor;
          candidates.snapshotOiGamma += optionSign * trade.openInterest * gammaFactor;
          candidates.snapshotDeltaOiGamma += optionSign * trade.deltaOpenInterest * gammaFactor;
          candidates.snapshotVolumeContracts += optionSign * trade.volume;
          candidates.snapshotDeltaOiContracts += optionSign * trade.deltaOpenInterest;
        }
        for (const [candidateName, value] of Object.entries(candidates)) {
          rowsByCandidate.get(candidateName).push({ ticker: target.label, strike, target: targetValue, candidate: value });
        }
      }
    }
    for (const [candidateName, rows] of rowsByCandidate) {
      const fit = oneFactorFit(rows, "candidate");
      retainLimited(snapshotCandidates, {
        source,
        cutoff,
        candidateName,
        ...fit,
        holdoutRmse: holdoutRmse(rows, "candidate"),
        rows,
      }, 200);
    }
  }
}

function sentimentSign(trade) {
  if (trade.sentiment.includes("BULL")) return 1;
  if (trade.sentiment.includes("BEAR")) return -1;
  return 0;
}

for (const source of ["raw", "comprising", "consolidated"]) {
  if (![...sourceRows.keys()].some((key) => key.endsWith(`:${source}`))) continue;
  for (const cutoff of CUTOFFS) {
    const rowsByStateCandidate = new Map([
      ["gammaOiStateChangeCallMinusPut", []],
      ["gammaOiStateChangeAllSameSign", []],
      ["gammaOiSpotOnlyChangeCallMinusPut", []],
      ["gammaOiGreeksOnlyChangeCallMinusPut", []],
      ["gammaVolumeStateChangeCallMinusPut", []],
      ["gammaVolumeGrowthCallMinusPut", []],
      ["gammaVolumeGrowthAllSameSign", []],
      ["gammaDeltaOiStateChangeCallMinusPut", []],
      ["gammaCurrentOiMinusPriorOiCallMinusPut", []],
    ]);
    const rowsBySentimentCandidate = new Map([
      ["sentimentContracts", []],
      ["sentimentPremium", []],
      ["sentimentGammaOnePercent", []],
      ["sentimentGammaDollar", []],
      ["sentimentDeltaNotional", []],
      ["sentimentGammaOnePercentSimple", []],
    ]);

    for (const [ticker, target] of Object.entries(TARGETS)) {
      for (const [strike, targetValue] of target.values) {
        const tape = (indexedRows.get(`${ticker}:${source}:${strike}`) ?? [])
          .filter((trade) => trade.timestamp >= SESSION_OPEN_MS && trade.timestamp <= cutoff);
        const byContract = new Map();
        for (const trade of tape) {
          const contractKey = trade.osi || `${trade.expirationDate}:${trade.strike}:${trade.type}`;
          const rows = byContract.get(contractKey) ?? [];
          rows.push(trade);
          byContract.set(contractKey, rows);
        }

        const stateValues = Object.fromEntries([...rowsByStateCandidate.keys()].map((key) => [key, 0]));
        for (const contractRows of byContract.values()) {
          contractRows.sort((left, right) => left.timestamp - right.timestamp);
          const first = contractRows[0];
          const latest = contractRows[contractRows.length - 1];
          if (!first || !latest) continue;
          const optionSign = latest.type === "CALL" ? 1 : -1;
          const firstSpot = first.stockPrice && first.stockPrice > 0 ? first.stockPrice : target.spot;
          const latestSpot = latest.stockPrice && latest.stockPrice > 0 ? latest.stockPrice : target.spot;
          const firstFactor = CONTRACT_MULTIPLIER * firstSpot * firstSpot * 0.01;
          const latestFactor = CONTRACT_MULTIPLIER * latestSpot * latestSpot * 0.01;
          const firstGammaOi = first.gamma * first.openInterest * firstFactor;
          const latestGammaOi = latest.gamma * latest.openInterest * latestFactor;
          const firstGammaVolume = first.gamma * first.volume * firstFactor;
          const latestGammaVolume = latest.gamma * latest.volume * latestFactor;
          const firstGammaDeltaOi = first.gamma * first.deltaOpenInterest * firstFactor;
          const latestGammaDeltaOi = latest.gamma * latest.deltaOpenInterest * latestFactor;
          stateValues.gammaOiStateChangeCallMinusPut += optionSign * (latestGammaOi - firstGammaOi);
          stateValues.gammaOiStateChangeAllSameSign += latestGammaOi - firstGammaOi;
          stateValues.gammaOiSpotOnlyChangeCallMinusPut += optionSign
            * first.gamma * first.openInterest * (latestFactor - firstFactor);
          stateValues.gammaOiGreeksOnlyChangeCallMinusPut += optionSign
            * (latest.gamma - first.gamma) * first.openInterest * latestFactor;
          stateValues.gammaVolumeStateChangeCallMinusPut += optionSign * (latestGammaVolume - firstGammaVolume);
          stateValues.gammaVolumeGrowthCallMinusPut += optionSign
            * Math.max(0, latest.volume - first.volume) * latest.gamma * latestFactor;
          stateValues.gammaVolumeGrowthAllSameSign += Math.max(0, latest.volume - first.volume) * latest.gamma * latestFactor;
          stateValues.gammaDeltaOiStateChangeCallMinusPut += optionSign * (latestGammaDeltaOi - firstGammaDeltaOi);
          stateValues.gammaCurrentOiMinusPriorOiCallMinusPut += optionSign
            * (latest.openInterest - latest.previousOpenInterest) * latest.gamma * latestFactor;
        }
        for (const [candidateName, value] of Object.entries(stateValues)) {
          rowsByStateCandidate.get(candidateName).push({ ticker: target.label, strike, target: targetValue, candidate: value });
        }

        const sentimentValues = Object.fromEntries([...rowsBySentimentCandidate.keys()].map((key) => [key, 0]));
        for (const trade of tape) {
          const sign = sentimentSign(trade);
          if (!sign) continue;
          sentimentValues.sentimentContracts += sign * trade.size;
          sentimentValues.sentimentPremium += sign * trade.premium;
          sentimentValues.sentimentGammaOnePercent += sign * valueBasis(trade, "gammaOnePercent", target.spot);
          sentimentValues.sentimentGammaDollar += sign * valueBasis(trade, "gammaDollar", target.spot);
          sentimentValues.sentimentDeltaNotional += sign * valueBasis(trade, "deltaNotional", target.spot);
          if (!trade.multiLeg) {
            sentimentValues.sentimentGammaOnePercentSimple += sign * valueBasis(trade, "gammaOnePercent", target.spot);
          }
        }
        for (const [candidateName, value] of Object.entries(sentimentValues)) {
          rowsBySentimentCandidate.get(candidateName).push({ ticker: target.label, strike, target: targetValue, candidate: value });
        }
      }
    }

    for (const [candidateName, rows] of rowsByStateCandidate) {
      const fit = oneFactorFit(rows, "candidate");
      retainLimited(stateChangeCandidates, {
        source,
        cutoff,
        candidateName,
        ...fit,
        holdoutRmse: holdoutRmse(rows, "candidate"),
        rows,
      }, 200);
    }
    for (const [candidateName, rows] of rowsBySentimentCandidate) {
      const fit = oneFactorFit(rows, "candidate");
      retainLimited(sentimentCandidates, {
        source,
        cutoff,
        candidateName,
        ...fit,
        holdoutRmse: holdoutRmse(rows, "candidate"),
        rows,
      }, 200);
    }
  }
}

const ranked = retainedCandidates
  .map((row) => ({ ...row, holdoutRmse: holdoutRmse(row.rows, "candidate") }))
  .sort((left, right) => right.r2 - left.r2 || left.holdoutRmse - right.holdoutRmse);
const rankedBucketModels = bucketModelCandidates
  .sort((left, right) => right.r2 - left.r2 || left.holdoutRmse - right.holdoutRmse);
const rankedTernary = ternaryCandidates
  .sort((left, right) => right.r2 - left.r2 || left.holdoutRmse - right.holdoutRmse);
const rankedSnapshots = snapshotCandidates
  .sort((left, right) => right.r2 - left.r2 || left.holdoutRmse - right.holdoutRmse);
const rankedStateChanges = stateChangeCandidates
  .sort((left, right) => right.r2 - left.r2 || left.holdoutRmse - right.holdoutRmse);
const rankedSentiment = sentimentCandidates
  .sort((left, right) => right.r2 - left.r2 || left.holdoutRmse - right.holdoutRmse);
const rankedDynamicStates = dynamicStateCandidates
  .sort((left, right) => left.holdoutRmse - right.holdoutRmse || right.r2 - left.r2);
const dynamicBaselineRows = rankedDynamicStates[0]?.rows ?? [];
const dynamicCarryScale = dynamicBaselineRows.length
  ? oneFactorFit(dynamicBaselineRows.map((row) => ({ target: row.current, prior: row.prior })), "prior").scale
  : 0;
const dynamicCarryPredictions = dynamicBaselineRows.map((row) => dynamicCarryScale * row.prior);
const dynamicCarryMetrics = dynamicBaselineRows.length
  ? dynamicStateMetrics(dynamicBaselineRows, dynamicCarryPredictions)
  : null;
const dynamicCarryHoldoutMetrics = dynamicBaselineRows.length
  ? dynamicCarryHoldout(dynamicBaselineRows)
  : null;

console.log(`# OPRA 0DTE Live Flow reverse engineering — ${SESSION_DATE} 10:00 ET\n`);
console.log("This search uses only the existing VPS-backed options source. It does not issue a direct metered Databento historical request.\n");
console.log(`Evaluated ${candidateCount.toLocaleString("en-US")} constrained formula candidates; retained the strongest ${ranked.length.toLocaleString("en-US")} for cross-symbol validation.\n`);
console.log("## Tape diagnostics\n");
for (const row of diagnostics) {
  console.log(`- ${row.ticker}: ${row.consolidated} consolidated, ${row.raw} raw, ${row.comprising} comprising; ${row.classified} consolidated prints side-classified; ${row.withGamma} with gamma; sentiment ${JSON.stringify(row.sentiments)}.`);
}
console.log("\n## Best constrained candidates\n");
console.log("| Rank | Source | Snapshot ET | Window | Filter | Basis | Signing | Scale | R² | Sign | Holdout RMSE |");
console.log("|---:|---|---|---|---|---|---|---:|---:|---:|---:|");
ranked.slice(0, 30).forEach((row, index) => {
  console.log(`| ${index + 1} | ${row.source} | ${formatEt(row.cutoff)} | ${row.window} | ${row.filter} | ${row.basis} | ${row.rule} | ${row.scale.toFixed(6)} | ${row.r2.toFixed(4)} | ${(row.signAccuracy * 100).toFixed(1)}% | ${money(row.holdoutRmse)} |`);
});

console.log("\n## Best independently fitted execution-bucket models\n");
console.log("These fits let call buys/sells, put buys/sells, and midpoint prints carry separate coefficients. A high in-sample score with a poor symbol holdout is overfit, not a recovered formula.\n");
console.log("| Rank | Source | Snapshot ET | Window | Filter | Basis | CB / CS / PB / PS / CM / PM | R² | Sign | Holdout RMSE |");
console.log("|---:|---|---|---|---|---|---|---:|---:|---:|");
rankedBucketModels.slice(0, 20).forEach((row, index) => {
  const weights = row.weights.map((value) => Number.isFinite(value) ? value.toExponential(2) : "NA").join(" / ");
  console.log(`| ${index + 1} | ${row.source} | ${formatEt(row.cutoff)} | ${row.window} | ${row.filter} | ${row.basis} | ${weights} | ${row.r2.toFixed(4)} | ${(row.signAccuracy * 100).toFixed(1)}% | ${money(row.holdoutRmse)} |`);
});

console.log("\n## Best simple {-1, 0, +1} execution-bucket rules\n");
console.log("| Rank | Source | Snapshot ET | Window | Filter | Basis | CB / CS / PB / PS / CM / PM | Scale | R² | Sign | Holdout RMSE |");
console.log("|---:|---|---|---|---|---|---|---:|---:|---:|---:|");
rankedTernary.slice(0, 20).forEach((row, index) => {
  console.log(`| ${index + 1} | ${row.source} | ${formatEt(row.cutoff)} | ${row.window} | ${row.filter} | ${row.basis} | ${row.weights.join(" / ")} | ${row.scale.toExponential(3)} | ${row.r2.toFixed(4)} | ${(row.signAccuracy * 100).toFixed(1)}% | ${money(row.holdoutRmse)} |`);
});

console.log("\n## Best cumulative contract-snapshot models\n");
console.log("| Rank | Source | Snapshot ET | Candidate | Scale | R² | Sign | Holdout RMSE |");
console.log("|---:|---|---|---|---:|---:|---:|---:|");
rankedSnapshots.slice(0, 20).forEach((row, index) => {
  console.log(`| ${index + 1} | ${row.source} | ${formatEt(row.cutoff)} | ${row.candidateName} | ${row.scale.toExponential(3)} | ${row.r2.toFixed(4)} | ${(row.signAccuracy * 100).toFixed(1)}% | ${money(row.holdoutRmse)} |`);
});

console.log("\n## Best state-change models\n");
console.log("These compare each contract's latest observed gamma/OI/volume state with its first session observation, rather than summing executions.\n");
console.log("| Rank | Source | Snapshot ET | Candidate | Scale | R² | Sign | Holdout RMSE |");
console.log("|---:|---|---|---|---:|---:|---:|---:|");
rankedStateChanges.slice(0, 20).forEach((row, index) => {
  console.log(`| ${index + 1} | ${row.source} | ${formatEt(row.cutoff)} | ${row.candidateName} | ${row.scale.toExponential(3)} | ${row.r2.toFixed(4)} | ${(row.signAccuracy * 100).toFixed(1)}% | ${money(row.holdoutRmse)} |`);
});

console.log("\n## Best provider-sentiment models\n");
console.log("| Rank | Source | Snapshot ET | Candidate | Scale | R² | Sign | Holdout RMSE |");
console.log("|---:|---|---|---|---:|---:|---:|---:|");
rankedSentiment.slice(0, 20).forEach((row, index) => {
  console.log(`| ${index + 1} | ${row.source} | ${formatEt(row.cutoff)} | ${row.candidateName} | ${row.scale.toExponential(3)} | ${row.r2.toFixed(4)} | ${(row.signAccuracy * 100).toFixed(1)}% | ${money(row.holdoutRmse)} |`);
});

console.log("\n## Trinity dynamic-state reconstruction\n");
console.log("These models fit the observed 09:30 → 09:45 → 10:00 node transitions as `E(t) = rho × E(t-1) + classified OPRA flow`. Ranking is by leave-one-symbol-out RMSE, so a fit that merely memorizes one underlying does not win.\n");
if (dynamicCarryMetrics) {
  console.log(`A carry-only baseline fits rho ${dynamicCarryScale.toFixed(4)}, R² ${dynamicCarryMetrics.r2.toFixed(4)}, RMSE ${money(dynamicCarryMetrics.rmse)}, and ${(dynamicCarryMetrics.directionAccuracy * 100).toFixed(1)}% change-direction accuracy. Its leave-one-symbol-out RMSE is ${money(dynamicCarryHoldoutMetrics.rmse)} with ${(dynamicCarryHoldoutMetrics.directionAccuracy * 100).toFixed(1)}% holdout change-direction accuracy. OPRA features must improve on that baseline to be meaningful.\n`);
}
console.log("| Rank | Source | Flow features | Rho | In-sample R² | Node sign | Change direction | Symbol holdout RMSE | Holdout direction | Coefficients |\n|---:|---|---|---:|---:|---:|---:|---:|---:|---|");
rankedDynamicStates.slice(0, 20).forEach((row, index) => {
  console.log(`| ${index + 1} | ${row.source} | ${row.model} | ${row.rho.toFixed(2)} | ${row.r2.toFixed(4)} | ${(row.signAccuracy * 100).toFixed(1)}% | ${(row.directionAccuracy * 100).toFixed(1)}% | ${money(row.holdoutRmse)} | ${(row.holdoutDirectionAccuracy * 100).toFixed(1)}% | ${row.weights.map((value) => value.toExponential(3)).join(" / ")} |`);
});

const bestDynamic = rankedDynamicStates[0];
if (bestDynamic) {
  console.log("\n### Best dynamic-state rows\n");
  console.log(`Best cross-symbol model: ${bestDynamic.source}; ${bestDynamic.model}; rho ${bestDynamic.rho.toFixed(2)}.\n`);
  console.log("| Symbol | Strike | Interval ET | Prior | Trinity current | Predicted current | Error |\n|---|---:|---|---:|---:|---:|---:|");
  bestDynamic.rows.forEach((row, index) => {
    const interval = `${formatEt(row.priorTime)}–${formatEt(row.currentTime)}`;
    const predicted = bestDynamic.predictions[index];
    console.log(`| ${row.ticker} | ${row.strike} | ${interval} | ${money(row.prior)} | ${money(row.current)} | ${money(predicted)} | ${money(predicted - row.current)} |`);
  });
}

const best = ranked[0];
console.log("\n## Best candidate exact rows\n");
console.log(`Source ${best.source}; snapshot ${formatEt(best.cutoff)} ET; ${best.window}; ${best.filter}; ${best.basis}; ${best.rule}; scale ${best.scale}.\n`);
console.log("| Symbol | Strike | Competitor | Candidate after scale | Error |");
console.log("|---|---:|---:|---:|---:|");
for (const row of best.rows) {
  const predicted = row.candidate * best.scale;
  console.log(`| ${row.ticker} | ${row.strike} | ${money(row.target)} | ${money(predicted)} | ${money(predicted - row.target)} |`);
}

console.log("\nJSON_RESULT=" + JSON.stringify({
  sessionDate: SESSION_DATE,
  diagnostics,
  best: {
    source: best.source,
    cutoff: new Date(best.cutoff).toISOString(),
    window: best.window,
    filter: best.filter,
    basis: best.basis,
    rule: best.rule,
    scale: best.scale,
    r2: best.r2,
    rmse: best.rmse,
    signAccuracy: best.signAccuracy,
    holdoutRmse: best.holdoutRmse,
    rows: best.rows,
  },
  top: ranked.slice(0, 100).map(({ rows: _rows, ...row }) => ({ ...row, cutoff: new Date(row.cutoff).toISOString() })),
  bucketModels: rankedBucketModels.slice(0, 50).map(({ rows: _rows, ...row }) => ({ ...row, cutoff: new Date(row.cutoff).toISOString() })),
  ternary: rankedTernary.slice(0, 50).map(({ rows: _rows, ...row }) => ({ ...row, cutoff: new Date(row.cutoff).toISOString() })),
  snapshots: rankedSnapshots.slice(0, 50).map(({ rows: _rows, ...row }) => ({ ...row, cutoff: new Date(row.cutoff).toISOString() })),
  stateChanges: rankedStateChanges.slice(0, 50).map(({ rows: _rows, ...row }) => ({ ...row, cutoff: new Date(row.cutoff).toISOString() })),
  sentiment: rankedSentiment.slice(0, 50).map(({ rows: _rows, ...row }) => ({ ...row, cutoff: new Date(row.cutoff).toISOString() })),
  dynamicStates: rankedDynamicStates.slice(0, 50).map(({ rows: _rows, predictions: _predictions, ...row }) => ({ ...row })),
  dynamicCarryBaseline: dynamicCarryMetrics ? {
    rho: dynamicCarryScale,
    ...dynamicCarryMetrics,
    holdoutRmse: dynamicCarryHoldoutMetrics.rmse,
    holdoutDirectionAccuracy: dynamicCarryHoldoutMetrics.directionAccuracy,
  } : null,
}));
