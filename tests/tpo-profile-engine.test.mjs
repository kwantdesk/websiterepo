import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();

async function loadTpoModules() {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "kwantdesk-tpo-"));
  const compile = async (sourcePath, outputName) => {
    const source = await readFile(path.join(root, sourcePath), "utf8");
    const result = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
      fileName: sourcePath,
    });
    const rewritten = result.outputText
      .replaceAll('"@/lib/tpo/types"', '"./types.mjs"')
      .replaceAll('"@/lib/tpo/settings"', '"./settings.mjs"');
    await writeFile(path.join(outputDirectory, outputName), rewritten, "utf8");
  };
  await compile("src/lib/tpo/types.ts", "types.mjs");
  await compile("src/lib/tpo/settings.ts", "settings.mjs");
  await compile("src/lib/tpo/engine.ts", "engine.mjs");
  return {
    engine: await import(`${new URL(`file:///${path.join(outputDirectory, "engine.mjs").replaceAll("\\", "/")}`).href}?v=${Date.now()}`),
    settings: await import(`${new URL(`file:///${path.join(outputDirectory, "settings.mjs").replaceAll("\\", "/")}`).href}?v=${Date.now()}`),
  };
}

const modules = await loadTpoModules();
const { engine, settings } = modules;

function row(rowTick, tpoCount, width = 1) {
  return {
    rowTick,
    lowTick: rowTick,
    highTick: rowTick + width - 1,
    subperiodIds: Array.from({ length: tpoCount }, (_, index) => String(index)),
    subperiodIndexes: Array.from({ length: tpoCount }, (_, index) => index),
    markers: Array.from({ length: tpoCount }, (_, index) => engine.markerForSubperiod(index)),
    cells: Array.from({ length: tpoCount }, (_, index) => ({
      subperiodIndex: index,
      marker: engine.markerForSubperiod(index),
      sessionSegment: 0,
      volume: null,
      bidVolume: null,
      askVolume: null,
      delta: null,
      trades: null,
    })),
    tpoCount,
    volume: null,
    bidVolume: null,
    askVolume: null,
    delta: null,
    trades: null,
  };
}

test("TPO and Weekly TPO are registered beside Daily Profile without replacing TPO Levels", async () => {
  const catalog = await readFile(path.join(root, "src/lib/chartIndicatorCatalog.ts"), "utf8");
  const workspace = await readFile(path.join(root, "src/components/KwantifyWorkspace.tsx"), "utf8");
  assert.match(catalog, /indicator\("TPO Chart",\s*"Volume & Profiles"/);
  assert.match(catalog, /indicator\("Weekly TPO",\s*"Volume & Profiles"/);
  assert.match(workspace, /indicatorId:\s*"tpo-chart"/);
  assert.match(workspace, /indicatorId:\s*"weekly-tpo"/);
  assert.match(catalog, /indicator\("TPO Levels",\s*"Volume & Profiles"/);
});

test("visual TPO settings repaint without invalidating the calculated profile", () => {
  const base = settings.defaultTpoSettings("daily-tpo");
  const visualEdit = {
    ...base,
    opacityPercent: 31,
    blockSize: 14,
    profileColor: "#FF00AA",
    showOnRight: true,
    summaryFontSize: 12,
  };
  assert.equal(
    settings.tpoCalculationSettingsKey(visualEdit),
    settings.tpoCalculationSettingsKey(base),
  );
});

test("auction-model TPO settings invalidate the calculated profile", () => {
  const base = settings.defaultTpoSettings("daily-tpo");
  assert.notEqual(
    settings.tpoCalculationSettingsKey({ ...base, subperiodMinutes: 15 }),
    settings.tpoCalculationSettingsKey(base),
  );
  assert.notEqual(
    settings.tpoCalculationSettingsKey({ ...base, valueAreaPercent: 68 }),
    settings.tpoCalculationSettingsKey(base),
  );
});

test("exact executions allocate one TPO visit per price row and subperiod", () => {
  const config = {
    ...settings.defaultTpoSettings("daily-tpo"),
    periodMode: "all-loaded-bars",
    groupingMode: "manual",
    ticksPerRow: 1,
    subperiodMinutes: 30,
    visitSource: "exact-trades",
  };
  const base = Date.UTC(2026, 7, 10, 0, 0, 0);
  const profile = engine.buildTpoProfiles({
    settings: config,
    nowMs: base + 3_600_000,
    bars: [],
    trades: [
      { instrumentId: "NQ", timestampMs: base, price: 100, size: 2, aggressorSide: "buy", tickSize: 0.25 },
      { instrumentId: "NQ", timestampMs: base + 1_000, price: 100, size: 3, aggressorSide: "sell", tickSize: 0.25 },
      { instrumentId: "NQ", timestampMs: base + 31 * 60_000, price: 100.25, size: 1, aggressorSide: "buy", tickSize: 0.25 },
    ],
  })[0];
  assert.equal(profile.source, "exact-trades");
  assert.equal(profile.rows.find((candidate) => candidate.rowTick === 400).tpoCount, 1);
  assert.equal(profile.rows.find((candidate) => candidate.rowTick === 400).volume, 5);
  assert.equal(profile.rows.find((candidate) => candidate.rowTick === 401).markers[0], "B");
  assert.equal(profile.totalVolume, 6);
  assert.equal(profile.delta, 0);
});

test("POC tie-break is midpoint, then close, then lower row", () => {
  assert.equal(engine.calculateTpoPoc([row(100, 3), row(101, 1), row(102, 3)], 102), 102);
  assert.equal(engine.calculateTpoPoc([row(100, 1), row(101, 3), row(102, 3), row(103, 1)], 102), 102);
  assert.equal(engine.calculateTpoPoc([row(100, 3), row(102, 3)], null), 100);
  assert.equal(engine.calculateTpoPoc([row(100, 4, 4)], null), 101.5);
});

test("value area expands contiguously and includes both sides on a tie", () => {
  const result = engine.calculateTpoValueArea([row(100, 1), row(101, 3), row(102, 1)], 101, 70);
  assert.deepEqual(result, { valTick: 100, vahTick: 102 });
});

test("single prints exclude profile extremes unless explicitly enabled", () => {
  const rows = [row(100, 1), row(101, 3), row(102, 1), row(103, 1), row(104, 4), row(105, 1)];
  assert.deepEqual(engine.detectSinglePrints(rows, 2, false), [{ lowTick: 102, highTick: 103, tested: false }]);
  assert.equal(engine.detectSinglePrints(rows, 1, true).length, 3);
});

test("weekly boundaries honor IANA DST rather than assuming fixed UTC offsets", () => {
  const config = settings.defaultTpoSettings("weekly-tpo");
  const beforeDst = engine.periodBoundaryForTime(Date.UTC(2026, 2, 4, 12), config);
  const afterDst = engine.periodBoundaryForTime(Date.UTC(2026, 2, 11, 12), config);
  assert.equal(new Date(beforeDst.startMs).toISOString(), "2026-03-01T23:00:00.000Z");
  assert.equal(new Date(afterDst.startMs).toISOString(), "2026-03-08T22:00:00.000Z");
  assert.equal((beforeDst.endMs - beforeDst.startMs) / 3_600_000, 167);
});

test("bar-range fallback is explicit and marks coarse bars as lower granularity", () => {
  const config = {
    ...settings.defaultTpoSettings("daily-tpo"),
    periodMode: "all-loaded-bars",
    visitSource: "automatic",
    subperiodMinutes: 30,
  };
  const start = Date.UTC(2026, 7, 10, 0);
  const profile = engine.buildTpoProfiles({
    settings: config,
    nowMs: start + 3_600_000,
    trades: [],
    bars: [{
      instrumentId: "NQ",
      startTimeMs: start,
      endTimeMs: start + 3_600_000,
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 100,
      tickSize: 0.25,
    }],
  })[0];
  assert.equal(profile.source, "bar-range");
  assert.equal(profile.lowerGranularity, true);
  assert.ok(profile.rows.length > 1);
});

test("profile merges recalculate POC, value area and member identity", () => {
  const config = {
    ...settings.defaultTpoSettings("daily-tpo"),
    periodMode: "all-loaded-bars",
    groupingMode: "manual",
    ticksPerRow: 1,
    visitSource: "exact-trades",
  };
  const base = Date.UTC(2026, 7, 10, 0);
  const make = (price, offset) => engine.buildTpoProfiles({
    settings: config,
    nowMs: base + offset + 1,
    bars: [],
    trades: [{ instrumentId: "NQ", timestampMs: base + offset, price, size: 1, aggressorSide: "buy", tickSize: 0.25 }],
  })[0];
  const first = { ...make(100, 0), id: "first", startTimeMs: base, endTimeMs: base + 1_000 };
  const second = { ...make(101, 2_000), id: "second", startTimeMs: base + 2_000, endTimeMs: base + 3_000 };
  const merged = engine.mergeTpoProfileModels([first, second], "second", config);
  assert.deepEqual(merged.memberProfileIds, ["first", "second"]);
  assert.equal(merged.anchorProfileId, "second");
  assert.ok(merged.pocTick !== null && merged.vahTick !== null && merged.valTick !== null);
});

test("zero profile count retains every available profile", () => {
  const config = {
    ...settings.defaultTpoSettings("daily-tpo"),
    profileCount: 0,
    visitSource: "exact-trades",
  };
  const day = 86_400_000;
  const base = Date.UTC(2026, 7, 10, 23);
  const profiles = engine.buildTpoProfiles({
    settings: config,
    nowMs: base + 3 * day,
    bars: [],
    trades: [0, 1, 2].map((offset) => ({
      instrumentId: "NQ",
      timestampMs: base + offset * day,
      price: 100 + offset,
      size: 1,
      aggressorSide: "buy",
      tickSize: 0.25,
    })),
  });
  assert.equal(profiles.length, 3);
});

test("completed profile levels record the first later interaction without lookahead", () => {
  const base = Date.UTC(2026, 7, 10, 0);
  const config = {
    ...settings.defaultTpoSettings("daily-tpo"),
    scheduleKind: "custom-range",
    periodMode: "custom-range",
    customStartMs: base,
    customEndMs: base + 60_000,
    customEndFollowsLatest: false,
    groupingMode: "manual",
    ticksPerRow: 1,
    visitSource: "exact-trades",
  };
  const profile = engine.buildTpoProfiles({
    settings: config,
    nowMs: base + 180_000,
    bars: [],
    trades: [
      { instrumentId: "NQ", timestampMs: base + 1_000, price: 100, size: 1, aggressorSide: "buy", tickSize: 0.25 },
      { instrumentId: "NQ", timestampMs: base + 90_000, price: 100, size: 1, aggressorSide: "sell", tickSize: 0.25 },
    ],
  })[0];
  assert.equal(profile.pocFirstInteractionMs, base + 90_000);
});

test("split-two retains the full period and marks ETH and RTH components separately", () => {
  const base = Date.UTC(2026, 7, 10, 0);
  const config = {
    ...settings.defaultTpoSettings("daily-tpo"),
    periodMode: "all-loaded-bars",
    visitSource: "exact-trades",
    timezone: "UTC",
    filterMode: "split-two",
    groupingMode: "manual",
    ticksPerRow: 1,
  };
  const profile = engine.buildTpoProfiles({
    settings: config,
    nowMs: base + 12 * 3_600_000,
    bars: [],
    trades: [
      { instrumentId: "NQ", timestampMs: base + 7 * 3_600_000, price: 100, size: 1, aggressorSide: "buy", tickSize: 0.25 },
      { instrumentId: "NQ", timestampMs: base + 9 * 3_600_000, price: 100, size: 1, aggressorSide: "sell", tickSize: 0.25 },
    ],
  })[0];
  assert.deepEqual([...new Set(profile.rows[0].cells.map((cell) => cell.sessionSegment))], [0, 1]);
});
