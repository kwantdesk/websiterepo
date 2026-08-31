#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function readDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

const env = { ...readDotEnv(path.resolve(process.cwd(), ".env.local")), ...process.env };
const gatewayUrl = String(env.KWANTIFY_MARKET_DATA_GATEWAY_URL || "").replace(/\/$/, "");
const gatewayToken = String(env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN || "");
if (!gatewayUrl || !gatewayToken) throw new Error("The VPS market-data gateway is not configured.");

const TARGETS = [
  ["SPX", 7680], ["SPX", 7675], ["SPX", 7640],
  ["SPY", 760], ["SPY", 764], ["SPY", 766], ["SPY", 775],
  ["QQQ", 700], ["QQQ", 708], ["QQQ", 714], ["QQQ", 717],
];

let nextRequestAt = 0;
async function post(endpoint, body) {
  const due = Math.max(Date.now(), nextRequestAt);
  nextRequestAt = due + 300;
  if (due > Date.now()) await new Promise((resolve) => setTimeout(resolve, due - Date.now()));
  const response = await fetch(`${gatewayUrl}/v1/vendors/quantdata/v1${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${gatewayToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

function scalarSummary(rows) {
  const valuesByPath = new Map();
  function visit(value, prefix = "") {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "comprisingTrades") continue;
      const field = prefix ? `${prefix}.${key}` : key;
      if (child === null || ["string", "number", "boolean"].includes(typeof child)) {
        const bucket = valuesByPath.get(field) ?? new Map();
        const encoded = JSON.stringify(child);
        bucket.set(encoded, (bucket.get(encoded) ?? 0) + 1);
        valuesByPath.set(field, bucket);
      } else if (!Array.isArray(child)) visit(child, field);
    }
  }
  rows.forEach((row) => visit(row));
  return Object.fromEntries([...valuesByPath].sort(([a], [b]) => a.localeCompare(b)).map(([field, counts]) => [
    field,
    [...counts].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([value, count]) => ({ value: JSON.parse(value), count })),
  ]));
}

function sanitizeExample(row) {
  if (!row) return null;
  const copy = structuredClone(row);
  if (Array.isArray(copy.comprisingTrades)) copy.comprisingTrades = copy.comprisingTrades.slice(0, 3);
  return copy;
}

const result = { generatedAt: new Date().toISOString(), window: { startTime: "2026-08-21T13:30:00.000Z", endTime: "2026-08-21T14:00:01.000Z" }, targets: {} };
for (const [ticker, strike] of TARGETS) {
  process.stderr.write(`Inspecting ${ticker} ${strike}...\n`);
  const payload = await post("/options/tool/order-flow/consolidated", {
    timeRange: result.window,
    filter: { ticker, strikePrice: strike },
    size: 100,
    sort: { field: "tradeTime", direction: "ASCENDING" },
    includeComprisingTrades: true,
  });
  const parents = Array.isArray(payload?.data) ? payload.data : [];
  const children = parents.flatMap((parent) => Array.isArray(parent?.comprisingTrades) ? parent.comprisingTrades : []);
  result.targets[`${ticker}:${strike}`] = {
    parentCount: parents.length,
    childCount: children.length,
    payloadKeys: Object.keys(payload ?? {}).sort(),
    parentFields: scalarSummary(parents),
    childFields: scalarSummary(children),
    parentExamples: parents.slice(0, 4).map(sanitizeExample),
    childExamples: children.slice(0, 8).map(sanitizeExample),
  };
}

const outputPath = path.resolve("tmp/quantdata-opra-semantics-2026-08-21.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(outputPath);
