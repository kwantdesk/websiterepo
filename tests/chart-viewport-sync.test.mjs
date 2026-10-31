import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();

async function loadViewportSync() {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "kwantdesk-viewport-"));
  const sourcePath = "src/lib/chartViewportSync.ts";
  const source = await readFile(path.join(root, sourcePath), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    fileName: sourcePath,
  });
  const outputPath = path.join(outputDirectory, "chartViewportSync.mjs");
  await writeFile(outputPath, result.outputText, "utf8");
  return import(`${new URL(`file:///${outputPath.replaceAll("\\", "/")}`).href}?v=${Date.now()}`);
}

const viewport = await loadViewportSync();

function snapshot(overrides = {}) {
  return {
    groupId: "gex-vue",
    sourceChartId: "spx",
    instrument: "SPX",
    timeframe: "5m",
    visibleTimeRange: { from: 1, to: 2 },
    visibleLogicalRange: { from: 50, to: 150 },
    sourceDataLength: 200,
    priceRange: { from: 5_250, to: 5_350 },
    anchorPrice: 5_300,
    updatedAt: 1,
    ...overrides,
  };
}

test("linked price height preserves both percentage offsets across differently priced instruments", () => {
  const range = viewport.resolveLinkedPriceRange(snapshot(), "SPY", 530);
  assert.ok(Math.abs(range.from - 525) < 1e-9);
  assert.ok(Math.abs(range.to - 535) < 1e-9);
});

test("the same instrument still aligns its latest price if its local feed is a tick apart", () => {
  const range = viewport.resolveLinkedPriceRange(snapshot(), "SPX", 5_310);
  assert.ok(Math.abs(range.from - (5_310 * (5_250 / 5_300))) < 1e-9);
  assert.ok(Math.abs(range.to - (5_310 * (5_350 / 5_300))) < 1e-9);
});

test("a newly linked group centers its reference price without changing visible height", () => {
  const range = viewport.centerPriceRangeOnAnchor({ from: 5_200, to: 5_350 }, 5_300);
  assert.deepEqual(range, { from: 5_225, to: 5_375 });
  assert.equal(range.to - range.from, 150);
  assert.equal((range.from + range.to) / 2, 5_300);
});

test("horizontal pan preserves viewport width instead of stretching a follower", () => {
  const range = viewport.resolveLinkedLogicalRange(snapshot(), 500);
  assert.deepEqual(range, { from: 350, to: 450 });
  assert.equal(range.to - range.from, 100);
});

test("whitespace beyond the latest bar is preserved on every linked chart", () => {
  const range = viewport.resolveLinkedLogicalRange(snapshot({
    visibleLogicalRange: { from: 140, to: 240 },
  }), 500);
  assert.deepEqual(range, { from: 440, to: 540 });
  assert.equal(range.to - 499, 41);
});

test("invalid logical ranges fall back to timestamp synchronization", () => {
  const range = viewport.resolveLinkedLogicalRange(snapshot({
    visibleLogicalRange: { from: 10, to: 10 },
  }), 500);
  assert.equal(range, null);
});

test("timestamp anchors ignore a 41-bar difference between instrument tails", () => {
  const source = snapshot({ visibleLogicalRange: { from: 50, to: 150 },
    timeScaleAnchors: [{ timestamp: 1000, logical: 50 }, { timestamp: 2000, logical: 150 }] });
  const range = viewport.resolveLinkedLogicalRange(source, 541, (time) => time === 1000 ? 350 : 450);
  assert.deepEqual(range, { from: 350, to: 450 });
  assert.notDeepEqual(range, viewport.resolveLinkedLogicalRange({ ...source, timeScaleAnchors: undefined }, 541));
});
test("native indices, not candle-array indices, define the recipient viewport", () => {
  const candles = [{ timestamp: 1000 }, { timestamp: 2000 }, { timestamp: 3000 }];
  const index = (time) => new Map([[1000, 550], [2000, 551], [3000, 552]]).get(time) ?? null;
  assert.equal(viewport.linkedLogicalAtTimestamp(2000, candles, index, 1000), 551);
});
test("fractional bounds and edge whitespace survive an absolute-time link", () => {
  const range = viewport.resolveLinkedLogicalRange(snapshot({ visibleLogicalRange: { from: -5.5, to: 20.25 },
    timeScaleAnchors: [{ timestamp: 1000, logical: 0 }, { timestamp: 11000, logical: 10 }] }), 900,
  (time) => time === 1000 ? 500 : 510);
  assert.deepEqual(range, { from: 494.5, to: 520.25 });
});
test("different history gaps align the actual endpoints without fabricating bars", () => {
  const candles = [{ timestamp: 1000 }, { timestamp: 3000 }], original = structuredClone(candles);
  const at = (t) => t === 1000 ? 10 : t === 3000 ? 11 : null;
  assert.equal(viewport.linkedLogicalAtTimestamp(2000, candles, at, 1000), 10.5);
  assert.deepEqual(candles, original);
});
test("clock whitespace uses interval cadence beyond either history edge", () => {
  const candles = [{ timestamp: 1000 }, { timestamp: 3000 }];
  const at = (t) => t === 1000 ? 10 : t === 3000 ? 11 : null;
  assert.equal(viewport.linkedLogicalAtTimestamp(5000, candles, at, 1000), 13);
  assert.equal(viewport.linkedLogicalAtTimestamp(-1000, candles, at, 1000), 8);
});
test("one available anchor still translates the range without tail drift", () => {
  const result = viewport.resolveLinkedLogicalRange(snapshot({ timeScaleAnchors: [{ timestamp: 1000, logical: 50 }] }), 800, () => 700);
  assert.deepEqual(result, { from: 700, to: 800 });
});
test("missing target history is deferred rather than reusing a wrong count", () => {
  const value = snapshot({ timeScaleAnchors: [{ timestamp: 1000, logical: 50 }] });
  assert.equal(viewport.resolveLinkedLogicalRange(value, 500, () => null), null);
  assert.equal(viewport.linkedLogicalAtTimestamp(1000, [], () => null, 1000), null);
});
test("replay dates are scoped to New York sessions rather than UTC midnights", () => {
  assert.equal(viewport.chartViewportReplayScope(null), "live");
  assert.equal(viewport.chartViewportReplayScope(NaN), "replay:invalid");
  assert.equal(viewport.chartViewportReplayScope(Date.parse("2026-10-31T00:30:00Z")), "replay:2026-10-30");
  assert.equal(viewport.chartViewportReplayScope(Date.parse("2026-10-30T14:30:00Z")), "replay:2026-10-30");
});

test("returning live advances a viewport seeded from an older replay day", () => {
  const old = Date.parse("2026-10-29T19:00:00Z"), live = Date.parse("2026-10-30T19:00:00Z");
  const value = snapshot({ sourceLastTimestamp: old, visibleTimeRange: { from: old / 1000 - 600, to: old / 1000 }, timeScaleAnchors: [{ timestamp: old, logical: 100 }] });
  assert.equal(viewport.shouldAdvanceLinkedLiveViewport(value, live, 60000), true);
  assert.equal(viewport.shouldAdvanceLinkedLiveViewport({ ...value, replayScope: "replay:2026-10-29" }, live, 60000), false);
});
test("normal live appends and deliberate historical pans never reset the group", () => {
  const old = Date.parse("2026-10-29T19:00:00Z");
  const value = snapshot({ sourceLastTimestamp: old, visibleTimeRange: { from: old / 1000 - 600, to: old / 1000 }, timeScaleAnchors: [{ timestamp: old, logical: 100 }] });
  assert.equal(viewport.shouldAdvanceLinkedLiveViewport(value, old + 60000, 60000), false);
  assert.equal(viewport.shouldAdvanceLinkedLiveViewport({ ...value, visibleTimeRange: { from: old / 1000 - 6000, to: old / 1000 - 600 } }, old + 86400000, 60000), false);
});
