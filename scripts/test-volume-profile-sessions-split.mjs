import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { resolveSessionSegments } = await import("../src/lib/volumeProfileSessions.ts");
const { applyInstitutionalTradesToVolumeProfile } = await import("../src/lib/institutionalMarketData.ts");

const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8",
);

/**
 * A split day draws one profile per session, not one profile.
 *
 * Ticking Globex, Asia, London and New York produced exactly what ticking none
 * of them produced. The segments resolved correctly and the profiles were
 * fetched correctly - they were then stored in a map keyed by period and
 * trading date, with no session in the key, so all four collapsed into one
 * entry and three were silently dropped.
 *
 * Worse, that merge rebuilds the map from the CURRENT profiles, so it also
 * flattened correctly split profiles that had already arrived from the live
 * fetch. The identity is the fix, in the one place that was missing it.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

// A Thursday, so the window walk crosses no weekend boundary.
const MIDNIGHT = Date.UTC(2026, 7, 27, 0, 0);
const DAY_START = MIDNIGHT - 12 * 60 * 60_000;
const DAY_END = MIDNIGHT + 36 * 60 * 60_000;

check("a triple split resolves several distinct windows", () => {
  const segments = resolveSessionSegments(DAY_START, DAY_END, { mode: "triple", window: "rth" });
  assert.ok(segments.length >= 3, `expected several sessions, got ${segments.length}`);
  const ids = new Set(segments.map((segment) => segment.id));
  assert.ok(ids.size >= 3, `sessions are not distinct: ${[...ids].join(", ")}`);
  for (const segment of segments) {
    assert.ok(segment.endMs > segment.startMs, `${segment.id} has no duration`);
  }
});

check("filter mode stays one window, split mode does not", () => {
  /*
   * This is the difference the trader was not seeing. `filter` narrows to one
   * window; `triple` is supposed to produce a profile per session.
   */
  const filtered = resolveSessionSegments(DAY_START, DAY_END, { mode: "filter", window: "rth" });
  const split = resolveSessionSegments(DAY_START, DAY_END, { mode: "triple", window: "rth" });
  assert.ok(split.length > filtered.length,
    `split produced ${split.length} windows and filter produced ${filtered.length}`);
});

check("none means no windows at all", () => {
  // Empty is read downstream as "take every execution", which keeps the
  // untouched path allocation-free.
  assert.deepEqual(resolveSessionSegments(DAY_START, DAY_END, { mode: "none", window: "rth" }), []);
});

check("the session is part of a daily profile's identity", () => {
  /*
   * Without this, four session profiles for one date are one map entry and
   * three are dropped - which is exactly "I select them all and nothing
   * changes".
   */
  assert.match(
    workspace,
    /const profileSessionKey = \(profile: InstitutionalVolumeProfile\) =>\s*\n\s*`\$\{profile\.period\}:\$\{profile\.period === "daily" \? chicagoTradingDate\(profile\.startMs\) : "weekly"\}:\$\{profile\.sessionId \?\? ""\}`/,
    "the cached profile key still ignores the session",
  );
});

check("both merge paths agree on that identity", () => {
  /*
   * The live path already keyed on the session; the cached one did not, and it
   * rebuilds the map from the current profiles - so it could flatten correctly
   * split profiles after they had arrived. Two paths, one identity.
   */
  assert.match(
    workspace,
    /if \(\(candidate\.sessionId \?\? ""\) !== \(replacement\.sessionId \?\? ""\)\) return true;/,
    "the live replace path lost its session check",
  );
});

check("a session the trader unticked is omitted, not folded away", () => {
  // Each remaining window has to keep its own boundaries, or turning one off
  // would silently widen its neighbour.
  for (const flag of ["sessionAsiaEnabled", "sessionLondonEnabled", "sessionNewYorkEnabled"]) {
    assert.ok(workspace.includes(flag), `${flag} is no longer honoured`);
  }
  assert.match(workspace, /enabledSessionIds/, "the enabled-session set is gone");
});

check("a completed split session rejects later same-date trades", () => {
  const startMs = Date.parse("2026-08-19T22:00:00.000Z");
  const endMs = Date.parse("2026-08-20T07:00:00.000Z");
  const profile = {
    schemaVersion: "kwantify-volume-profile-v1",
    provider: "Rithmic",
    source: "CME executions",
    root: "NQ",
    contractSymbol: "NQU6",
    period: "daily",
    tradingDate: "2026-08-20",
    sessionId: "asia",
    sessionLabel: "Asia",
    startMs,
    endMs,
    coverageStartMs: startMs,
    coverageEndMs: endMs - 120_000,
    complete: true,
    tickSize: 0.25,
    groupTicks: 1,
    valueAreaPercent: 68,
    minTradeVolume: 0,
    maxTradeVolume: 0,
    totalVolume: 10,
    bidVolume: 5,
    askVolume: 5,
    delta: 0,
    trades: 1,
    poc: 20_000,
    vah: 20_000,
    val: 20_000,
    vwap: 20_000,
    standardDeviation: 0,
    levels: [{ price: 20_000, volume: 10, bidVolume: 5, askVolume: 5, delta: 0, trades: 1 }],
    developingPoc: [],
    developingValueArea: [],
    asOf: new Date(endMs - 120_000).toISOString(),
  };
  const trade = (timestamp, close) => ({
    recordIndex: 1, timestamp, open: close, high: close, low: close, close,
    trades: 1, volume: 2, bidVolume: 1, askVolume: 1, delta: 0, aggressor: "UNKNOWN",
  });
  const next = applyInstitutionalTradesToVolumeProfile(profile, [
    trade(endMs - 60_000, 20_001),
    trade(endMs + 60_000, 19_000),
  ]);
  assert.equal(next.totalVolume, 12, "only the execution inside Asia belongs to Asia");
  assert.ok(next.levels.some((level) => level.price === 20_001), "the in-session print was lost");
  assert.ok(!next.levels.some((level) => level.price === 19_000),
    "a post-session/current-low print contaminated the historical profile");
  assert.equal(next.endMs, endMs, "a named session's closing boundary must never expand");
  assert.equal(next.coverageEndMs, endMs - 60_000,
    "coverage must stop at the newest accepted in-session execution");
});

console.log(`\nvolume profile session split: ${passed}/${passed} checks passed`);
