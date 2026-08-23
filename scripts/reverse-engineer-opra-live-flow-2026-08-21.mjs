#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SESSION_DATE = "2026-08-21";
const SESSION_OPEN_MS = Date.parse("2026-08-21T13:30:00.000Z");
const FETCH_END_MS = Date.parse("2026-08-21T14:03:00.000Z");
const CONTRACT_MULTIPLIER = 100;

const TARGETS = {
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

const TRINITY_STATE_HISTORY = {
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
const gatewayUrl = String(env.KWANTIFY_MARKET_DATA_GATEWAY_URL || "").replace(/\/$/, "");
const gatewayToken = String(env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN || "");
if (!gatewayUrl || !gatewayToken) throw new Error("The VPS market-data gateway is not configured.");

async function quantDataPost(endpoint, body) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(`${gatewayUrl}/v1/vendors/quantdata/v1${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${gatewayToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
  const strategy = textAt(row, "strategy", "strategyType", "detectedStrategy");
  const multiLeg = row?.isMultiLeg === true || row?.multiLeg === true || row?.complexTrade === true || Boolean(strategy);
  const opening = row?.isOpeningPosition === true || row?.opening === true;
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
  };
}

async function walkStrikeTape(endpoint, ticker, strike, includeComprisingTrades = false) {
  const rows = [];
  let searchAfter;
  for (let page = 0; page < 40; page += 1) {
    const body = {
      timeRange: { startTime: new Date(SESSION_OPEN_MS).toISOString(), endTime: new Date(FETCH_END_MS).toISOString() },
      filter: { ticker, expirationDate: SESSION_DATE, strikePrice: strike },
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
      id: textAt(child, "id", "tradeId", "eventId") || `${textAt(parent, "id", "tradeId", "eventId") || parentIndex}:child:${childIndex}`,
      comprisingTrades: undefined,
    }))
    : []);
}

function dedupe(rows, source) {
  const normalized = rows
    .map((row) => normalizeTrade(row, source))
    .filter((row) => row.expirationDate === SESSION_DATE && Number.isFinite(row.strike) && row.type !== "UNKNOWN" && row.size > 0 && row.timestamp > 0);
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
    consolidated: dedupe(consolidatedRaw, "consolidated"),
    raw: dedupe(rawResult, "raw"),
    comprising: dedupe(comprisingRows(consolidatedRaw), "comprising"),
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

for (const source of ["comprising", "consolidated"]) {
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

for (const source of ["comprising", "consolidated"]) {
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

for (const source of ["comprising", "consolidated"]) {
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
