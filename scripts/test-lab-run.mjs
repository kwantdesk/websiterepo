import assert from "node:assert/strict";

import { buildLabSnapshotFromGameplan, labRunPhase, labTargetSessionDate } from "../src/lib/labRun.ts";
import { isLabSnapshot } from "../src/lib/labSnapshot.ts";

function payload({ spot = 99, flip = 100, generatedAt = "2026-08-25T11:30:00.000Z" } = {}) {
  const setup = (side) => ({
    side,
    quality_score: side === "SHORT" ? 82 : 75,
    quality_grade: side === "SHORT" ? "A+" : "A",
    setup_name: `${side} verified wall`,
    zone: side === "SHORT" ? [102, 103] : [95, 96],
    level_name: "VERIFIED WALL",
    level_role: "wall",
    permission: "Wait for a failed retest and displacement away from the wall.",
    options_alignment: "Aligned",
    reasoning: ["Source-backed test setup."],
    entry_reference: side === "SHORT" ? 102 : 96,
    stop: side === "SHORT" ? 104 : 94,
    targets: side === "SHORT" ? [98, 95] : [100, 103],
    target_details: [],
    best_risk_reward: 2,
    invalidation: "Acceptance through the stop.",
  });
  return {
    instrument: "NQ",
    source_symbol: "NDX",
    current_price: spot,
    status: "LIVE",
    generated_at: generatedAt,
    refresh_after_ms: 60_000,
    plan: {
      edition: {
        session: "newyork",
        date: "2026-08-25",
        published_at: generatedAt,
        data_basis: "options positioning 2026-08-25",
        freshness_note: "Test source receipts.",
      },
      environment: {
        tape: { state: "snowball", flip_price: flip, plain: "Negative-gamma tape." },
        fear: { ratio: 1.1, plain: "Balanced volatility." },
        flow: { lean: -0.4, plain: "Bearish premium lean." },
        expiry: { relevant: true, plain: "Same-day positioning active." },
      },
      one_liner: "Follow accepted weakness below the flip.",
      ladder: [{
        zone: [102, 103],
        name: "CALL WALL",
        role: "wall",
        strength: 5,
        sources: ["positioning"],
        why: "Verified positioning concentration.",
        if_visit: "Watch the first reaction.",
        if_hold: "A rejection keeps the lower door in play.",
        if_break: "Acceptance above the wall invalidates the rejection.",
        order_character: { balance: -0.72, plain: "Resistance-like." },
        terrain: "sticky",
        history: "",
        career: [],
      }],
      belly_zones: [[99, 101]],
      scenarios: [{ name: "Continuation", trigger: "Failed reclaim.", path: [99, 98, 95], kill: "Hold above 103.", weight: 0.55 }],
      one_trade: {
        zone: [102, 103],
        long_side: setup("LONG"),
        short_side: setup("SHORT"),
        not_a_trade_if: "No displacement prints.",
      },
      receipts: { date: "2026-08-24", levels: [], one_trade_outcome: "Awaiting grade.", honest_note: "No outcome." },
      downloads: { deepchart_xml: "", sierra_csv: "" },
    },
  };
}

function sources(status = "FROZEN", asOf = "2026-08-25T11:30:00.000Z") {
  return {
    options: { source: "KwantData", asOf, status, detail: "Verified positioning." },
    futures: { source: "Databento", asOf, status, detail: "Verified futures calibration." },
    marketOpen: status === "LIVE",
    errors: [],
  };
}

function referees(at) {
  const timestamp = Date.parse(at);
  return [
    { symbol: "VIX", lastPrice: 15.2, changePercent: -1, timestamp, delayed: false, marketOpen: true, provider: "Massive" },
    { symbol: "NDX", lastPrice: 23_000, changePercent: -0.4, timestamp, delayed: false, marketOpen: true, provider: "KwantData" },
    { symbol: "SPX", lastPrice: 6_000, changePercent: -0.2, timestamp, delayed: false, marketOpen: true, provider: "KwantData" },
  ];
}

const firstAt = new Date("2026-08-25T11:30:00.000Z");
const firstPayload = payload();
firstPayload.plan.edition.date = "2026-08-24";
firstPayload.plan.edition.data_basis = "options positioning 2026-08-24";
const first = buildLabSnapshotFromGameplan(firstPayload, {
  now: firstAt,
  sources: sources(),
  referees: referees(firstAt.toISOString()),
  commit: "test-commit",
});
assert.equal(isLabSnapshot(first), true);
assert.equal(first.phase, "PREOPEN");
assert.equal(first.sessionDate, "2026-08-25");
assert.equal(first.mode.value, "FOLLOW");
assert.equal(first.mode.prior, true);
assert.equal(first.film.status, "NO_FILM");
assert.equal(first.trade.side, "SHORT");
assert.equal(first.trade.status, "WAIT");
assert.equal(first.gates.find((gate) => gate.id === "film")?.status, "STOP");
assert.match(first.updates.at(-1).body, /One frame/i);

const secondAt = new Date("2026-08-25T13:31:00.000Z");
const second = buildLabSnapshotFromGameplan(payload({ spot: 98, flip: 99.5, generatedAt: secondAt.toISOString() }), {
  now: secondAt,
  prior: first,
  sources: sources("LIVE", secondAt.toISOString()),
  referees: referees(secondAt.toISOString()),
  commit: "test-commit",
});
assert.equal(second.phase, "LIVE");
assert.equal(second.film.status, "READY");
assert.equal(second.film.priorAsOf, first.updatedAt);
assert.equal(second.film.deltas.find((delta) => delta.id === "spot")?.delta, -1);
assert.equal(second.film.deltas.find((delta) => delta.id === "flip")?.direction, "CHASING_DOWN");
assert.equal(second.gates.find((gate) => gate.id === "film")?.status, "PASS");
assert.equal(second.updates.length, 2);

const staleAt = new Date("2026-08-25T18:31:00.000Z");
const stale = buildLabSnapshotFromGameplan(payload({ generatedAt: staleAt.toISOString() }), {
  now: staleAt,
  prior: second,
  sources: sources("LIVE", staleAt.toISOString()),
  referees: referees(staleAt.toISOString()),
  commit: "test-commit",
});
assert.equal(stale.film.status, "STALE");
assert.equal(labRunPhase(new Date("2026-08-29T14:00:00.000Z")), "CLOSED");
assert.equal(labTargetSessionDate(new Date("2026-08-29T14:00:00.000Z")), "2026-08-31");

console.log("THE LAB manual run: 20 assertions passed");
