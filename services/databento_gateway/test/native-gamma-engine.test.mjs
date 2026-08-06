import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  black76Gamma,
  black76Price,
  buildPositioningMap,
  classifyGatewayFreshness,
  deriveNativeGammaSnapshot,
  invertBlack76Volatility,
  mergeNativeWithConverted,
  selectFrontMonthChain,
  timeToExpiryYears,
} from "../src/native-gamma-engine.mjs";
import { replacePositioningMapAfterBuild } from "../src/state-store.mjs";
import { chicagoWallClockToUtc } from "../src/market-clock.mjs";

const DAY = 24 * 60 * 60 * 1_000;
const NOW = Date.parse("2026-08-06T15:00:00.000Z");

function approximate(actual, expected, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

function positioningMap(records) {
  return {
    schemaVersion: "kwantdesk-native-oi-v1",
    root: "NQ",
    underlyingContract: "NQU6",
    oiAsOf: "2026-08-05",
    rate: 0.045,
    multiplier: 20,
    records,
  };
}

function record(strike, type, openInterest, volatility = 0.25, expiryDays = 2) {
  return {
    instrumentId: Number(`${strike}${type === "CALL" ? 1 : 2}`),
    symbol: `NQ-${strike}-${type}`,
    strike,
    expiry: new Date(NOW + expiryDays * DAY).toISOString(),
    type,
    openInterest,
    settlement: 1,
    impliedVolatility: volatility,
  };
}

test("Black-76 gamma matches five published-formula reference vectors, including near expiry", () => {
  const vectors = [
    [{ futures: 100, strike: 100, years: 1, volatility: 0.2, rate: 0.05 }, 0.018879647164532515],
    [{ futures: 100, strike: 90, years: 0.5, volatility: 0.25, rate: 0.03 }, 0.017589719133142143],
    [{ futures: 100, strike: 110, years: 0.25, volatility: 0.3, rate: 0.01 }, 0.022674519225357233],
    [{ futures: 4_500, strike: 4_500, years: 7 / 365, volatility: 0.2, rate: 0.05 }, 0.003197472935596296],
    [{ futures: 20_000, strike: 20_050, years: 1 / 365, volatility: 0.35, rate: 0.05 }, 0.0010799140953405718],
  ];
  for (const [input, expected] of vectors) approximate(black76Gamma(input), expected);
});

test("IV inversion round-trips valid prices and rejects/logs below-intrinsic settlements", () => {
  const input = { futures: 100, strike: 100, years: 2 / 365.25, volatility: 0.32, rate: 0.045, type: "CALL" };
  const price = black76Price(input);
  const solved = invertBlack76Volatility({ ...input, price });
  approximate(solved.volatility, input.volatility, 1e-5);
  assert.equal(invertBlack76Volatility({ ...input, strike: 90, price: 1 }).reason, "below_intrinsic");

  const logs = [];
  const expiry = NOW + 2 * DAY;
  const definitions = [
    { instrumentId: 11, underlyingInstrumentId: 1, expiration: expiry, strike: 100, optionType: "CALL", symbol: "NQ-C100" },
    { instrumentId: 12, underlyingInstrumentId: 1, expiration: expiry, strike: 90, optionType: "CALL", symbol: "NQ-C90" },
  ];
  const validSettle = black76Price({ futures: 100, strike: 100, years: 2 / 365.25, volatility: 0.3, rate: 0.045, type: "CALL" });
  const map = buildPositioningMap({
    definitions,
    futuresDefinitions: [{ instrumentId: 1, expiration: NOW + 30 * DAY, symbol: "NQU6", instrumentClass: "F" }],
    statistics: [
      { instrumentId: 11, statType: 9, quantity: 100 }, { instrumentId: 11, statType: 3, price: validSettle },
      { instrumentId: 12, statType: 9, quantity: 100 }, { instrumentId: 12, statType: 3, price: 1 },
    ],
    futuresStatistics: [{ instrumentId: 1, statType: 3, price: 100 }],
    nowMs: NOW,
    oiAsOf: "2026-08-05",
    logger: (entry) => logs.push(entry),
  });
  assert.equal(map.records.length, 1);
  assert.equal(logs[0]?.code, "IV_REJECTED");
  assert.equal(logs[0]?.reason, "below_intrinsic");
});

test("60-second repricing moves native concentrations when futures spot moves", () => {
  const map = positioningMap([
    record(95, "PUT", 550), record(100, "PUT", 850), record(105, "PUT", 420),
    record(100, "CALL", 950), record(105, "CALL", 700), record(110, "CALL", 1_050),
  ]);
  const first = deriveNativeGammaSnapshot(map, 100, NOW);
  const second = deriveNativeGammaSnapshot(map, 110, NOW + 60_000);
  const firstCall = first.levels.find((level) => level.kind === "CALL_WALL")?.price;
  const secondCall = second.levels.find((level) => level.kind === "CALL_WALL")?.price;
  assert.notEqual(firstCall, secondCall);
  assert.notEqual(first.gammaFlip, second.gammaFlip);
  assert.notEqual(JSON.stringify(first.strikes), JSON.stringify(second.strikes));
});

test("assumed dealer sign convention keeps magnet positive and accelerator negative", () => {
  const snapshot = deriveNativeGammaSnapshot(positioningMap([
    record(95, "PUT", 1_400), record(100, "PUT", 1_100),
    record(100, "CALL", 650), record(102, "CALL", 1_600),
  ]), 100, NOW);
  const magnet = snapshot.levels.find((level) => level.kind === "GAMMA_MAGNET");
  const accelerator = snapshot.levels.find((level) => level.kind === "GAMMA_ACCELERATOR");
  assert.ok((magnet?.value ?? 0) > 0);
  assert.ok((accelerator?.value ?? 0) < 0);
  assert.match(snapshot.signConventionDetail, /calls are modeled positive and puts negative/i);
});

test("front-month roll selection excludes back-month and spread definitions", () => {
  const futures = [
    { instrumentId: 1, expiration: NOW + 20 * DAY, symbol: "NQU6", instrumentClass: "F" },
    { instrumentId: 2, expiration: NOW + 110 * DAY, symbol: "NQZ6", instrumentClass: "F" },
    { instrumentId: 3, expiration: NOW + 10 * DAY, symbol: "NQU6-NQZ6", instrumentClass: "SPREAD" },
  ];
  const options = [
    { instrumentId: 11, underlyingInstrumentId: 1, expiration: NOW + DAY, strike: 100, optionType: "CALL", symbol: "NQ-C100" },
    { instrumentId: 12, underlyingInstrumentId: 2, expiration: NOW + DAY, strike: 100, optionType: "CALL", symbol: "NQZ-C100" },
    { instrumentId: 13, underlyingInstrumentId: 1, expiration: NOW + DAY, strike: 100, optionType: "CALL", symbol: "NQ-C100:NQ-C105" },
  ];
  const selection = selectFrontMonthChain(options, futures, NOW);
  assert.equal(selection.underlying.symbol, "NQU6");
  assert.deepEqual(selection.definitions.map((row) => row.instrumentId), [11]);
});

test("fresh native levels outrank agreeing converted levels while stale native never does", () => {
  const native = [{ id: "native", kind: "CALL_WALL", price: 100, label: "Native", rank: 1 }];
  const converted = [
    { id: "agree", kind: "CALL_WALL", price: 101, label: "Converted agree", rank: 1 },
    { id: "far", kind: "CALL_WALL", price: 120, label: "Converted far", rank: 2 },
  ];
  assert.deepEqual(
    mergeNativeWithConverted({ nativeLevels: native, convertedLevels: converted, nativeState: "LIVE", matchingBand: 2 }).map((row) => row.id),
    ["native", "far"],
  );
  assert.deepEqual(
    mergeNativeWithConverted({ nativeLevels: native, convertedLevels: converted, nativeState: "STALE", matchingBand: 2 }),
    converted,
  );
});

test("spot age crosses stale at 120 seconds and recovers on the next trade", () => {
  assert.equal(classifyGatewayFreshness({ lastTradeAt: NOW - 120_000, nowMs: NOW, marketClosed: false }).state, "LIVE");
  assert.equal(classifyGatewayFreshness({ lastTradeAt: NOW - 120_001, nowMs: NOW, marketClosed: false }).state, "STALE");
  assert.equal(classifyGatewayFreshness({ lastTradeAt: NOW - 1_000, nowMs: NOW, marketClosed: false }).state, "LIVE");
});

test("daily map build failure retains the previous persisted map", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kwantdesk-native-gamma-"));
  const path = join(directory, "map.json");
  const previous = positioningMap([record(100, "CALL", 100)]);
  try {
    const seeded = await replacePositioningMapAfterBuild(path, null, async () => previous);
    assert.equal(seeded.replaced, true);
    const failed = await replacePositioningMapAfterBuild(path, seeded.map, async () => { throw new Error("daily unavailable"); });
    assert.equal(failed.replaced, false);
    assert.equal(failed.map, previous);
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), previous);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("time to expiry uses elapsed UTC time correctly across Chicago DST", () => {
  const before = Date.parse("2026-03-08T07:30:00.000Z");
  const after = Date.parse("2026-03-08T09:30:00.000Z");
  const years = timeToExpiryYears(after, before, 0);
  approximate(years, 2 / (365.25 * 24), 1e-15);
  assert.equal(timeToExpiryYears(before, after, 0), 0);
  assert.equal(new Date(chicagoWallClockToUtc("2026-01-15")).toISOString(), "2026-01-15T23:15:00.000Z");
  assert.equal(new Date(chicagoWallClockToUtc("2026-07-15")).toISOString(), "2026-07-15T22:15:00.000Z");
});

test("identical native-gamma input produces byte-stable output", () => {
  const map = positioningMap([
    record(95, "PUT", 600), record(100, "CALL", 900), record(105, "CALL", 750), record(105, "PUT", 500),
  ]);
  const first = JSON.stringify(deriveNativeGammaSnapshot(map, 101.25, NOW));
  const second = JSON.stringify(deriveNativeGammaSnapshot(map, 101.25, NOW));
  assert.equal(first, second);
});
