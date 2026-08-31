#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SESSION_DATE = "2026-08-21";
const EXPIRATION = "2026-08-21";
const END = "2026-08-21T14:00:01.000Z";
const START = process.env.TRINITY_HISTORY_START || "2026-08-17T00:00:00.000Z";
const TARGET_FILE = process.env.TRINITY_FULL_LATTICES
  || "C:/Users/Karen/AppData/Local/Temp/trinity-full-lattices-2026-08-21.json";
const CACHE_FILE = path.resolve(`tmp/trinity-inventory-tape-${START.slice(0, 10)}-to-${SESSION_DATE}.json`);

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
  nextRequestAt = Math.max(Date.now(), nextRequestAt) + 250;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const response = await fetch(`${gatewayUrl}/v1/vendors/quantdata/v1${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${gatewayToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload;
    if (response.status === 429 && attempt < 6) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      continue;
    }
    throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(payload)}`);
  }
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberAt(row, ...keys) {
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => current && typeof current === "object" ? current[part] : undefined, row);
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function textAt(row, ...keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function optionTypeAt(row) {
  const raw = textAt(row, "contractType", "optionType", "putCall").toUpperCase();
  if (raw.includes("CALL") || raw === "C") return "CALL";
  if (raw.includes("PUT") || raw === "P") return "PUT";
  return "UNKNOWN";
}

function customerSideAt(row) {
  const raw = textAt(row, "tradeSideCode", "tradeSide", "side").toUpperCase();
  if (raw.includes("ASK") || raw === "A" || raw === "AA") return "BUY";
  if (raw.includes("BID") || raw === "B" || raw === "BB") return "SELL";
  return "MID";
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
  const timestamp = timestampAt(row);
  const strike = numberAt(row, "strikePrice", "strike");
  const type = optionTypeAt(row);
  const size = Math.max(0, numberAt(row, "size", "quantity", "contracts", "totalSize"));
  const side = customerSideAt(row);
  return {
    ticker,
    id: textAt(row, "id", "tradeId", "eventId") || `${ticker}:${timestamp}:${strike}:${type}:${size}:${side}`,
    timestamp,
    expiration: textAt(row, "expirationDate", "expiration", "expiry"),
    strike,
    type,
    side,
    size,
  };
}

async function walkTicker(ticker) {
  const parents = [];
  let searchAfter;
  for (let page = 0; page < 1000; page += 1) {
    const body = {
      timeRange: { startTime: START, endTime: END },
      filter: { ticker, expirationDate: EXPIRATION },
      size: 100,
      sort: { field: "tradeTime", direction: "ASCENDING" },
      includeComprisingTrades: true,
    };
    if (searchAfter?.length) body.searchAfter = searchAfter;
    const payload = await quantDataPost("/options/tool/order-flow/consolidated", body);
    if (Array.isArray(payload?.data)) parents.push(...payload.data);
    searchAfter = Array.isArray(payload?.nextSearchAfter) ? payload.nextSearchAfter : null;
    if ((page + 1) % 50 === 0) console.error(`${ticker}: ${page + 1} pages, ${parents.length} parents`);
    if (!searchAfter?.length) break;
  }
  const flattened = flattenParents(parents);
  return [...new Map(flattened.map((row) => {
    const trade = normalize(row, ticker);
    return [trade.id, trade];
  })).values()].filter((trade) => trade.timestamp && trade.expiration === EXPIRATION && trade.strike && trade.size > 0 && trade.type !== "UNKNOWN");
}

function strikeKey(strike) {
  return Number(strike).toFixed(1);
}

function oiAt(payload, strike) {
  const data = payload?.data;
  if (!data || typeof data !== "object") return {};
  return data[strikeKey(strike)] ?? data[String(Number(strike))] ?? {};
}

function exposureMap(payload, ticker) {
  const root = payload?.data?.[ticker] ?? payload?.data;
  return root?.exposureMap?.[EXPIRATION] ?? {};
}

function exposureAt(map, strike) {
  return map[strikeKey(strike)] ?? map[String(Number(strike))] ?? {};
}

function clip(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function stateForTrades(trades) {
  const states = new Map();
  for (const trade of trades) {
    const key = `${strikeKey(trade.strike)}:${trade.type}`;
    const state = states.get(key) ?? { dealerNet: 0, directionalVolume: 0, totalClassified: 0 };
    if (trade.side === "BUY") {
      state.dealerNet -= trade.size;
      state.directionalVolume -= trade.size;
      state.totalClassified += trade.size;
    } else if (trade.side === "SELL") {
      state.dealerNet += trade.size;
      state.directionalVolume += trade.size;
      state.totalClassified += trade.size;
    }
    states.set(key, state);
  }
  return states;
}

function metrics(rows, feature) {
  const x = rows.map((row) => row[feature]);
  const y = rows.map((row) => row.target);
  const numerator = x.reduce((sum, value, index) => sum + value * y[index], 0);
  const denominator = x.reduce((sum, value) => sum + value * value, 0);
  const scale = denominator ? numerator / denominator : 0;
  const predictions = x.map((value) => value * scale);
  const mean = y.reduce((sum, value) => sum + value, 0) / y.length;
  const sse = y.reduce((sum, value, index) => sum + (value - predictions[index]) ** 2, 0);
  const sst = y.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const sign = y.reduce((sum, value, index) => sum + (Math.sign(value) === Math.sign(predictions[index]) ? 1 : 0), 0) / y.length;
  return { feature, scale, r2: sst ? 1 - sse / sst : 0, rmse: Math.sqrt(sse / y.length), sign };
}

function holdout(rows, feature) {
  const errors = [];
  const signs = [];
  for (const symbol of ["SPXW", "SPY", "QQQ"]) {
    const train = rows.filter((row) => row.symbol !== symbol);
    const test = rows.filter((row) => row.symbol === symbol);
    const fit = metrics(train, feature);
    for (const row of test) {
      const prediction = row[feature] * fit.scale;
      errors.push((row.target - prediction) ** 2);
      signs.push(Math.sign(row.target) === Math.sign(prediction) ? 1 : 0);
    }
  }
  return {
    rmse: Math.sqrt(errors.reduce((sum, value) => sum + value, 0) / errors.length),
    sign: signs.reduce((sum, value) => sum + value, 0) / signs.length,
  };
}

function money(value) {
  const absolute = Math.abs(value);
  if (absolute >= 1e9) return `${value < 0 ? "-" : ""}$${(absolute / 1e9).toFixed(2)}B`;
  return `${value < 0 ? "-" : ""}$${(absolute / 1e6).toFixed(2)}M`;
}

let tape;
if (fs.existsSync(CACHE_FILE)) {
  console.error(`Reading cached tape ${CACHE_FILE}`);
  tape = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
} else {
  tape = {};
  for (const ticker of ["SPX", "SPY", "QQQ"]) {
    console.error(`Fetching ${ticker} from ${START}...`);
    tape[ticker] = await walkTicker(ticker);
    console.error(`${ticker}: ${tape[ticker].length} normalized prints`);
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(tape));
}

const source = {};
for (const ticker of ["SPX", "SPY", "QQQ"]) {
  const [oi, exposure] = await Promise.all([
    quantDataPost("/options/tool/open-interest-by-strike", {
      sessionDate: SESSION_DATE,
      filter: { ticker, expirationDate: EXPIRATION },
    }),
    quantDataPost("/options/tool/exposure-by-strike", {
      sessionDate: SESSION_DATE,
      greekMode: "GAMMA",
      representationMode: "PER_ONE_PERCENT_MOVE",
      filter: { ticker, expirationDate: EXPIRATION },
    }),
  ]);
  source[ticker] = { oi, exposure: exposureMap(exposure, ticker), state: stateForTrades(tape[ticker] ?? []) };
}

const targetPayload = JSON.parse(fs.readFileSync(TARGET_FILE, "utf8"));
const target = targetPayload?.targets?.["1000"];
if (!target) throw new Error("Trinity target file has no 10:00 ET lattice.");
const tickerBySymbol = { SPX: "SPX", SPXW: "SPX", SPY: "SPY", QQQ: "QQQ" };
const rows = [];
for (const [inputSymbol, nodes] of Object.entries(target)) {
  const symbol = inputSymbol === "SPX" ? "SPXW" : inputSymbol;
  const ticker = tickerBySymbol[symbol];
  const data = source[ticker];
  for (const node of nodes) {
    const strike = numeric(node.strike);
    const oi = oiAt(data.oi, strike);
    const risk = exposureAt(data.exposure, strike);
    const callOi = Math.max(0, numeric(oi.callOpenInterest));
    const putOi = Math.max(0, numeric(oi.putOpenInterest));
    const callUnit = callOi ? Math.abs(numeric(risk.callExposure)) / callOi : 0;
    const putUnit = putOi ? Math.abs(numeric(risk.putExposure)) / putOi : 0;
    const call = data.state.get(`${strikeKey(strike)}:CALL`) ?? { dealerNet: 0, directionalVolume: 0, totalClassified: 0 };
    const put = data.state.get(`${strikeKey(strike)}:PUT`) ?? { dealerNet: 0, directionalVolume: 0, totalClassified: 0 };
    const callRatio = call.totalClassified ? call.directionalVolume / call.totalClassified : 0;
    const putRatio = put.totalClassified ? put.directionalVolume / put.totalClassified : 0;
    const variants = {
      raw: call.dealerNet * callUnit + put.dealerNet * putUnit,
      clipped: clip(call.dealerNet, -callOi, callOi) * callUnit + clip(put.dealerNet, -putOi, putOi) * putUnit,
      tanh: callOi * Math.tanh(callOi ? call.dealerNet / callOi : 0) * callUnit
        + putOi * Math.tanh(putOi ? put.dealerNet / putOi : 0) * putUnit,
      oiRatio: callOi * callRatio * callUnit + putOi * putRatio * putUnit,
      oiRatioCallMinusPut: callOi * callRatio * callUnit - putOi * putRatio * putUnit,
      oiNetRatio: (callOi + putOi) * ((call.directionalVolume + put.directionalVolume)
        / Math.max(call.totalClassified + put.totalClassified, 1)) * ((callUnit + putUnit) / 2),
    };
    rows.push({ symbol, ticker, strike, target: numeric(node.value), callOi, putOi, callNet: call.dealerNet, putNet: put.dealerNet, ...variants });
  }
}

const features = ["raw", "clipped", "tanh", "oiRatio", "oiRatioCallMinusPut", "oiNetRatio"];
const results = features.map((feature) => ({ ...metrics(rows, feature), holdout: holdout(rows, feature) }))
  .sort((left, right) => right.holdout.rmse - left.holdout.rmse);
results.sort((left, right) => left.holdout.rmse - right.holdout.rmse);

console.log(`# Trinity OI-bounded inventory test — ${SESSION_DATE} 10:00 ET`);
console.log(`\nHistory: ${START} to ${END}; rows=${rows.length}; prints=${Object.entries(tape).map(([key, value]) => `${key}:${value.length}`).join(", ")}.`);
console.log("\n| Inventory estimator | Scale | R² | RMSE | Sign | Symbol-holdout RMSE | Holdout sign |");
console.log("|---|---:|---:|---:|---:|---:|---:|");
for (const result of results) {
  console.log(`| ${result.feature} | ${result.scale.toFixed(5)} | ${result.r2.toFixed(4)} | ${money(result.rmse)} | ${(result.sign * 100).toFixed(1)}% | ${money(result.holdout.rmse)} | ${(result.holdout.sign * 100).toFixed(1)}% |`);
}

const focus = new Set([7680, 7675, 7640, 775, 768, 766, 764, 760, 717, 714, 708, 700]);
console.log("\n| Symbol | Strike | Trinity | Raw | Clipped | Tanh | OI ratio | Call OI/net | Put OI/net |");
console.log("|---|---:|---:|---:|---:|---:|---:|---|---|");
for (const row of rows.filter((item) => focus.has(item.strike))) {
  console.log(`| ${row.symbol} | ${row.strike} | ${money(row.target)} | ${money(row.raw)} | ${money(row.clipped)} | ${money(row.tanh)} | ${money(row.oiRatio)} | ${row.callOi}/${row.callNet} | ${row.putOi}/${row.putNet} |`);
}

fs.writeFileSync(path.resolve(`tmp/trinity-oi-bounded-fit-${START.slice(0, 10)}.json`), JSON.stringify({
  history: { start: START, end: END },
  results,
  rows,
  counts: Object.fromEntries(Object.entries(tape).map(([key, value]) => [key, value.length])),
}, null, 2));
