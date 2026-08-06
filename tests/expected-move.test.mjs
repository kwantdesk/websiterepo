import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPECTED_MOVE_TRADING_DAYS,
  buildExpectedMoveBand,
  chartSessionExpectedMove,
  expectedMoveLabel,
  expectedMovePercentFromIv,
  expectedMoveRange,
  expectedMoveRemainingFraction,
  expectedMoveSigmaRails,
  isExpectedMoveCalibrationUsable,
  newYorkExpectedMoveSessionBounds,
  staleExpectedMovePayload,
} from "../src/lib/expectedMove.ts";
import { isOptionsFuturesRatioSane } from "../src/lib/optionsFlow.ts";

const day = (date, open, high, low, close) => ({
  timestamp: Date.parse(`${date}T00:00:00.000Z`),
  open,
  high,
  low,
  close,
});

const candles = [
  day("2026-08-04", 98, 104, 96, 100),
  day("2026-08-05", 101, 103, 99, 102),
];

function baseRange() {
  return expectedMoveRange({
    priorAtmIv: 0.24,
    expiration: "2026-08-05",
    dailyCandles: candles,
    sessionDate: "2026-08-05",
    fallbackPrice: null,
  });
}

test("sqrt(252) is the single annualization convention on both backend paths", () => {
  const direct = baseRange();
  const chart = chartSessionExpectedMove({
    sessionDate: "2026-08-05",
    marketOpen: true,
    iv: { priorAtmIv: 0.24, atmIv: 0.30, expiration: "2026-08-05" },
    dailyCandles: candles,
    fallbackPrice: null,
  });
  assert.ok(direct && chart);
  assert.equal(EXPECTED_MOVE_TRADING_DAYS, 252);
  assert.equal(direct.movePercent, 0.24 / Math.sqrt(252));
  assert.equal(chart.movePercent, direct.movePercent);
  assert.equal(expectedMovePercentFromIv(0.24), direct.movePercent);
});

test("session mode uses the session open, labels close fallback, and stays symmetric", () => {
  const range = baseRange();
  assert.ok(range);
  assert.equal(range.anchorPrice, 101);
  assert.equal(range.anchorLabel, "SESSION_OPEN");
  const band = buildExpectedMoveBand({
    mode: "SESSION",
    range,
    scale: 40,
    currentPrice: 4_400,
    now: Date.now(),
    sessionDate: "2026-08-05",
    tickSize: 0.01,
  });
  assert.ok(band);
  assert.ok(Math.abs((band.high - band.anchor) - (band.anchor - band.low)) < 0.011);

  const fallback = expectedMoveRange({
    priorAtmIv: 0.24,
    expiration: "2026-08-06",
    dailyCandles: candles.slice(0, 1),
    sessionDate: "2026-08-06",
    fallbackPrice: 105,
  });
  assert.ok(fallback);
  assert.equal(fallback.anchorPrice, 100);
  assert.equal(fallback.anchorLabel, "LATEST_COMPLETED_CLOSE");
});

test("live mode recenters and decays by sqrt of remaining session time", () => {
  const range = baseRange();
  assert.ok(range);
  const { open, close } = newYorkExpectedMoveSessionBounds("2026-08-05");
  const session = buildExpectedMoveBand({
    mode: "SESSION", range, scale: 40, currentPrice: 4_040, now: open,
    sessionDate: "2026-08-05", tickSize: 0.000001,
  });
  const liveOpen = buildExpectedMoveBand({
    mode: "LIVE", range, scale: 40, currentPrice: 4_040, now: open,
    sessionDate: "2026-08-05", tickSize: 0.000001,
  });
  const liveMid = buildExpectedMoveBand({
    mode: "LIVE", range, scale: 40, currentPrice: 4_100, now: (open + close) / 2,
    sessionDate: "2026-08-05", tickSize: 0.000001,
  });
  const liveClose = buildExpectedMoveBand({
    mode: "LIVE", range, scale: 40, currentPrice: 4_150, now: close,
    sessionDate: "2026-08-05", tickSize: 0.000001,
  });
  assert.ok(session && liveOpen && liveMid && liveClose);
  assert.ok(Math.abs(liveOpen.movePoints - session.movePoints) < 1e-9);
  assert.equal(liveMid.anchor, 4_100);
  assert.ok(Math.abs(liveMid.movePoints - 4_100 * range.movePercent * Math.sqrt(0.5)) < 1e-9);
  assert.equal(liveClose.anchor, 4_150);
  assert.equal(liveClose.movePoints, 0);
  assert.equal(liveClose.high, liveClose.low);
  assert.equal(expectedMoveRemainingFraction(open, "2026-08-05"), 1);
  assert.equal(expectedMoveRemainingFraction(close, "2026-08-05"), 0);
});

test("missing IV is explicitly approximate and uses prior realized half-range", () => {
  const range = expectedMoveRange({
    priorAtmIv: null,
    expiration: null,
    dailyCandles: candles,
    sessionDate: "2026-08-05",
    fallbackPrice: null,
  });
  assert.ok(range);
  assert.equal(range.method, "PRIOR_REALIZED_RANGE");
  assert.equal(range.approximate, true);
  assert.equal(range.movePercent, (104 - 96) / (2 * 100));
  assert.equal(expectedMoveLabel({ approximate: true, side: "high", sigma: 1 }), "~EM high");
});

test("live calibration accepts sane NQ mapping and rejects insane or stale mappings", () => {
  const now = Date.now();
  const calibration = {
    sourceSymbol: "QQQ",
    targetInstrument: "NQ",
    sessionDate: "2026-08-05",
    scale: 41.2,
    calibratedAtMs: now - 60_000,
  };
  assert.equal(isOptionsFuturesRatioSane("QQQ", calibration.scale), true);
  assert.equal(isExpectedMoveCalibrationUsable({
    calibration, sourceSymbol: "QQQ", targetInstrument: "NQ", sessionDate: "2026-08-05",
    marketOpen: true, now, ratioIsSane: isOptionsFuturesRatioSane("QQQ", calibration.scale),
  }), true);
  assert.equal(isExpectedMoveCalibrationUsable({
    calibration: { ...calibration, scale: 50 }, sourceSymbol: "QQQ", targetInstrument: "NQ",
    sessionDate: "2026-08-05", marketOpen: true, now,
    ratioIsSane: isOptionsFuturesRatioSane("QQQ", 50),
  }), false);
  assert.equal(isExpectedMoveCalibrationUsable({
    calibration: { ...calibration, calibratedAtMs: now - 21 * 60_000 }, sourceSymbol: "QQQ",
    targetInstrument: "NQ", sessionDate: "2026-08-05", marketOpen: true, now,
    ratioIsSane: true,
  }), false);
});

test("two sigma rails are exactly twice the one-sigma offset", () => {
  const range = baseRange();
  assert.ok(range);
  const band = buildExpectedMoveBand({
    mode: "SESSION", range, scale: 40, currentPrice: 4_040, now: Date.now(),
    sessionDate: "2026-08-05", tickSize: 0.000001,
  });
  assert.ok(band);
  const rails = expectedMoveSigmaRails(band, 2);
  assert.ok(Math.abs((rails.high - band.anchor) - band.movePoints * 2) < 1e-9);
  assert.ok(Math.abs((band.anchor - rails.low) - band.movePoints * 2) < 1e-9);
  assert.match(expectedMoveLabel({ approximate: false, side: "high", sigma: 2 }), /^EM 2/);
});

test("failed pull fallback is retained with an explicit stale flag and age", () => {
  const range = baseRange();
  assert.ok(range);
  const generatedAt = "2026-08-05T13:30:00.000Z";
  const payload = {
    generatedAt,
    nextRefreshAt: "2026-08-06T13:30:00.000Z",
    sessionDate: "2026-08-05",
    sourceSymbol: "QQQ",
    marketOpen: true,
    stale: false,
    dataAge: 0,
    range,
  };
  const now = Date.parse(generatedAt) + 90_000;
  assert.deepEqual(staleExpectedMovePayload(payload, now), { ...payload, stale: true, dataAge: 90_000 });
});

test("identical inputs produce deterministic output", () => {
  const range = baseRange();
  assert.ok(range);
  const input = {
    mode: "SESSION",
    range,
    scale: 41.2,
    currentPrice: 4_161.2,
    now: Date.parse("2026-08-05T14:00:00.000Z"),
    sessionDate: "2026-08-05",
    tickSize: 0.25,
  };
  assert.deepEqual(buildExpectedMoveBand(input), buildExpectedMoveBand(input));
});

test("New York session bounds honor March and November DST changes", () => {
  assert.equal(new Date(newYorkExpectedMoveSessionBounds("2026-03-06").open).toISOString(), "2026-03-06T14:30:00.000Z");
  assert.equal(new Date(newYorkExpectedMoveSessionBounds("2026-03-09").open).toISOString(), "2026-03-09T13:30:00.000Z");
  assert.equal(new Date(newYorkExpectedMoveSessionBounds("2026-10-30").open).toISOString(), "2026-10-30T13:30:00.000Z");
  assert.equal(new Date(newYorkExpectedMoveSessionBounds("2026-11-02").open).toISOString(), "2026-11-02T14:30:00.000Z");
});
