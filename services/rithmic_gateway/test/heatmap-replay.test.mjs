import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";

import { HeatmapReplayStore } from "../src/heatmap-replay.mjs";
import { chicagoTradingDate } from "../src/trading-session.mjs";

// 2026-08-07 14:00Z — inside the 2026-08-07 CME trading date.
const BASE_SSBOE = Math.floor(Date.parse("2026-08-07T14:00:00Z") / 1_000);
const TRADING_DATE = chicagoTradingDate(BASE_SSBOE * 1_000);

let wireSequence = 0;
function depthAdd(ssboe, side, price, size, id) {
  wireSequence += 1;
  return JSON.stringify({
    templateId: 160,
    exchange: "CME",
    symbol: "NQU6",
    payload: {
      exchange: "CME",
      symbol: "NQU6",
      updateType: [1],
      transactionType: [side],
      depthPrice: [price],
      depthSize: [size],
      depthOrderPriority: ["1"],
      exchangeOrderId: [id],
      sequenceNumber: String(wireSequence),
      ssboe,
      usecs: 0,
    },
  });
}

function tradeLine(ssboe, price, size, aggressor, id) {
  return JSON.stringify({
    templateId: 150,
    exchange: "CME",
    symbol: "NQU6",
    payload: {
      exchange: "CME",
      symbol: "NQU6",
      tradePrice: price,
      tradeSize: size,
      aggressor,
      sourceTradeId: id,
      ssboe,
      usecs: 0,
    },
  });
}

function syntheticArchive() {
  const dir = mkdtempSync(join(tmpdir(), "kwantify-heatmap-replay-"));
  const dayDir = join(dir, TRADING_DATE);
  mkdirSync(dayDir, { recursive: true });
  const lines = [];
  // Build a small L3 book, then trade through ~20 seconds of market time so
  // several 2-second frames are captured.
  lines.push(depthAdd(BASE_SSBOE, 1, 29500, 5, "b1"));
  lines.push(depthAdd(BASE_SSBOE, 1, 29499.75, 7, "b2"));
  lines.push(depthAdd(BASE_SSBOE, 2, 29500.25, 4, "a1"));
  lines.push(depthAdd(BASE_SSBOE, 2, 29500.5, 6, "a2"));
  for (let second = 1; second <= 20; second += 1) {
    lines.push(tradeLine(BASE_SSBOE + second, 29500 + (second % 3) * 0.25, 1 + (second % 4), second % 2 ? 1 : 2, `t${second}`));
  }
  writeFileSync(join(dayDir, "CME-NQU6.ndjson.gz"), gzipSync(`${lines.join("\n")}\n`));
  return dir;
}

async function builtManifest(store) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const manifest = await store.readManifest(TRADING_DATE, "CME", "NQ");
    if (manifest) return manifest;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("replay pack build did not finish");
}

test("builds a replay pack from the raw archive and serves browser-valid frames", async () => {
  const dir = syntheticArchive();
  const store = new HeatmapReplayStore({ dir, tickSizeFor: () => 0.25 });

  const first = await store.manifestOrBuild(TRADING_DATE, "CME", "NQ");
  assert.equal(first.building, true, "first request kicks off a background build");

  const manifest = await builtManifest(store);
  assert.equal(manifest.contractSymbol, "NQU6", "root request resolves the day's concrete contract file");
  assert.equal(manifest.tickSize, 0.25);
  assert.equal(manifest.frameMs, 2_000);
  assert.ok(manifest.frames >= 5, `20s of market time yields multiple 2s frames (got ${manifest.frames})`);
  assert.ok(manifest.chunks.length >= 1);

  const chunk = await store.readChunk(TRADING_DATE, "CME", "NQ", manifest.chunks[0].startMs);
  assert.ok(chunk && chunk.frames.length >= 5);
  let previousTimestamp = 0;
  for (const frame of chunk.frames) {
    // These are the exact invariants the browser's normalizeLiveSnapshot
    // enforces before it will draw a frame at all.
    assert.equal(frame.snapshot.readOnly, true);
    assert.equal(frame.snapshot.fullDepth, true);
    assert.equal(frame.snapshot.source, "rithmic-depth-by-order");
    assert.ok(frame.snapshot.bids.length > 0 && frame.snapshot.asks.length > 0);
    assert.ok(frame.snapshot.timestamp > previousTimestamp, "frames advance in market time");
    previousTimestamp = frame.snapshot.timestamp;
    assert.equal(frame.status.replay, true, "replay frames are labelled as archive, never LIVE");
    assert.equal(frame.status.connected, false);
  }
});

test("refuses honestly when no archive exists for the session", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kwantify-heatmap-replay-empty-"));
  const store = new HeatmapReplayStore({ dir, tickSizeFor: () => 0.25 });
  const result = await store.manifestOrBuild("2026-01-05", "CME", "NQ");
  assert.match(result.error, /No recorded session archive/);
});

test("second manifest request returns the cached pack without rebuilding", async () => {
  const dir = syntheticArchive();
  const store = new HeatmapReplayStore({ dir, tickSizeFor: () => 0.25 });
  await store.manifestOrBuild(TRADING_DATE, "CME", "NQ");
  await builtManifest(store);
  const again = await store.manifestOrBuild(TRADING_DATE, "CME", "NQ");
  assert.ok(again.manifest, "cached manifest is returned directly");
  assert.equal(again.manifest.version, 2);
});
