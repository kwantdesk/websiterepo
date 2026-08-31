#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SESSION_DATE = "2026-08-21";
const PRIOR_DATE = "2026-08-20";
const EXPIRATION = "2026-08-21";
const CHECKS = {
  SPX: [7680, 7675, 7640],
  SPY: [775, 768, 766, 764, 760],
  QQQ: [717, 714, 708, 700],
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
if (!gatewayUrl || !gatewayToken) throw new Error("The VPS market-data gateway is not configured.");

async function quantDataPost(endpoint, body) {
  const response = await fetch(`${gatewayUrl}/v1/vendors/quantdata/v1${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${gatewayToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

function nodeAt(payload, strike) {
  const data = payload?.data;
  if (!data || typeof data !== "object") return null;
  return data[strike.toFixed(1)] ?? data[String(strike)] ?? null;
}

function exposureAt(payload, ticker, strike) {
  const root = payload?.data?.[ticker] ?? payload?.data;
  if (!root || typeof root !== "object") return null;
  const expirationMap = root?.exposureMap?.[EXPIRATION];
  if (expirationMap && typeof expirationMap === "object") {
    return expirationMap[strike.toFixed(1)] ?? expirationMap[String(strike)] ?? null;
  }
  const direct = root[strike.toFixed(1)] ?? root[String(strike)];
  if (direct !== undefined) return direct;
  for (const value of Object.values(root)) {
    if (!value || typeof value !== "object") continue;
    const nested = value[strike.toFixed(1)] ?? value[String(strike)];
    if (nested !== undefined) return nested;
  }
  return null;
}

function keysOf(value) {
  return value && typeof value === "object" ? Object.keys(value).sort() : [];
}

function shapeOf(value, depth = 0) {
  if (depth >= 4 || value === null || typeof value !== "object") return typeof value;
  if (Array.isArray(value)) return { array: value.length, first: shapeOf(value[0], depth + 1) };
  return Object.fromEntries(Object.entries(value).slice(0, 3).map(([key, child]) => [key, shapeOf(child, depth + 1)]));
}

for (const [ticker, strikes] of Object.entries(CHECKS)) {
  const [priorOi, currentOi, exposure] = await Promise.all([
    quantDataPost("/options/tool/open-interest-by-strike", {
      sessionDate: PRIOR_DATE,
      filter: { ticker, expirationDate: EXPIRATION },
    }),
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

  console.log(`\n## ${ticker}`);
  console.log("open-interest top-level keys:", keysOf(currentOi));
  console.log("exposure top-level keys:", keysOf(exposure));
  console.log("exposure data shape:", Array.isArray(exposure?.data)
    ? `array(${exposure.data.length})`
    : `object(${keysOf(exposure?.data).slice(0, 12).join(",")})`);
  console.log("exposure sample shape:", JSON.stringify(shapeOf(exposure?.data)));
  for (const strike of strikes) {
    const prior = nodeAt(priorOi, strike);
    const current = nodeAt(currentOi, strike);
    const exposureNode = exposureAt(exposure, ticker, strike);
    console.log(JSON.stringify({
      strike,
      prior,
      current,
      exposure: exposureNode,
    }));
  }
}
