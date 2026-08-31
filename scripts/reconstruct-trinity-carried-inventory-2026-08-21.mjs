#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const START = "2026-08-17T00:00:00.000Z";
const END = "2026-08-21T14:00:01.000Z";
const SESSION_DATE = "2026-08-21";
const CONTRACT_MULTIPLIER = 100;

const TARGETS = {
  SPX: { spot: 7665.14, strikes: new Map([[7680, 21_915_800], [7675, -8_570_200], [7640, 11_647_200]]) },
  SPY: { spot: 764.45, strikes: new Map([[775, -39_850_900], [768, 52_168_300], [766, -80_040_300], [764, 88_360_400], [760, 215_060_800]]) },
  QQQ: { spot: 711.55, strikes: new Map([[717, -52_525_000], [714, 24_884_900], [708, -83_276_100], [700, 29_156_700]]) },
};

function readDotEnv(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) values[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

const env = { ...readDotEnv(path.resolve(process.cwd(), ".env.local")), ...process.env };
const gatewayUrl = String(env.KWANTIFY_MARKET_DATA_GATEWAY_URL || "").replace(/\/$/, "");
const gatewayToken = String(env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN || "");
if (!gatewayUrl || !gatewayToken) throw new Error("The VPS market-data gateway is not configured.");

let nextRequestAt = 0;
async function quantDataPost(endpoint, body) {
  const wait = Math.max(0, nextRequestAt - Date.now());
  nextRequestAt = Math.max(Date.now(), nextRequestAt) + 300;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(`${gatewayUrl}/v1/vendors/quantdata/v1${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${gatewayToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload;
    if (response.status === 429 && attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 800 * 2 ** attempt));
      continue;
    }
    throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(payload)}`);
  }
}

function numberAt(row, ...keys) {
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => current && typeof current === "object" ? current[part] : undefined, row);
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
  const raw = textAt(row, "contractType", "optionType", "putCall").toUpperCase();
  return raw.includes("CALL") || raw === "C" ? "CALL" : raw.includes("PUT") || raw === "P" ? "PUT" : "UNKNOWN";
}

function sideAt(row) {
  const raw = textAt(row, "tradeSideCode", "tradeSide", "side").toUpperCase();
  if (raw.includes("ASK") || raw === "A" || raw === "AA") return "BUY";
  if (raw.includes("BID") || raw === "B" || raw === "BB") return "SELL";
  return "MID";
}

function flattenParents(parents) {
  return parents.flatMap((parent, parentIndex) => {
    const children = Array.isArray(parent?.comprisingTrades) ? parent.comprisingTrades : [];
    if (!children.length) return [{ ...parent, _source: "PARENT" }];
    return children.map((child, childIndex) => ({
      ...parent,
      ...child,
      id: textAt(child, "id", "tradeId", "eventId") || `${textAt(parent, "id", "tradeId", "eventId") || parentIndex}:${childIndex}`,
      comprisingTrades: undefined,
      _source: "CHILD",
    }));
  });
}

function normalize(row, ticker) {
  const type = optionTypeAt(row);
  const side = sideAt(row);
  const size = Math.max(0, numberAt(row, "size", "quantity", "contracts", "totalSize") ?? 0);
  const gamma = Math.max(0, numberAt(row, "gamma", "greeks.gamma") ?? 0);
  const expiration = textAt(row, "expirationDate", "expiration", "expiry");
  const strike = numberAt(row, "strikePrice", "strike");
  const timestamp = timestampAt(row);
  const openingRaw = row?.isOpeningPosition ?? row?.opening;
  const closingRaw = row?.isClosingPosition ?? row?.closing;
  return {
    ticker,
    id: textAt(row, "id", "tradeId", "eventId") || `${ticker}:${timestamp}:${expiration}:${strike}:${type}:${size}`,
    timestamp,
    expiration,
    strike,
    type,
    side,
    size,
    gamma,
    stockPrice: numberAt(row, "stockPrice", "underlyingPrice", "spotPrice"),
    openInterest: numberAt(row, "openInterest", "oi"),
    previousOpenInterest: numberAt(row, "previousOpenInterest", "priorOpenInterest", "previousOi"),
    opening: openingRaw === true,
    closing: closingRaw === true,
    openingRaw,
    closingRaw,
    sentiment: textAt(row, "sentimentType", "sentiment", "direction"),
    strategy: textAt(row, "strategy", "strategyType", "detectedStrategy"),
    source: row?._source,
    keys: Object.keys(row).sort(),
  };
}

async function walkTicker(ticker) {
  const rows = [];
  let searchAfter;
  for (let page = 0; page < 200; page += 1) {
    const body = {
      timeRange: { startTime: START, endTime: END },
      filter: { ticker, expirationDate: SESSION_DATE },
      size: 100,
      sort: { field: "tradeTime", direction: "ASCENDING" },
      includeComprisingTrades: true,
    };
    if (searchAfter?.length) body.searchAfter = searchAfter;
    const payload = await quantDataPost("/options/tool/order-flow/consolidated", body);
    if (Array.isArray(payload?.data)) rows.push(...payload.data);
    searchAfter = Array.isArray(payload?.nextSearchAfter) ? payload.nextSearchAfter : null;
    if (!searchAfter?.length) break;
  }
  return rows;
}

function exposureUnit(trade, configuredSpot) {
  const spot = trade.stockPrice && trade.stockPrice > 0 ? trade.stockPrice : configuredSpot;
  return trade.gamma * CONTRACT_MULTIPLIER * spot * spot * 0.01;
}

function dealerTradeSign(trade) {
  // Customer buy => dealer sells the option; customer sell => dealer buys it.
  if (trade.side === "BUY") return -1;
  if (trade.side === "SELL") return 1;
  return 0;
}

function calculateVariants(trades, ticker, strike) {
  const configuredSpot = TARGETS[ticker].spot;
  const atStrike = trades.filter((trade) => trade.strike === strike && trade.expiration === SESSION_DATE);
  const variants = {
    allDealer: 0,
    openingDealer: 0,
    simpleOpeningDealer: 0,
    callPutDirectional: 0,
    openingCallPutDirectional: 0,
  };
  for (const trade of atStrike) {
    const base = trade.size * exposureUnit(trade, configuredSpot);
    const dealer = dealerTradeSign(trade);
    const optionDirection = trade.type === "CALL" ? 1 : trade.type === "PUT" ? -1 : 0;
    variants.allDealer += dealer * base;
    variants.callPutDirectional += dealer * optionDirection * base;
    if (trade.opening) {
      variants.openingDealer += dealer * base;
      variants.openingCallPutDirectional += dealer * optionDirection * base;
      if (!trade.strategy) variants.simpleOpeningDealer += dealer * base;
    }
  }
  return { rows: atStrike.length, ...variants };
}

function money(value) {
  return `${value < 0 ? "-" : ""}$${Math.abs(value / 1_000_000).toFixed(2)}M`;
}

const all = new Map();
for (const ticker of Object.keys(TARGETS)) {
  console.error(`Fetching ${ticker} carried history...`);
  const parents = await walkTicker(ticker);
  const flattened = flattenParents(parents);
  const trades = [...new Map(flattened.map((row) => {
    const normalized = normalize(row, ticker);
    return [normalized.id, normalized];
  })).values()]
    .filter((trade) => trade.timestamp && trade.expiration === SESSION_DATE && trade.size > 0 && trade.gamma > 0)
    .sort((left, right) => left.timestamp - right.timestamp);
  all.set(ticker, { parents, flattened, trades });
}

console.log(`# Trinity carried-inventory reconstruction — ${SESSION_DATE} 10:00 ET\n`);
for (const [ticker, { parents, flattened, trades }] of all) {
  const byDate = Object.groupBy(trades, (trade) => new Date(trade.timestamp).toISOString().slice(0, 10));
  const openingCount = trades.filter((trade) => trade.opening).length;
  const closingCount = trades.filter((trade) => trade.closing).length;
  const knownOpeningField = trades.filter((trade) => typeof trade.openingRaw === "boolean").length;
  const knownClosingField = trades.filter((trade) => typeof trade.closingRaw === "boolean").length;
  console.log(`## ${ticker}`);
  console.log(`- parents=${parents.length}, flattened=${flattened.length}, normalized=${trades.length}`);
  console.log(`- dates=${Object.entries(byDate).map(([date, rows]) => `${date}:${rows.length}`).join(", ") || "none"}`);
  console.log(`- opening=${openingCount}/${knownOpeningField} boolean-tagged; closing=${closingCount}/${knownClosingField} boolean-tagged`);
  console.log(`- sample keys=${trades[0]?.keys.join(", ") || "none"}\n`);
}

console.log("| Symbol | Strike | Trinity | All dealer tape | Opening dealer | Simple opening | Dealer directional | Opening directional |");
console.log("|---|---:|---:|---:|---:|---:|---:|---:|");
const comparison = [];
for (const [ticker, target] of Object.entries(TARGETS)) {
  for (const [strike, expected] of target.strikes) {
    const result = calculateVariants(all.get(ticker).trades, ticker, strike);
    comparison.push({ ticker, strike, expected, ...result });
    console.log(`| ${ticker === "SPX" ? "SPXW" : ticker} | ${strike} | ${money(expected)} | ${money(result.allDealer)} | ${money(result.openingDealer)} | ${money(result.simpleOpeningDealer)} | ${money(result.callPutDirectional)} | ${money(result.openingCallPutDirectional)} |`);
  }
}

function fit(key) {
  const numerator = comparison.reduce((sum, row) => sum + row[key] * row.expected, 0);
  const denominator = comparison.reduce((sum, row) => sum + row[key] ** 2, 0);
  const scale = denominator ? numerator / denominator : 0;
  const mean = comparison.reduce((sum, row) => sum + row.expected, 0) / comparison.length;
  const residual = comparison.reduce((sum, row) => sum + (row.expected - scale * row[key]) ** 2, 0);
  const total = comparison.reduce((sum, row) => sum + (row.expected - mean) ** 2, 0);
  return { scale, r2: total ? 1 - residual / total : 0, rmse: Math.sqrt(residual / comparison.length) };
}

console.log("\n| Variant | Scale | R² | RMSE |");
console.log("|---|---:|---:|---:|");
for (const key of ["allDealer", "openingDealer", "simpleOpeningDealer", "callPutDirectional", "openingCallPutDirectional"]) {
  const result = fit(key);
  console.log(`| ${key} | ${result.scale.toFixed(6)} | ${result.r2.toFixed(4)} | ${money(result.rmse)} |`);
}

fs.writeFileSync(path.resolve("tmp/trinity-carried-inventory-raw-summary.json"), JSON.stringify({
  window: { start: START, end: END },
  comparison,
  diagnostics: Object.fromEntries([...all].map(([ticker, value]) => [ticker, {
    parents: value.parents.length,
    flattened: value.flattened.length,
    normalized: value.trades.length,
    samples: value.trades.slice(0, 3),
  }])),
}, null, 2));
