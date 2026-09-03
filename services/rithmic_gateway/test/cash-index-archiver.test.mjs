import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { CashIndexArchiver } from "../src/cash-index-archiver.mjs";

// Wednesday 2026-08-19, 17:30 New York (21:30 UTC in EDT) — after the close.
const AFTER_CLOSE = Date.parse("2026-08-19T21:30:00Z");
// Same day, 11:00 New York — mid-session.
const MID_SESSION = Date.parse("2026-08-19T15:00:00Z");

function providerPayload(bars, startMs = Date.parse("2026-08-19T13:30:00Z")) {
  const data = {};
  for (let index = 0; index < bars; index += 1) {
    data[String(startMs + index * 60_000)] = {
      openPrice: 770 + index * 0.01,
      highPrice: 770.5 + index * 0.01,
      lowPrice: 769.6 + index * 0.01,
      closePrice: 770.2 + index * 0.01,
      volume: 1000 + index,
    };
  }
  return { data };
}

function fakeFetch(responder) {
  const calls = [];
  const impl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const result = responder(body);
    return {
      ok: true,
      status: 200,
      json: async () => result,
    };
  };
  return { impl, calls };
}

test("archives a completed session's real minute bars to disk", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cash-index-"));
  const { impl, calls } = fakeFetch(() => providerPayload(390));
  const rawResponses = [];
  const archiver = new CashIndexArchiver({
    dir,
    apiKey: "test-key",
    tickers: ["SPY"],
    fetchImpl: impl,
    archiveResponse: (entry) => rawResponses.push(entry),
    now: () => AFTER_CLOSE,
  });
  assert.equal(archiver.latestCompletedSessionDate(), "2026-08-19", "after the close, today is archivable");
  await archiver.runOnce();
  assert.ok(calls.length >= 1);
  assert.equal(calls[0].filter.ticker, "SPY");
  assert.equal(calls[0].aggregationPeriod, "1m");

  const stored = await archiver.readSession("SPY", "2026-08-19");
  assert.ok(stored, "session written to disk");
  assert.equal(stored.bars, 390);
  assert.equal(stored.complete, true);
  assert.equal(stored.candles.length, 390);
  const sample = stored.candles[10];
  assert.ok(sample.high > Math.max(sample.open, sample.close), "real wicks survive the round trip");
  assert.ok(rawResponses.length >= 1, "the direct cash-index pull bypassed the raw QuantData archive");
  assert.equal(JSON.parse(rawResponses[0].requestBody).filter.ticker, "SPY");
  assert.equal(Object.keys(JSON.parse(rawResponses[0].payload).data).length, 390);
});

test("mid-session it archives the PRIOR day, never today's partial", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cash-index-"));
  const { impl, calls } = fakeFetch((body) => providerPayload(390, Date.parse(`${body.sessionDate}T13:30:00Z`)));
  const archiver = new CashIndexArchiver({
    dir,
    apiKey: "test-key",
    tickers: ["SPX"],
    fetchImpl: impl,
    now: () => MID_SESSION,
  });
  assert.equal(archiver.latestCompletedSessionDate(), "2026-08-18");
  await archiver.runOnce();
  assert.ok(calls.every((body) => body.sessionDate !== "2026-08-19"), "today is never requested before the close");
  assert.ok(await archiver.readSession("SPX", "2026-08-18"));
});

test("partial pulls are stored, flagged, and retried until complete", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cash-index-"));
  let bars = 120;
  const { impl } = fakeFetch(() => providerPayload(bars));
  const archiver = new CashIndexArchiver({
    dir,
    apiKey: "test-key",
    tickers: ["QQQ"],
    fetchImpl: impl,
    now: () => AFTER_CLOSE,
  });
  await archiver.runOnce();
  let stored = await archiver.readSession("QQQ", "2026-08-19");
  assert.equal(stored.complete, false, "a thin session is flagged partial");
  assert.equal(stored.bars, 120);

  bars = 390;
  await archiver.runOnce();
  stored = await archiver.readSession("QQQ", "2026-08-19");
  assert.equal(stored.complete, true, "the retry replaced the partial with the full session");
  assert.equal(stored.bars, 390);

  // A later shrunken provider response must never regress the stored session.
  bars = 40;
  await archiver.runOnce();
  stored = await archiver.readSession("QQQ", "2026-08-19");
  assert.equal(stored.bars, 390, "complete sessions are immutable");
});

test("weekends resolve to the prior Friday and backfill skips weekend dates", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cash-index-"));
  const { impl, calls } = fakeFetch((body) => providerPayload(390, Date.parse(`${body.sessionDate}T13:30:00Z`)));
  // Saturday 2026-08-22 12:00 New York.
  const archiver = new CashIndexArchiver({
    dir,
    apiKey: "test-key",
    tickers: ["SPY"],
    fetchImpl: impl,
    now: () => Date.parse("2026-08-22T16:00:00Z"),
  });
  assert.equal(archiver.latestCompletedSessionDate(), "2026-08-21", "Saturday archives Friday");
  await archiver.runOnce();
  const requested = calls.map((body) => body.sessionDate);
  assert.ok(requested.includes("2026-08-21"));
  assert.ok(requested.every((date) => {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    return weekday !== 0 && weekday !== 6;
  }), "no weekend session dates are ever requested");
});

test("disabled without an API key or archive directory", async () => {
  const archiver = new CashIndexArchiver({ dir: null, apiKey: "x", fetchImpl: async () => { throw new Error("no"); } });
  assert.equal(archiver.enabled, false);
  const noKey = new CashIndexArchiver({ dir: mkdtempSync(join(tmpdir(), "cash-index-")), apiKey: "", fetchImpl: async () => { throw new Error("no"); } });
  assert.equal(noKey.enabled, false);
  await noKey.runOnce();
});
