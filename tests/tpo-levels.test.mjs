import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TPO_ENGINE_CONFIG,
  applyTpoDisplayCap,
  buildTpoSessionProfile,
  completedNqRthWindows,
  computeTpoLevels,
  detectTpoStructures,
  isNqOutrightDefinition,
  mergeTpoStructures,
  nqRthWindow,
  resolveFrontMonthDefinition,
  scoreTpoFormation,
  staleTpoPayload,
  tpoBracketIndex,
  updateTpoZoneLifecycle,
} from "../src/lib/tpoLevels.ts";

const config = { minimumTrades: 0, rowSize: 1 };

function session(date = "2026-08-05") {
  return { ...nqRthWindow(date), trades: [], contract: "NQU6" };
}

function gridSession(bracketRows, date = "2026-08-05") {
  const next = session(date);
  next.trades = bracketRows.flatMap((rows, bracket) => rows.map((row, index) => ({
    timestamp: next.start + bracket * 30 * 60_000 + 1_000 + index,
    price: row,
    size: 1,
  })));
  return next;
}

function profileFromCounts(counts, volumes = counts.map(() => 100), date = "2026-08-05") {
  const start = nqRthWindow(date).start;
  const rows = counts.map((tpoCount, index) => ({
    row: 100 + index,
    price: 100 + index,
    brackets: Array.from({ length: tpoCount }, (_, bracket) => bracket),
    tpoCount,
    volume: volumes[index] ?? 100,
  }));
  return {
    date,
    start,
    end: nqRthWindow(date).end,
    contract: "NQU6",
    tradeCount: 10_000,
    excluded: false,
    excludedReason: null,
    lowRow: 100,
    highRow: 100 + counts.length - 1,
    rows,
    brackets: Array.from({ length: 13 }, (_, index) => ({
      index,
      letter: String.fromCharCode(65 + index),
      openRow: 103,
      highRow: 100 + counts.length - 2,
      lowRow: 101,
      closeRow: 104,
    })),
    meanRowVolume: volumes.reduce((sum, value) => sum + value, 0) / volumes.length,
    maxTpoCount: Math.max(...counts),
  };
}

function raw(overrides = {}) {
  const formation = nqRthWindow("2026-08-03");
  return {
    type: "SELL_TAIL",
    side: "RESISTANCE",
    low: 110,
    high: 113,
    formationSession: "2026-08-03",
    formationStart: new Date(formation.start).toISOString(),
    formationEnd: new Date(formation.end).toISOString(),
    contract: "NQU6",
    tpoCount: 1,
    volumeConfirmation: false,
    lvnValue: null,
    confluenceReasons: ["TPO SELL TAIL"],
    direction: -1,
    edgeSharpness: 0,
    departureImpulse: 2,
    heightRows: 4,
    minimumRows: 3,
    repeated: false,
    ...overrides,
  };
}

function zone(overrides = {}) {
  const base = mergeTpoStructures([raw()], [])[0];
  return { ...base, ...overrides };
}

test("sell and buy tails obey the three-row minimum", () => {
  const buy = buildTpoSessionProfile(gridSession([
    [100, 101, 102, 103, 104, 105, 106],
    [103, 104, 105, 106],
  ]), config);
  assert.equal(detectTpoStructures(buy, null, config).filter((item) => item.type === "BUY_TAIL").length, 1);
  const tooShort = buildTpoSessionProfile(gridSession([
    [100, 101, 102, 103, 104],
    [102, 103, 104],
  ]), config);
  assert.equal(detectTpoStructures(tooShort, null, config).filter((item) => item.type === "BUY_TAIL").length, 0);
  const sell = buildTpoSessionProfile(gridSession([
    [100, 101, 102, 103, 104, 105, 106],
    [100, 101, 102, 103],
  ]), config);
  assert.equal(detectTpoStructures(sell, null, config).filter((item) => item.type === "SELL_TAIL").length, 1);
});

test("interior single prints require four rows and never replace an extreme tail", () => {
  const profile = buildTpoSessionProfile(gridSession([
    [100, 101, 102, 103, 104, 105, 106, 107, 112, 113, 114, 115],
    [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115],
  ]), config);
  const structures = detectTpoStructures(profile, null, config);
  const single = structures.find((item) => item.type === "SINGLE_PRINT");
  assert.ok(single);
  assert.deepEqual([single.low, single.high], [107.5, 111.5]);
  const boundary = buildTpoSessionProfile(gridSession([[100, 101, 102, 103, 104], [104]]), config);
  assert.equal(detectTpoStructures(boundary, null, config).some((item) => item.type === "SINGLE_PRINT"), false);
});

test("16:00 is end-exclusive: 13 brackets, one continuous tail and no false interior corridor", () => {
  const input = gridSession([
    [100, 101, 102, 103, 104, 105, 106],
    [103, 104, 105, 106],
  ]);
  input.trades.push({ timestamp: input.end, price: 101, size: 50 });
  const profile = buildTpoSessionProfile(input, config);
  const structures = detectTpoStructures(profile, null, config);
  assert.equal(tpoBracketIndex(input.end, input.start, input.end), -1);
  assert.ok(profile.brackets.every((bracket) => bracket.index <= 12));
  assert.equal(structures.filter((item) => item.type === "BUY_TAIL").length, 1);
  assert.equal(structures.filter((item) => item.type === "SINGLE_PRINT").length, 0);
});

test("ledge requires three bracket extremes with plus/minus one-row tolerance", () => {
  const fires = profileFromCounts([2, 4, 6, 6, 4, 2]);
  fires.brackets = [
    { index: 0, letter: "A", openRow: 102, highRow: 105, lowRow: 100, closeRow: 103 },
    { index: 1, letter: "B", openRow: 102, highRow: 104, lowRow: 100, closeRow: 103 },
    { index: 2, letter: "C", openRow: 102, highRow: 105, lowRow: 101, closeRow: 103 },
  ];
  assert.ok(detectTpoStructures(fires, null, config).some((item) => item.type === "LEDGE" && item.side === "RESISTANCE"));
  fires.brackets = fires.brackets.slice(0, 2);
  assert.equal(detectTpoStructures(fires, null, config).some((item) => item.type === "LEDGE"), false);
});

test("failed auction requires a thin five-row extension and a same/next-bracket return", () => {
  const prior = profileFromCounts(Array(11).fill(4), Array(11).fill(100), "2026-08-03");
  const current = profileFromCounts([...Array(11).fill(4), 1, 1, 1, 1, 1], Array(16).fill(100), "2026-08-04");
  current.brackets = [
    { index: 0, letter: "A", openRow: 111, highRow: 115, lowRow: 111, closeRow: 114 },
    { index: 1, letter: "B", openRow: 114, highRow: 114, lowRow: 110, closeRow: 110 },
  ];
  assert.ok(detectTpoStructures(current, prior, config).some((item) => item.type === "FAILED_AUCTION"));
  current.brackets[1].index = 2;
  assert.equal(detectTpoStructures(current, prior, config).some((item) => item.type === "FAILED_AUCTION"), false);
});

test("profile edge is the smoothed cliff, not a 70-percent value-area boundary", () => {
  const counts = [0, 0, 1, 2, 10, 10, 10, 10, 10, 10, 2, 1, 0, 0];
  const profile = profileFromCounts(counts);
  const edges = detectTpoStructures(profile, null, config).filter((item) => item.type === "PROFILE_EDGE");
  assert.ok(edges.length >= 2);
  assert.ok(edges.some((edge) => edge.low >= 108.5 && edge.high <= 111.5));
  assert.ok(edges.every((edge) => !((edge.low + edge.high) / 2 > 104.5 && (edge.low + edge.high) / 2 < 108.5)));
});

test("low-time seam fires between accepted peaks and LVN agreement raises score without being required", () => {
  const counts = [1, 7, 10, 10, 8, 1, 0, 1, 8, 10, 10, 7, 1];
  const regular = profileFromCounts(counts, counts.map(() => 100));
  const lvnVolumes = counts.map((_, index) => index >= 5 && index <= 7 ? 5 : 100);
  const lvn = profileFromCounts(counts, lvnVolumes);
  const normalSeam = detectTpoStructures(regular, null, config).find((item) => item.type === "LOW_TIME_SEAM");
  const lvnSeam = detectTpoStructures(lvn, null, config).find((item) => item.type === "LOW_TIME_SEAM");
  assert.ok(normalSeam);
  assert.ok(lvnSeam);
  assert.equal(normalSeam.volumeConfirmation, false);
  assert.equal(lvnSeam.volumeConfirmation, true);
  assert.ok(scoreTpoFormation(lvnSeam) > scoreTpoFormation(normalSeam));
});

test("overlapping structures merge once and existing Automatic Levels boost rather than duplicate", () => {
  const merged = mergeTpoStructures([
    raw(),
    raw({ type: "SINGLE_PRINT", side: "RESISTANCE", low: 112, high: 115, confluenceReasons: ["TPO SINGLE PRINT"] }),
  ], [{ price: 113, label: "Previous day VAH" }]);
  assert.equal(merged.length, 1);
  assert.ok(merged[0].confluenceReasons.includes("TPO SELL TAIL"));
  assert.ok(merged[0].confluenceReasons.includes("TPO SINGLE PRINT"));
  assert.ok(merged[0].confluenceReasons.includes("Automatic level: Previous day VAH"));
});

test("lifecycle distinguishes wick, acceptance, flip, fill and expiry", () => {
  const formation = session("2026-08-03");
  const wick = gridSession([[109, 110, 111, 114, 109]], "2026-08-04");
  const wickState = updateTpoZoneLifecycle(zone(), [formation, wick], 109, config);
  assert.notEqual(wickState.state, "BROKEN");
  const accepted = gridSession([[114, 115], [114, 116]], "2026-08-04");
  const broken = updateTpoZoneLifecycle(zone(), [formation, accepted], 116, config);
  assert.equal(broken.state, "BROKEN");
  const flip = gridSession([[114, 115], [114, 116], [116, 113, 115]], "2026-08-04");
  assert.equal(updateTpoZoneLifecycle(zone(), [formation, flip], 115, config).state, "FLIPPED");
  const filledZone = zone({ type: "SINGLE_PRINT", confluenceReasons: ["TPO SINGLE PRINT"], low: 110, high: 113 });
  const fill = gridSession([[110, 111, 112, 113]], "2026-08-04");
  const filled = updateTpoZoneLifecycle(filledZone, [formation, fill], 114, config);
  assert.equal(filled.state, "ACCEPTED");
  assert.equal(filled.active, false);
  const oldSessions = Array.from({ length: 11 }, (_, index) => session(`2026-08-${String(4 + index).padStart(2, "0")}`));
  assert.equal(updateTpoZoneLifecycle(zone(), [formation, ...oldSessions], 100, config).state, "EXPIRED");
});

test("display cap renders three above and three below while retaining hidden payload zones", () => {
  const zones = Array.from({ length: 10 }, (_, index) => zone({
    id: `zone-${index}`,
    low: index < 5 ? 80 + index : 101 + index,
    high: index < 5 ? 81 + index : 102 + index,
    currentPriority: 100 - index,
  }));
  const capped = applyTpoDisplayCap(zones, 100, 3);
  assert.equal(capped.filter((item) => item.displayed).length, 6);
  assert.equal(capped.length, 10);
});

test("a zone crossing price consumes one of the strict six display slots", () => {
  const zones = Array.from({ length: 9 }, (_, index) => zone({
    id: `strict-${index}`,
    low: index === 8 ? 99 : index < 4 ? 101 + index : 90 + index,
    high: index === 8 ? 101 : index < 4 ? 102 + index : 91 + index,
    currentPriority: index === 8 ? 200 : 100 - index,
  }));
  const capped = applyTpoDisplayCap(zones, 100, 3);
  assert.equal(capped.filter((item) => item.displayed).length, 6);
  assert.equal(capped.find((item) => item.id === "strict-8")?.displayed, true);
});

test("definitions resolve the front outright, roll forward and reject spreads", () => {
  const now = Date.parse("2026-09-10T20:00:00Z");
  const definitions = [
    { instrumentId: 1, rawSymbol: "NQU6", expiration: Date.parse("2026-09-18T00:00:00Z"), instrumentClass: "F" },
    { instrumentId: 2, rawSymbol: "NQZ6", expiration: Date.parse("2026-12-18T00:00:00Z"), instrumentClass: "F" },
    { instrumentId: 3, rawSymbol: "NQU6-NQZ6", expiration: Date.parse("2026-12-18T00:00:00Z"), instrumentClass: "S" },
  ];
  assert.equal(isNqOutrightDefinition(definitions[2]), false);
  assert.equal(resolveFrontMonthDefinition(definitions, now)?.rawSymbol, "NQZ6");
});

test("March and November DST sessions both contain exactly 13 half-hour brackets", () => {
  for (const date of ["2026-03-09", "2026-11-02"]) {
    const next = session(date);
    next.trades = Array.from({ length: 13 }, (_, bracket) => ({
      timestamp: next.start + bracket * 30 * 60_000 + 1_000,
      price: 100 + bracket,
      size: 1,
    }));
    const profile = buildTpoSessionProfile(next, config);
    assert.equal(profile.brackets.length, 13);
    assert.deepEqual(profile.brackets.map((bracket) => bracket.letter), "ABCDEFGHIJKLM".split(""));
    assert.equal(next.end - next.start, 6.5 * 60 * 60_000);
  }
});

test("identical input produces byte-identical zones, scores and replay", () => {
  const sessions = [
    gridSession([[100, 101, 102, 103, 104], [103, 104]], "2026-08-03"),
    gridSession([[100, 101, 102, 103, 104], [103, 104]], "2026-08-04"),
  ];
  const first = computeTpoLevels(sessions, { currentPrice: 103, config: { ...config, historySessions: 10 } });
  const second = computeTpoLevels(sessions, { currentPrice: 103, config: { ...config, historySessions: 10 } });
  assert.equal(JSON.stringify({ zones: first.zones, replay: first.replay }), JSON.stringify({ zones: second.zones, replay: second.replay }));
});

test("failed refresh keeps the last good payload explicitly stale", () => {
  const generatedAt = "2026-08-05T20:00:00.000Z";
  const payload = {
    generatedAt,
    nextRefreshAt: "2026-08-06T20:00:00.000Z",
    sourceSessions: [],
    excludedSessions: [],
    dataAge: 0,
    stale: false,
    zones: [],
    replay: { calibrated: false, records: [], byStructure: {}, byStrengthBand: {} },
    currentPrice: null,
    source: { dataset: "GLBX.MDP3", schema: "trades", instrument: "NQ front-month outright", rowSize: 1, session: "09:30-16:00 America/New_York" },
  };
  const stale = staleTpoPayload(payload, Date.parse(generatedAt) + 5_000);
  assert.equal(stale.stale, true);
  assert.equal(stale.dataAge, 5_000);
});

test("completed-window selection is New York local and newest first", () => {
  const windows = completedNqRthWindows(Date.parse("2026-08-06T21:00:00Z"), 3);
  assert.deepEqual(windows.map((window) => window.date), ["2026-08-06", "2026-08-05", "2026-08-04"]);
});
