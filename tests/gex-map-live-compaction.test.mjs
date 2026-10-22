import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  compactLiveGexMapPanel,
  GEX_MAP_LIVE_LOOKBACK_MINUTES,
} from "../src/lib/gexMap.ts";
import { buildGexMapSnapshots, gexMapPriceAt } from "../src/lib/gexMapSnapshots.ts";
import { gexMapSnapshotIdentity } from "../src/lib/gexMapSnapshotIdentity.server.ts";
import { conditionalJson } from "../src/lib/conditionalJson.ts";

const MINUTE = 60_000;

function surfaceAt(frames, timestamp) {
  const surface = new Map();
  for (const frame of frames) {
    if (frame.timestamp > timestamp) break;
    for (const update of frame.updates) surface.set(update.strike, update.net);
  }
  return [...surface.entries()].sort(([left], [right]) => left - right);
}

function buildPayload() {
  const start = Date.UTC(2026, 7, 25, 13, 30);
  const strikeCount = 120;
  const frames = Array.from({ length: 180 }, (_, minute) => ({
    timestamp: start + minute * MINUTE,
    updates: Array.from({ length: strikeCount }, (_, index) => {
      const strike = 5_000 + index * 5;
      const call = minute * 10_000 + index * 100;
      const put = -(minute * 4_000 + index * 40);
      return { strike, call, put, net: call + put };
    }),
  }));
  const latestStrikes = frames.at(-1).updates;
  return {
    symbol: "SPX",
    greekMode: "GAMMA",
    sessionDate: "2026-08-25",
    expiration: "2026-08-25",
    scope: "FRONT_EXPIRY",
    representation: "PER_ONE_PERCENT_MOVE",
    source: "KwantData Interval Map",
    sourceTimeZone: "America/New_York",
    asOf: new Date(frames.at(-1).timestamp).toISOString(),
    status: "LIVE",
    refreshAfterMs: 5_000,
    stockPrice: 5_420,
    sessionChangePercent: 0.003,
    latestStrikes,
    frames,
    candles: frames.map((frame, index) => ({
      timestamp: frame.timestamp,
      open: 5_400 + index,
      high: 5_402 + index,
      low: 5_398 + index,
      close: 5_401 + index,
      volume: 1_000,
    })),
    netExposure: latestStrikes.reduce((sum, row) => sum + row.net, 0),
    grossExposure: latestStrikes.reduce((sum, row) => sum + Math.abs(row.call) + Math.abs(row.put), 0),
    rateLimitRemaining: 100,
  };
}

test("live GEX Map compaction preserves every selectable comparison surface", () => {
  const payload = buildPayload();
  const compact = compactLiveGexMapPanel(payload);
  const lastTimestamp = payload.frames.at(-1).timestamp;

  assert.equal(compact.frames.at(-1).timestamp, lastTimestamp);
  assert.equal(compact.candles.length, 2);
  assert.equal(compact.latestStrikes, payload.latestStrikes);
  assert.ok(compact.frames.length <= GEX_MAP_LIVE_LOOKBACK_MINUTES.length + 2);
  assert.deepEqual(compact.frames[0], payload.frames[0], "retain actual session opening, not rolling 10m baseline");

  for (const minutes of GEX_MAP_LIVE_LOOKBACK_MINUTES) {
    const target = lastTimestamp - minutes * MINUTE;
    assert.deepEqual(
      surfaceAt(compact.frames, target),
      surfaceAt(payload.frames, target),
      `${minutes}-minute live comparison must be exact`,
    );
  }

  const fullBytes = Buffer.byteLength(JSON.stringify(payload));
  const compactBytes = Buffer.byteLength(JSON.stringify(compact));
  assert.ok(compactBytes < fullBytes * 0.1,
    `expected live payload below 10% of full history, got ${(compactBytes / fullBytes * 100).toFixed(1)}%`);
});

test("compact and full live snapshots have identical opening/current/comparison call, put and net rows", () => {
  const payload = buildPayload();
  const compact = compactLiveGexMapPanel(payload);
  for (const minutes of GEX_MAP_LIVE_LOOKBACK_MINUTES) {
    const full = buildGexMapSnapshots(payload, null, minutes);
    const reduced = buildGexMapSnapshots(compact, null, minutes);
    for (const kind of ["opening", "current", "previous"]) assert.deepEqual([...reduced[kind]], [...full[kind]], `${kind} ${minutes}m`);
  }
});

test("every recorded replay minute reconstructs all fields exactly without later observations", () => {
  const payload = buildPayload();
  // Make updates sparse to verify last-known state without dropping strikes.
  payload.frames = payload.frames.map((frame, index) => ({ ...frame, updates: index === 0 ? frame.updates : frame.updates.filter((_, row) => row % 3 === index % 3) }));
  const oracle = new Map();
  for (const frame of payload.frames) {
    for (const row of frame.updates) oracle.set(row.strike, row);
    const snapshot = buildGexMapSnapshots(payload, frame.timestamp, 1);
    assert.deepEqual([...snapshot.current], [...oracle], `snapshot ${frame.timestamp}`);
  }
  const before = buildGexMapSnapshots(payload, payload.frames[0].timestamp - 1, 1);
  assert.equal(before.current.size, 0);
  assert.equal(before.previous.size, 0);
  assert.equal(before.opening.size, 0);
  assert.equal(gexMapPriceAt(payload, payload.candles[0].timestamp - 1), null);
  assert.equal(gexMapPriceAt(payload, payload.candles[0].timestamp), payload.candles[0].close);
});

test("short sessions do not duplicate opening when it is also a comparison or last frame", () => {
  const payload = buildPayload();
  payload.frames = payload.frames.slice(0, 2);
  const compact = compactLiveGexMapPanel(payload);
  assert.equal(new Set(compact.frames.map((frame) => frame.timestamp)).size, compact.frames.length);
  assert.deepEqual(compact.frames[0], payload.frames[0]);
});

test("ETag detects same-time equal-total strike corrections, but unchanged data still saves transfer", () => {
  const original = buildPayload();
  const corrected = structuredClone(original);
  corrected.latestStrikes[0].call += 100;
  corrected.latestStrikes[0].net += 100;
  corrected.latestStrikes[1].call -= 100;
  corrected.latestStrikes[1].net -= 100;
  const query = "symbol=SPX&compact=1";
  const first = conditionalJson(new Request("https://example.test"), original, { identity: gexMapSnapshotIdentity(query, original) });
  const request = new Request("https://example.test", { headers: { "If-None-Match": first.headers.get("ETag") } });
  assert.equal(conditionalJson(request, corrected, { identity: gexMapSnapshotIdentity(query, corrected) }).status, 200);
  assert.equal(conditionalJson(request, { ...original, rateLimitRemaining: 1 }, { identity: gexMapSnapshotIdentity(query, { ...original, rateLimitRemaining: 1 }) }).status, 304);
  const historyCorrection = structuredClone(original);
  historyCorrection.frames[0].updates[0].put -= 7;
  assert.notEqual(gexMapSnapshotIdentity(query, original), gexMapSnapshotIdentity(query, historyCorrection));
});

test("UI does not clamp the replay clock forward to a future first frame", async () => {
  const workspace = await readFile(new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("const effectiveTimestamp = selectedTimestamp;"));
  assert.ok(!workspace.includes("Math.max(selectedTimestamp, firstFrameTimestamp)"));
});

test("heavy chart and GEX Map pages unmount when traders leave them", async () => {
  const workspace = await readFile(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /\{chartSurfaceActive \? \(\s*<WorkspaceFailureBoundary/,
    "the NQ/options chart tree must not survive as a hidden Activity");
  assert.doesNotMatch(workspace, /chartSurfaceActive \|\| visitedWorkspaceSections\.has\("charts"\)/);
  assert.match(workspace, /\{bottomWorkspaceSection === "gexmap" \? \(\s*<WorkspaceFailureBoundary/,
    "GEX Map must be mounted only while it is the active standalone page");
  assert.doesNotMatch(workspace, /visitedWorkspaceSections\.has\("gexmap"\)/);
});
