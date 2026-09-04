import assert from "node:assert/strict";
import { applyInstitutionalTradesToVolumeProfile } from "../src/lib/institutionalMarketData.ts";
import { volumeProfileBinTick } from "../src/lib/volumeProfileMath.ts";
import { readFileSync } from "node:fs";

/**
 * The live fold now carries untouched rows by reference and sorts only when a
 * print opens a new price. This checks it against the previous algorithm —
 * clone every row into a Map, sort the whole profile back out — so the
 * optimisation cannot quietly change a single number on a trader's profile.
 */
const TICK = 0.25;
// Real session timestamps: the fold only admits prints inside the profile's
// own CME trading date, so 1970-era stamps are filtered out entirely.
const SESSION_START = Date.parse("2026-08-21T13:30:00.000Z");
const SESSION_EDGE = Date.parse("2026-08-21T15:00:00.000Z");
const makeProfile = (ticks) => {
  const levels = [];
  for (let i = 0; i < ticks; i += 1) {
    levels.push({
      price: Number((29000 + i * TICK).toFixed(4)),
      volume: 100 + (i % 37), bidVolume: 40 + (i % 11), askVolume: 60 + (i % 13),
      delta: (i % 13) - (i % 11), trades: 2 + (i % 3),
    });
  }
  return {
    schemaVersion: "kwantify-volume-profile-v1", provider: "Databento", source: "CME executions",
    period: "daily", root: "NQ", startMs: SESSION_START, endMs: SESSION_EDGE, asOf: SESSION_EDGE,
    coverageEndMs: SESSION_EDGE, tradingDate: "2026-08-21",
    tickSize: TICK, groupTicks: 1, levels,
    poc: 29050, valueAreaHigh: 29080, valueAreaLow: 29020,
    totalVolume: levels.reduce((s, l) => s + l.volume, 0),
    bidVolume: levels.reduce((s, l) => s + l.bidVolume, 0),
    askVolume: levels.reduce((s, l) => s + l.askVolume, 0),
    trades: levels.reduce((s, l) => s + l.trades, 0),
    vwap: 29050, standardDeviation: 12,
    minTradeVolume: 0, maxTradeVolume: 0, developingPoc: [],
  };
};

// A deterministic stand-in for the previous implementation's row handling.
const referenceLevels = (profile, records) => {
  const map = new Map(profile.levels.map((l) => [Math.round(l.price / profile.tickSize), { ...l }]));
  for (const record of records) {
    const tick = volumeProfileBinTick(Math.round(record.close / profile.tickSize), profile.groupTicks);
    const price = Number((tick * profile.tickSize).toFixed(10));
    const cur = map.get(tick) ?? { price, volume: 0, bidVolume: 0, askVolume: 0, delta: 0, trades: 0 };
    cur.volume += record.volume; cur.bidVolume += record.bidVolume; cur.askVolume += record.askVolume;
    cur.delta = cur.askVolume - cur.bidVolume; cur.trades += record.trades;
    map.set(tick, cur);
  }
  return [...map.values()].sort((a, b) => a.price - b.price);
};

let seq = 0;
const makeBatch = (n, spread, offset = 0) => Array.from({ length: n }, () => {
  seq += 1;
  return {
    timestamp: SESSION_EDGE + seq * 10,
    close: Number((29000 + offset + ((seq * 17) % spread) * TICK).toFixed(4)),
    volume: 1 + (seq % 9), bidVolume: seq % 4, askVolume: (seq % 5),
    delta: 0, trades: 1, recordIndex: seq, eventId: `e${seq}`,
  };
});

// --- identical rows to the previous algorithm, including new prices ---
{
  for (const [prints, spread, offset] of [[20, 400, 0], [200, 400, 0], [50, 400, 500], [5, 2, 0]]) {
    const profile = makeProfile(400);
    const batch = makeBatch(prints, spread, offset);
    const expected = referenceLevels(profile, batch);
    const actual = applyInstitutionalTradesToVolumeProfile(profile, batch).levels;
    assert.deepEqual(actual, expected,
      `rows diverged for ${prints} prints, spread ${spread}, offset ${offset}`);
  }
}

// --- the input profile is never mutated ---
{
  const profile = makeProfile(300);
  const before = JSON.parse(JSON.stringify(profile.levels));
  applyInstitutionalTradesToVolumeProfile(profile, makeBatch(80, 300));
  assert.deepEqual(profile.levels, before, "the source profile's rows were mutated in place");
}

// --- repeated folds accumulate exactly, and stay sorted ---
{
  let live = makeProfile(200);
  let expectedVolume = live.totalVolume;
  for (let round = 0; round < 25; round += 1) {
    const batch = makeBatch(30, 200, round % 3 === 0 ? 900 : 0);
    expectedVolume += batch.reduce((s, r) => s + r.volume, 0);
    live = applyInstitutionalTradesToVolumeProfile(live, batch);
    for (let i = 1; i < live.levels.length; i += 1) {
      assert.ok(live.levels[i].price > live.levels[i - 1].price,
        `rows out of order at ${i} on round ${round}`);
    }
  }
  assert.equal(live.totalVolume, expectedVolume, "volume drifted across repeated folds");
  const rowVolume = live.levels.reduce((s, l) => s + l.volume, 0);
  assert.equal(rowVolume, expectedVolume, "row volume must equal the profile total");
  // Every row appears once.
  assert.equal(new Set(live.levels.map((l) => l.price)).size, live.levels.length,
    "a price level was duplicated");
}

// --- the cached row index must not survive a change of row order ---
{
  let live = makeProfile(100);
  // First fold opens new prices below the profile, which reorders the rows.
  live = applyInstitutionalTradesToVolumeProfile(live, makeBatch(10, 50, -400));
  const after = applyInstitutionalTradesToVolumeProfile(live, makeBatch(10, 50, -400));
  const expected = referenceLevels(live, []);
  assert.equal(after.levels.length >= expected.length, true);
  for (let i = 1; i < after.levels.length; i += 1) {
    assert.ok(after.levels[i].price > after.levels[i - 1].price, "order broke after an insert");
  }
}

// --- active profiles commit with candles, and prints are never dropped ---
{
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  // The execution stream and pane already batch the market burst. The active
  // profile must not add another timer after the matching candle update.
  assert.doesNotMatch(workspace, /const PROFILE_COMMIT_INTERVAL_MS = 1_000;/);
  assert.match(workspace, /const PROFILE_COMMIT_INTERVAL_BACKGROUND_MS = 3_000;/);
  assert.match(
    workspace,
    /if \(activeRef\.current\) \{[\s\S]*?flushProfileRecords\(\);[\s\S]*?return;/,
  );
  // Background batching may not mean seeing less: prints accumulate between
  // commits and are folded as one bounded batch.
  assert.match(workspace, /appendBoundedPaneRecords\(pendingProfileRecords, records\)/);
  assert.ok(
    workspace.includes("const batch = pendingProfileRecords;")
      && workspace.includes("pendingProfileRecords = [];"),
    "prints must accumulate between commits and be folded as one batch",
  );
}

console.log("Volume profile live-fold tests passed.");
