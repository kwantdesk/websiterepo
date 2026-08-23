#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SESSION_DATE = "2026-08-21";
const CUTOFF_ISO = "2026-08-21T14:00:01.000Z"; // 10:00:01 America/New_York.
const SESSION_OPEN_ISO = "2026-08-21T13:30:00.000Z";

// Values transcribed from the supplied competitor screenshot. Units are USD.
const TARGETS = {
  SPX: {
    providerLabel: "SPXW",
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
    providerLabel: "SPY",
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
    providerLabel: "QQQ",
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
if (!gatewayUrl || !gatewayToken) {
  throw new Error("The VPS market-data gateway is not configured in .env.local.");
}

async function quantDataPost(endpoint, body) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${gatewayUrl}/v1/vendors/quantdata/v1${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gatewayToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload;
    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      continue;
    }
    throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(payload)}`);
  }
  throw new Error(`${endpoint} exhausted its retry budget.`);
}

function atOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function canonicalSide(row) {
  const side = String(row.tradeSideCode || row.tradeSide || "").toUpperCase();
  if (side.includes("ASK") || side === "AA" || side === "A") return "CUSTOMER_BUY";
  if (side.includes("BID") || side === "BB" || side === "B") return "CUSTOMER_SELL";
  return "MID";
}

function latestByContract(rows) {
  const result = new Map();
  for (const row of [...rows].sort((left, right) => atOrZero(right.tradeTime) - atOrZero(left.tradeTime))) {
    const type = String(row.contractType || "").toUpperCase();
    const strike = Number(row.strikePrice);
    if (!Number.isFinite(strike) || !["CALL", "PUT"].includes(type)) continue;
    const key = `${strike}:${type}`;
    if (!result.has(key)) result.set(key, row);
  }
  return result;
}

function interpolateGamma(strike, type, contractRows) {
  const direct = contractRows.get(`${strike}:${type}`);
  const directGamma = Number(direct?.greeks?.gamma);
  if (Number.isFinite(directGamma) && directGamma > 0) return { gamma: directGamma, source: "DIRECT" };

  // Black-Scholes call and put gamma are identical for the same volatility.
  const opposite = contractRows.get(`${strike}:${type === "CALL" ? "PUT" : "CALL"}`);
  const oppositeGamma = Number(opposite?.greeks?.gamma);
  if (Number.isFinite(oppositeGamma) && oppositeGamma > 0) return { gamma: oppositeGamma, source: "OPPOSITE_LEG" };

  const candidates = [...contractRows.entries()]
    .flatMap(([key, row]) => {
      const [candidateStrike, candidateType] = key.split(":");
      const gamma = Number(row?.greeks?.gamma);
      return candidateType === type && Number.isFinite(gamma) && gamma > 0
        ? [{ strike: Number(candidateStrike), gamma }]
        : [];
    })
    .sort((left, right) => left.strike - right.strike);
  const below = [...candidates].reverse().find((row) => row.strike < strike);
  const above = candidates.find((row) => row.strike > strike);
  if (below && above) {
    const weight = (strike - below.strike) / (above.strike - below.strike);
    return { gamma: below.gamma + (above.gamma - below.gamma) * weight, source: "INTERPOLATED" };
  }
  const nearest = candidates.sort((left, right) => Math.abs(left.strike - strike) - Math.abs(right.strike - strike))[0];
  return nearest ? { gamma: nearest.gamma, source: "NEAREST" } : { gamma: 0, source: "MISSING" };
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

function safeRatio(numerator, denominator) {
  return Number.isFinite(numerator) && Number.isFinite(denominator) && Math.abs(denominator) > 1e-9
    ? numerator / denominator
    : null;
}

function sideVolumes(payload, type) {
  const node = payload?.data?.[type] || {};
  return {
    customerBuy: atOrZero(node.ABOVE_ASK?.volume) + atOrZero(node.ASK?.volume),
    customerSell: atOrZero(node.BID?.volume) + atOrZero(node.BELOW_BID?.volume),
    mid: atOrZero(node.MID_MARKET?.volume),
  };
}

async function exactTradeSide(ticker, strike, type) {
  const payload = await quantDataPost("/options/tool/contract-trade-side-statistics", {
    timeRange: { startTime: SESSION_OPEN_ISO, endTime: CUTOFF_ISO },
    dataMode: "VOLUME",
    filter: {
      ticker,
      expirationDate: SESSION_DATE,
      strikePrice: strike,
      contractType: type,
    },
  });
  return sideVolumes(payload, type);
}

const samplingCutoffs = [
  "2026-08-21T14:00:01.000Z",
  "2026-08-21T13:58:00.000Z",
  "2026-08-21T13:55:00.000Z",
  "2026-08-21T13:50:00.000Z",
  "2026-08-21T13:45:00.000Z",
  "2026-08-21T13:40:00.000Z",
  "2026-08-21T13:35:00.000Z",
];

const outputRows = [];
const diagnostics = [];

for (const [ticker, target] of Object.entries(TARGETS)) {
  const oiPayload = await quantDataPost("/options/tool/open-interest-by-strike", {
    sessionDate: SESSION_DATE,
    filter: { ticker, expirationDate: SESSION_DATE },
  });

  const sampledRows = [];
  for (const endTime of samplingCutoffs) {
    const payload = await quantDataPost("/options/tool/order-flow/consolidated", {
      timeRange: { startTime: SESSION_OPEN_ISO, endTime },
      filter: { ticker, expirationDate: SESSION_DATE },
      size: 100,
      sort: { field: "tradeTime", direction: "DESCENDING" },
    });
    sampledRows.push(...(Array.isArray(payload.data) ? payload.data : []));
  }

  const dedupedRows = [...new Map(sampledRows.map((row) => [String(row.id), row])).values()]
    .filter((row) => Number(row.tradeTime) <= Date.parse(CUTOFF_ISO));
  const contracts = latestByContract(dedupedRows);
  diagnostics.push({ ticker, sampledPrints: sampledRows.length, uniquePrints: dedupedRows.length, contracts: contracts.size });

  for (const [strike, targetValue] of target.values) {
    const oiNode = oiPayload?.data?.[strike.toFixed(1)] || {};
    const callOi = atOrZero(oiNode.callOpenInterest);
    const putOi = atOrZero(oiNode.putOpenInterest);
    const call = interpolateGamma(strike, "CALL", contracts);
    const put = interpolateGamma(strike, "PUT", contracts);
    const callRow = contracts.get(`${strike}:CALL`);
    const putRow = contracts.get(`${strike}:PUT`);
    const callVolume = atOrZero(callRow?.volume);
    const putVolume = atOrZero(putRow?.volume);
    const spot = target.spot;
    const perOnePercentMultiplier = 100 * spot * spot * 0.01;
    const perOneDollarMultiplier = 100 * spot;

    const [callSides, putSides] = await Promise.all([
      exactTradeSide(ticker, strike, "CALL"),
      exactTradeSide(ticker, strike, "PUT"),
    ]);

    // Common open-interest convention: calls positive, puts negative.
    const oiGammaUnits = call.gamma * callOi - put.gamma * putOi;
    const grossOiGammaUnits = call.gamma * callOi + put.gamma * putOi;
    const volumeGammaUnits = call.gamma * callVolume - put.gamma * putVolume;

    // Intraday dealer GEX sampled from trade prints. A customer buy at the ask
    // leaves the dealer short gamma; a customer sale at the bid leaves it long.
    const sampledDealerUnits = dedupedRows
      .filter((row) => Number(row.strikePrice) === strike)
      .reduce((sum, row) => {
        const gamma = Number(row?.greeks?.gamma);
        const size = Number(row?.size);
        if (!Number.isFinite(gamma) || !Number.isFinite(size)) return sum;
        const side = canonicalSide(row);
        if (side === "CUSTOMER_BUY") return sum - gamma * size;
        if (side === "CUSTOMER_SELL") return sum + gamma * size;
        return sum;
      }, 0);

    // OPRA does not publish an aggressor flag. The source service classifies
    // prints against the contemporaneous NBBO: ask/above ask is a customer
    // purchase (dealer sells gamma), bid/below bid is a customer sale (dealer
    // buys gamma). Mid-market prints are deliberately left unassigned.
    const callCustomerNet = callSides.customerBuy - callSides.customerSell;
    const putCustomerNet = putSides.customerBuy - putSides.customerSell;
    const exactDealerGammaUnits = -(
      call.gamma * callCustomerNet
      + put.gamma * putCustomerNet
    );
    const directionalCustomerGammaUnits = (
      call.gamma * callCustomerNet
      - put.gamma * putCustomerNet
    );

    outputRows.push({
      ticker: target.providerLabel,
      strike,
      target: targetValue,
      callOi,
      putOi,
      callGamma: call.gamma,
      putGamma: put.gamma,
      callGammaSource: call.source,
      putGammaSource: put.source,
      callVolume,
      putVolume,
      grossOiPerOnePercent: grossOiGammaUnits * perOnePercentMultiplier,
      oiPerOnePercent: oiGammaUnits * perOnePercentMultiplier,
      oiPerOneDollar: oiGammaUnits * perOneDollarMultiplier,
      volumePerOnePercent: volumeGammaUnits * perOnePercentMultiplier,
      sampledDealerPerOnePercent: sampledDealerUnits * perOnePercentMultiplier,
      exactDealerFlowPerOnePercent: exactDealerGammaUnits * perOnePercentMultiplier,
      directionalCustomerFlowPerOnePercent: directionalCustomerGammaUnits * perOnePercentMultiplier,
      callCustomerNet,
      putCustomerNet,
    });
  }
}

for (const row of outputRows) {
  row.impliedSignedGrossOiShare = safeRatio(row.target, row.grossOiPerOnePercent);
  row.impliedStructuralScale = safeRatio(row.target, row.oiPerOnePercent);
  row.impliedExactFlowScale = safeRatio(row.target, row.exactDealerFlowPerOnePercent);
}

const featureKeys = [
  "oiPerOnePercent",
  "oiPerOneDollar",
  "volumePerOnePercent",
  "sampledDealerPerOnePercent",
  "exactDealerFlowPerOnePercent",
  "directionalCustomerFlowPerOnePercent",
];
const fits = Object.fromEntries(featureKeys.map((key) => [key, oneFactorFit(outputRows, key)]));

const money = (value) => Number.isFinite(value)
  ? `${value < 0 ? "-" : ""}$${Math.abs(value / 1_000_000).toFixed(2)}M`
  : "n/a";

console.log(`# OPRA-style GEX reconciliation — ${SESSION_DATE} 10:00 ET\n`);
console.log("The source snapshot is start-of-day open interest plus timestamped option greeks and consolidated executions observed through the VPS. No metered Databento historical payload was downloaded.\n");
console.log("| Ticker | Strike | Competitor | OI GEX / 1% | OI GEX / $1 | Exact dealer-flow GEX | Directional customer GEX | Gamma quality |");
console.log("|---|---:|---:|---:|---:|---:|---:|---|");
for (const row of outputRows) {
  console.log(`| ${row.ticker} | ${row.strike} | ${money(row.target)} | ${money(row.oiPerOnePercent)} | ${money(row.oiPerOneDollar)} | ${money(row.exactDealerFlowPerOnePercent)} | ${money(row.directionalCustomerFlowPerOnePercent)} | ${row.callGammaSource}/${row.putGammaSource} |`);
}
console.log("\n## One-factor fit against the competitor\n");
console.log("| Candidate | Best scale | R² | RMSE |");
console.log("|---|---:|---:|---:|");
for (const key of featureKeys) {
  const fit = fits[key];
  console.log(`| ${key} | ${fit.scale.toFixed(6)} | ${fit.r2.toFixed(4)} | ${money(fit.rmse)} |`);
}
console.log("\n## Implied latent-position diagnostics\n");
console.log("`Target / gross OI GEX` is the signed share of gross contract gamma that would have to remain in dealer inventory to reproduce Trinity at that strike. It is a diagnostic, not an observed OPRA field.\n");
console.log("| Ticker | Strike | Trinity target | Gross OI GEX / 1% | Target / gross OI GEX | Target / net OI GEX | Target / exact flow |\n|---|---:|---:|---:|---:|---:|---:|");
for (const row of outputRows) {
  const ratio = (value) => Number.isFinite(value) ? value.toFixed(4) : "n/a";
  console.log(`| ${row.ticker} | ${row.strike} | ${money(row.target)} | ${money(row.grossOiPerOnePercent)} | ${ratio(row.impliedSignedGrossOiShare)} | ${ratio(row.impliedStructuralScale)} | ${ratio(row.impliedExactFlowScale)} |`);
}
console.log("\n## Sampling diagnostics\n");
for (const row of diagnostics) {
  console.log(`- ${row.ticker}: ${row.uniquePrints} unique consolidated prints sampled; ${row.contracts} latest contract snapshots.`);
}

console.log("\nJSON_RESULT=" + JSON.stringify({
  sessionDate: SESSION_DATE,
  cutoff: CUTOFF_ISO,
  rows: outputRows,
  fits,
  diagnostics,
}));
