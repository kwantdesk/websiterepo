#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SESSION_DATE = "2026-08-21";
const SESSION_OPEN_ISO = "2026-08-21T13:30:00.000Z";
const CUTOFF_ISO = "2026-08-21T14:00:01.000Z";
const CUTOFF_MS = Date.parse("2026-08-21T14:00:01.000Z");

const TARGETS = {
  SPX: new Map([[7680, 21_915_800], [7675, -8_570_200], [7670, -1_731_800], [7665, -2_869_800], [7640, 11_647_200], [7610, 6_657_800]]),
  SPY: new Map([[775, -39_850_900], [770, 18_823_900], [768, 52_168_300], [767, 24_747_000], [766, -80_040_300], [765, -21_425_300], [764, 88_360_400], [763, 43_349_200], [762, 52_967_900], [761, 49_738_700], [760, 215_060_800]]),
  QQQ: new Map([[717, -52_525_000], [716, -36_899_100], [715, 10_954_000], [714, 24_884_900], [713, 10_874_000], [712, -37_668_400], [711, -16_518_800], [710, -18_047_000], [709, -59_811_800], [708, -83_276_100], [700, 29_156_700]]),
};

const MODES = ["RAW", "PER_ONE_DOLLAR_MOVE", "PER_ONE_PERCENT_MOVE"];

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
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${gatewayUrl}/v1/vendors/quantdata/v1${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${gatewayToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload;
    if (response.status === 429 && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      continue;
    }
    throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(payload)}`);
  }
  throw new Error(`${endpoint} exhausted its retry budget.`);
}

function nearestFrame(payload) {
  const data = payload?.data;
  if (!data || typeof data !== "object") return null;
  const timestamp = Object.keys(data)
    .map(Number)
    .filter((value) => Number.isFinite(value) && value <= CUTOFF_MS)
    .sort((left, right) => left - right)
    .at(-1);
  return Number.isFinite(timestamp) ? { timestamp, bucket: data[String(timestamp)] } : null;
}

function valueAtStrike(frame, strike) {
  let call = 0;
  let put = 0;
  const strikeKey = Number(strike).toFixed(1);
  for (const expiryBucket of Object.values(frame?.bucket || {})) {
    const cell = expiryBucket?.[strikeKey];
    if (!cell || typeof cell !== "object") continue;
    call += Number(cell.CALL) || 0;
    put += Number(cell.PUT) || 0;
  }
  return { call, put, net: call + put };
}

function oneFactorFit(rows, key) {
  const numerator = rows.reduce((sum, row) => sum + row[key] * row.target, 0);
  const denominator = rows.reduce((sum, row) => sum + row[key] * row[key], 0);
  const scale = denominator ? numerator / denominator : 0;
  const residuals = rows.map((row) => row.target - scale * row[key]);
  const rmse = Math.sqrt(residuals.reduce((sum, value) => sum + value * value, 0) / Math.max(1, residuals.length));
  const mean = rows.reduce((sum, row) => sum + row.target, 0) / Math.max(1, rows.length);
  const total = rows.reduce((sum, row) => sum + (row.target - mean) ** 2, 0);
  const residual = residuals.reduce((sum, value) => sum + value * value, 0);
  return { scale, rmse, r2: total ? 1 - residual / total : 0 };
}

function tradeSide(row) {
  const side = String(row?.tradeSideCode || "").toUpperCase();
  if (side.includes("ASK") || side === "A" || side === "AA") return "CUSTOMER_BUY";
  if (side.includes("BID") || side === "B" || side === "BB") return "CUSTOMER_SELL";
  return "MID";
}

async function walkConsolidated(ticker) {
  const rows = [];
  let searchAfter;
  for (let page = 0; page < 100; page += 1) {
    const body = {
      timeRange: { startTime: SESSION_OPEN_ISO, endTime: CUTOFF_ISO },
      filter: { ticker },
      size: 100,
      sort: { field: "tradeTime", direction: "ASCENDING" },
    };
    if (searchAfter?.length) body.searchAfter = searchAfter;
    const payload = await quantDataPost("/options/tool/order-flow/consolidated", body);
    if (Array.isArray(payload?.data)) rows.push(...payload.data);
    searchAfter = Array.isArray(payload?.nextSearchAfter) ? payload.nextSearchAfter : null;
    if (!searchAfter?.length) break;
  }
  return [...new Map(rows.map((row) => [String(row.id), row])).values()];
}

function tradeFeatures(rows, strike, spot) {
  const atStrike = rows.filter((row) => Number(row.strikePrice) === strike);
  const latestContracts = new Map();
  const units = {
    callMinusPut: 0,
    dealer: 0,
    directional: 0,
    sentiment: 0,
    openingDealer: 0,
    openingDirectional: 0,
  };
  for (const row of atStrike) {
    const gamma = Number(row?.greeks?.gamma);
    const size = Number(row?.size);
    const type = String(row?.contractType || "").toUpperCase();
    if (!Number.isFinite(gamma) || gamma <= 0 || !Number.isFinite(size) || size <= 0 || !["CALL", "PUT"].includes(type)) continue;
    const base = gamma * size;
    const side = tradeSide(row);
    const customerDirection = side === "CUSTOMER_BUY" ? 1 : side === "CUSTOMER_SELL" ? -1 : 0;
    const optionDirection = type === "CALL" ? 1 : -1;
    units.callMinusPut += base * optionDirection;
    units.dealer += -base * customerDirection;
    units.directional += base * customerDirection * optionDirection;
    units.sentiment += base * (String(row.sentimentType).toUpperCase().includes("BULL") ? 1 : String(row.sentimentType).toUpperCase().includes("BEAR") ? -1 : 0);
    if (row.isOpeningPosition === true) {
      units.openingDealer += -base * customerDirection;
      units.openingDirectional += base * customerDirection * optionDirection;
    }
    const key = `${row.expirationDate}:${type}`;
    const prior = latestContracts.get(key);
    if (!prior || Number(row.tradeTime) > Number(prior.tradeTime)) latestContracts.set(key, row);
  }
  let volumeSnapshot = 0;
  let oiSnapshot = 0;
  for (const row of latestContracts.values()) {
    const gamma = Number(row?.greeks?.gamma);
    const optionDirection = String(row.contractType).toUpperCase() === "CALL" ? 1 : -1;
    if (!Number.isFinite(gamma) || gamma <= 0) continue;
    volumeSnapshot += gamma * (Number(row.volume) || 0) * optionDirection;
    oiSnapshot += gamma * (Number(row.openInterest) || 0) * optionDirection;
  }
  const multiplier = 100 * spot * spot * 0.01;
  return Object.fromEntries(Object.entries({ ...units, volumeSnapshot, oiSnapshot }).map(([key, value]) => [`FLOW_${key}`, value * multiplier]));
}

const requests = await Promise.all(Object.keys(TARGETS).flatMap((ticker) => MODES.map(async (mode) => ({
  ticker,
  mode,
  payload: await quantDataPost("/options/tool/interval-map", {
    sessionDate: SESSION_DATE,
    aggregationPeriod: "1m",
    greekMode: "GAMMA",
    representationMode: mode,
    filter: { ticker },
  }),
}))));

const surfaces = new Map(requests.map(({ ticker, mode, payload }) => [`${ticker}:${mode}`, nearestFrame(payload)]));
const flowRows = new Map((await Promise.all(Object.keys(TARGETS).map(async (ticker) => [ticker, await walkConsolidated(ticker)]))).map(([ticker, rows]) => [ticker, rows]));
const rows = [];
for (const [ticker, targets] of Object.entries(TARGETS)) {
  for (const [strike, target] of targets) {
    const row = { ticker: ticker === "SPX" ? "SPXW" : ticker, strike, target };
    for (const mode of MODES) row[mode] = valueAtStrike(surfaces.get(`${ticker}:${mode}`), strike).net;
    Object.assign(row, tradeFeatures(flowRows.get(ticker), strike, ticker === "SPX" ? 7666.85 : ticker === "SPY" ? 764.8 : 711.46));
    rows.push(row);
  }
}

const money = (value) => `${value < 0 ? "-" : ""}$${Math.abs(value / 1_000_000).toFixed(2)}M`;
console.log(`# Full-chain GEX reconciliation — ${SESSION_DATE} 10:00 ET\n`);
console.log("| Ticker | Strike | Competitor | Raw | Per $1 | Per 1% |");
console.log("|---|---:|---:|---:|---:|---:|");
for (const row of rows) console.log(`| ${row.ticker} | ${row.strike} | ${money(row.target)} | ${money(row.RAW)} | ${money(row.PER_ONE_DOLLAR_MOVE)} | ${money(row.PER_ONE_PERCENT_MOVE)} |`);
console.log("\n| Candidate | Best scale | R² | RMSE |");
console.log("|---|---:|---:|---:|");
for (const mode of MODES) {
  const fit = oneFactorFit(rows, mode);
  console.log(`| ${mode} | ${fit.scale.toFixed(6)} | ${fit.r2.toFixed(4)} | ${money(fit.rmse)} |`);
}
for (const key of Object.keys(rows[0]).filter((key) => key.startsWith("FLOW_"))) {
  const fit = oneFactorFit(rows, key);
  console.log(`| ${key} | ${fit.scale.toFixed(6)} | ${fit.r2.toFixed(4)} | ${money(fit.rmse)} |`);
}
console.log("\nFrames:");
for (const [key, frame] of surfaces) console.log(`- ${key}: ${new Date(frame.timestamp).toISOString()}`);
console.log("\nConsolidated OPRA-style prints through 10:00 ET:");
for (const [ticker, tickerRows] of flowRows) console.log(`- ${ticker}: ${tickerRows.length} rows`);
