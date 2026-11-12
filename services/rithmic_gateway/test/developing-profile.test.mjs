import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { buildDevelopingProfileSeries, createDevelopingProfile } from "../src/developing-profile.mjs";
import { runArchiveFold } from "../src/archive-fold-worker-client.mjs";
import { foldPrintsToMinuteLevels } from "../src/session-profile-archive.mjs";

const start = Date.parse("2026-11-11T16:04:00Z");
const tickSize = 0.25;
const trade = (offset, price, size, side = 1) => ({timestamp: start + offset, price, size, side});
const tape = [
  trade(1_000, 100.25, 8),
  trade(3_000, 100.5, 8, -1),
  trade(4_000, 98.5, 1, 0),
  trade(61_000, 101.25, 20),
  trade(67_000, 100.25, 3, -1),
  trade(126_000, 98.5, 21, -1),
  trade(128_000, 100.5, 2, 0),
  trade(187_000, 100.5, 1),
];

function independentCheckpoint(trades, {groupTicks, minTradeVolume, maxTradeVolume, valueAreaPercent}) {
  const byPrice = new Map();
  let weightedPrice = 0;
  let volume = 0;
  for (const trade of trades) {
    if (trade.size < minTradeVolume || (maxTradeVolume && trade.size > maxTradeVolume)) continue;
    const groupPrice = Math.floor(trade.price / (tickSize * groupTicks)) * tickSize * groupTicks;
    byPrice.set(groupPrice, (byPrice.get(groupPrice) ?? 0) + trade.size);
    weightedPrice += trade.price * trade.size;
    volume += trade.size;
  }
  if (!volume) return null;
  const prices = [...byPrice.keys()].sort((a, b) => a - b);
  const poc = prices.reduce((best, price) => byPrice.get(price) > byPrice.get(best) ? price : best);
  const selected = [poc];
  while (selected.reduce((total, price) => total + byPrice.get(price), 0) < volume * valueAreaPercent / 100) {
    const left = prices[prices.indexOf(selected[0]) - 1];
    const right = prices[prices.indexOf(selected.at(-1)) + 1];
    if ((byPrice.get(right) ?? -1) > (byPrice.get(left) ?? -1)) selected.push(right);
    else selected.unshift(left);
  }
  return {poc, vah: selected.at(-1), val: selected[0], vwap: weightedPrice / volume};
}

for (const settings of [
  {groupTicks: 1, minTradeVolume: 0, maxTradeVolume: 0, valueAreaPercent: 70},
  {groupTicks: 4, minTradeVolume: 2, maxTradeVolume: 20, valueAreaPercent: 68},
]) {
  test("every developing checkpoint matches independently folded tape with " + JSON.stringify(settings), () => {
    const stream = createDevelopingProfile({tickSize, ...settings});
    const minutes = foldPrintsToMinuteLevels(tape, tickSize);
    let count = 0;
    for (const minute of minutes) {
      const result = stream.addMinute(minute);
      if (settings.minTradeVolume && minute.t === start + 3 * 60_000) {
        assert.equal(result, null, "a minute without accepted trades must not create a new observation");
        continue;
      }
      const {timestamp, ...profile} = result;
      assert.equal(timestamp, minute.last);
      assert.deepEqual(profile, independentCheckpoint(tape.filter(trade => trade.timestamp <= timestamp), settings));
      count++;
    }
    assert.equal(count, settings.minTradeVolume ? 3 : 4);
    assert.throws(() => stream.addMinute(minutes.at(-1)), /strictly increasing/);
  });
}

test("archive and live suffix share one minute without losing either source", () => {
  const settings = { groupTicks: 1, valueAreaPercent: 70, minTradeVolume: 0, maxTradeVolume: 0 };
  const minutes = foldPrintsToMinuteLevels(tape.slice(0, 4), tickSize);
  const toMs = start + 126_000;
  const series = buildDevelopingProfileSeries({
    minutes, tailTrades: tape.slice(4), tickSize, fromMs: start, toMs, ...settings,
  });
  assert.deepEqual(series.developingPoc.map(({timestamp}) => timestamp), [start + 4_000, start + 67_000]);
  const expected = independentCheckpoint(tape.filter(print => print.timestamp < toMs), settings);
  assert.equal(series.developingPoc.at(-1).price, expected.poc);
  assert.equal(series.developingValueArea.at(-1).vah, expected.vah);
  assert.equal(series.developingValueArea.at(-1).val, expected.val);
  assert.equal(series.developingVwap.at(-1).price, expected.vwap);
});

test("partial compact buckets never reveal future prints in replay", () => {
  const minutes = foldPrintsToMinuteLevels(tape, tickSize);
  const result = buildDevelopingProfileSeries({minutes, tickSize, fromMs: start + 1_000, toMs: start + 65_000});
  assert.equal(result, null);
});

test("the archive worker returns the same developing series", async () => {
  const args = {
    tailTrades: tape.slice(4),
    tickSize,
    groupTicks: 4,
    fromMs: start,
    toMs: start + 3 * 60_000,
  };
  const minutes = foldPrintsToMinuteLevels(tape.slice(0, 4), tickSize);
  const expected = buildDevelopingProfileSeries({ ...args, minutes });
  assert.equal(expected.developingPoc.length, 3);
  const dir = await mkdtemp(join(tmpdir(), "profile-worker-"));
  const file = join(dir, "CME-NQZ6.profile.json.gz");
  const write = (historyPlant) => writeFile(file, gzipSync(JSON.stringify({
    schemaVersion: 2, historyPlant, tickSize, minutes,
  })));
  try {
    await write(false);
    assert.deepEqual(await runArchiveFold({ kind: "developing-volume-profile", files: [file], args }), expected);
    await write(true);
    assert.equal(await runArchiveFold({ kind: "developing-volume-profile", files: [file], args }), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("replay seeks share a completed session calculation and clip every series", async () => {
  const { DevelopingProfileArchive } = await import("../src/developing-profile-archive.mjs");
  const { chicagoTradingDate } = await import("../src/trading-session.mjs");
  const { mkdir } = await import("node:fs/promises");
  const dir = await mkdtemp(join(tmpdir(), "development-cache-"));
  try {
    const folder = join(dir, "profiles", chicagoTradingDate(start));
    await mkdir(folder, { recursive: true });
    const minutes = foldPrintsToMinuteLevels(tape, tickSize);
    await writeFile(join(folder, "CME-NQZ6.profile.json.gz"), gzipSync(JSON.stringify({
      schemaVersion: 2, historyPlant: false, tickSize, minutes,
    })));
    let jobs = 0;
    const archive = new DevelopingProfileArchive({
      dir, now: () => start + 2 * 86400000,
      fold: (job) => { jobs++; return runArchiveFold(job); },
    });
    const args = { exchange: "CME", symbol: "NQZ6", tickSize, fromMs: start,
      windowEndMs: start + 4 * 60_000, groupTicks: 1, valueAreaPercent: 70 };
    const [early, later] = await Promise.all([
      archive.load({ ...args, cutoffMs: start + 2 * 60_000 }),
      archive.load({ ...args, cutoffMs: args.windowEndMs }),
    ]);
    assert.equal(jobs, 1);
    for (const key of ["developingPoc", "developingValueArea", "developingVwap"]) {
      assert.equal(early[key].length, 2);
      assert.deepEqual(early[key], later[key].slice(0, 2));
      assert.equal(later[key].length, 4);
    }
    const changedFilter = await archive.load({ ...args, cutoffMs: args.windowEndMs, minTradeVolume: 2 });
    assert.equal(jobs, 2);
    assert.equal(changedFilter.developingPoc.length, 3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
