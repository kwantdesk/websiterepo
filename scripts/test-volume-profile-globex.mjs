import "./alias-hook.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sessions = await import("../src/lib/volumeProfileSessions.ts");
const { normalizeStoredIndicator, defaultIndicatorSettings } = await import("../src/lib/chartIndicatorConfig.ts");
const { cmeSessionWindowForDate, cmeSessionDateKey } = await import("../src/lib/chartHistoryWindow.ts");
const { planVolumeProfileVariantJobs } = await import("../src/lib/volumeProfileVariants.ts");
const { resolveSessionSegments, currentDeskSession, requestedSessionIds, profileMatchesRequestedSessions } = sessions;
const split = { ...sessions.DEFAULT_SESSION_FILTER, mode: "triple" };
const at = Date.parse;
const selected = {
  profileSettingsVersion: 15, filterMode: "triple", sessionSelectionArmed: true,
  sessionGlobexEnabled: true, sessionAsiaEnabled: false,
  sessionLondonEnabled: false, sessionNewYorkEnabled: true,
};
const instance = (settings) => ({ indicatorId: "kwant-profile", instanceId: "daily-test", enabled: true, settings });
function windows(date) {
  const day = cmeSessionWindowForDate(date);
  assert.ok(day);
  return resolveSessionSegments(day.startMs, day.endMs, split);
}
const localClock = (ms) => new Intl.DateTimeFormat("en-GB", {
  timeZone: "Australia/Brisbane", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(ms);

test("Brisbane's 08:00 profile is Globex; the 10:00 profile is Asia", () => {
  const [globex, asia, london, newyork] = windows("2026-10-30");
  assert.deepEqual([globex.id, asia.id, london.id, newyork.id], ["globex", "asia", "london", "newyork"]);
  assert.equal(globex.label, "Globex"); assert.equal(asia.label, "Asia");
  assert.equal(localClock(globex.startMs), "08:00");
  assert.equal(localClock(asia.startMs), "10:00");
  assert.equal(globex.endMs, asia.startMs);
  assert.equal(globex.startMs, at("2026-10-29T22:00:00Z"));
  assert.equal(asia.startMs, at("2026-10-30T00:00:00Z"));
});

test("the handover includes each execution once, in its correct opening profile", () => {
  const [globex, asia] = windows("2026-10-30");
  const prints = [
    { time: globex.startMs, volume: 3 },
    { time: asia.startMs - 1, volume: 5 },
    { time: asia.startMs, volume: 7 },
  ];
  const totals = [globex, asia].map((s) => prints.filter((p) => p.time >= s.startMs && p.time < s.endMs).reduce((n, p) => n + p.volume, 0));
  assert.deepEqual(totals, [8, 7]);
  assert.equal(totals.reduce((a, b) => a + b), 15);
});

for (const [date, globexUtc] of [
  ["2026-03-06", "2026-03-05T23:00:00Z"],
  ["2026-03-09", "2026-03-08T22:00:00Z"],
  ["2026-10-30", "2026-10-29T22:00:00Z"],
  ["2026-11-02", "2026-11-01T23:00:00Z"],
]) {
  test(`${date}: US DST affects Globex; Tokyo/Brisbane's Asia open stays fixed`, () => {
    const [globex, asia] = windows(date);
    assert.equal(globex.startMs, at(globexUtc));
    assert.equal(asia.startMs, at(`${date}T00:00:00Z`));
    assert.equal(localClock(asia.startMs), "10:00");
    assert.equal(globex.endMs, asia.startMs);
    assert.equal(currentDeskSession(globex.startMs)?.id, "globex");
    assert.equal(currentDeskSession(asia.startMs - 1)?.id, "globex");
    assert.equal(currentDeskSession(asia.startMs)?.id, "asia");
    for (const s of windows(date)) assert.equal(cmeSessionDateKey(s.startMs), date);
  });
}

test("one historical request crossing autumn DST keeps both sets of exact boundaries", () => {
  const all = resolveSessionSegments(at("2026-10-29T22:00:00Z"), at("2026-11-03T22:00:00Z"), split);
  for (const date of ["2026-10-30", "2026-11-02", "2026-11-03"]) {
    const expected = windows(date);
    const owned = all.filter((s) => cmeSessionDateKey(s.startMs) === date);
    assert.deepEqual(owned, expected);
  }
  assert.equal(windows("2026-11-02").find((s) => s.id === "newyork").startMs, at("2026-11-02T14:30:00Z"));
});

test("exchange midnight is correct after either US clock change", () => {
  assert.equal(sessions.exchangeMidnightMs(at("2026-11-01T20:00:00Z")), at("2026-11-01T05:00:00Z"));
  assert.equal(sessions.exchangeMidnightMs(at("2026-03-08T20:00:00Z")), at("2026-03-08T06:00:00Z"));
});

test("saved Globex + New York stays exactly that selection after normalization", () => {
  const saved = structuredClone(selected);
  const restored = normalizeStoredIndicator(instance(saved));
  const ids = requestedSessionIds(restored.settings);
  assert.deepEqual([...ids], ["globex", "newyork"]);
  assert.deepEqual(windows("2026-10-30").filter((s) => ids.has(s.id)).map((s) => s.label), ["Globex", "New York"]);
  assert.ok(!profileMatchesRequestedSessions("asia", ids));
  assert.ok(!profileMatchesRequestedSessions("london", ids));
  assert.deepEqual(saved, selected);
  assert.deepEqual(normalizeStoredIndicator(restored), restored);
});

test("the actual Daily VP workspace planner publishes only Globex + New York on each date", async () => {
  const ts = (await import("typescript")).default;
  const source = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  const file = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ["sessionFilterModeFor", "sessionFilterTimeFor", "sessionSegmentsForTradingDate"];
  const initializers = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(file))) {
      initializers.set(node.name.getText(file), node.initializer.getText(file));
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.equal(initializers.size, names.length);
  const dependencies = {
    resolveSessionSegments, sessionTradingDate: sessions.sessionTradingDate,
    RTH_START_MINUTES: sessions.RTH_START_MINUTES, RTH_END_MINUTES: sessions.RTH_END_MINUTES,
    chicagoTradingDate: (ms) => cmeSessionDateKey(ms) ?? new Date(ms).toISOString().slice(0, 10),
  };
  const code = ts.transpileModule(names.map((name) => `const ${name} = ${initializers.get(name)};`).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const plan = new Function(...Object.keys(dependencies), `${code}\nreturn sessionSegmentsForTradingDate;`)(...Object.values(dependencies));
  for (const date of ["2026-03-09", "2026-10-30", "2026-11-02"]) {
    for (const useEndSessionAsStartDay of [false, true]) {
      const profiles = plan(date, { ...selected, useEndSessionAsStartDay });
      assert.deepEqual(profiles.map((p) => p.label), ["Globex", "New York"]);
      assert.deepEqual(profiles, windows(date).filter((s) => ["globex", "newyork"].includes(s.id)));
    }
  }
});

test("legacy merged-Asia settings preserve their tape coverage; explicit choices win", () => {
  for (const enabled of [true, false]) {
    const restored = normalizeStoredIndicator(instance({ profileSettingsVersion: 15, sessionAsiaEnabled: enabled }));
    assert.equal(restored.settings.sessionGlobexEnabled, enabled);
    assert.equal(restored.settings.sessionAsiaEnabled, enabled);
  }
  const restored = normalizeStoredIndicator(instance({ ...selected, sessionGlobexEnabled: false, sessionAsiaEnabled: true }));
  assert.equal(restored.settings.sessionGlobexEnabled, false);
  assert.equal(restored.settings.sessionAsiaEnabled, true);
  assert.equal(defaultIndicatorSettings("kwant-profile").sessionGlobexEnabled, true);
  const [globex, asia] = windows("2026-10-30");
  assert.equal(asia.endMs - globex.startMs, 9 * 3_600_000);
});

test("session-profile jobs request only the selected ranges, with independent cache keys", () => {
  const clockMs = at("2026-10-30T20:00:00Z");
  const jobs = planVolumeProfileVariantJobs({
    instances: [{ ...instance({ ...selected, numberOfProfiles: 1 }), indicatorId: "session-volume-profile" }],
    candles: [], visibleLogicalRange: null, intervalMs: 60_000, clockMs, symbol: "NQ",
  });
  assert.deepEqual(jobs.map((j) => j.label).sort(), ["2026-10-30 · Globex", "2026-10-30 · New York"]);
  assert.notEqual(jobs[0].key, jobs[1].key);
  const globex = jobs.find((j) => j.label.endsWith("Globex"));
  assert.equal(globex.request.startMs, at("2026-10-29T22:00:00Z"));
  assert.equal(globex.request.endMs, at("2026-10-30T00:00:00Z"));
});

test("closed-weekend windows cannot fold onto Friday's recorded profiles", () => {
  assert.deepEqual(resolveSessionSegments(at("2026-10-30T22:00:00Z"), at("2026-11-01T23:00:00Z"), split), []);
});

test("explicit RTH/overnight/custom windows keep their existing meaning", () => {
  const range = cmeSessionWindowForDate("2026-11-02");
  const rth = resolveSessionSegments(range.startMs, range.endMs, { ...split, mode: "filter", window: "rth" });
  const overnight = resolveSessionSegments(range.startMs, range.endMs, { ...split, mode: "filter", window: "eth" });
  assert.deepEqual(rth.map((s) => s.id), ["rth"]);
  assert.equal(rth[0].startMs, at("2026-11-02T14:30:00Z"));
  assert.deepEqual(overnight.map((s) => s.id), ["eth"]);
  assert.equal(overnight[0].startMs, range.startMs);
  assert.equal(overnight[0].endMs, rth[0].startMs);
  assert.equal(resolveSessionSegments(range.startMs, range.endMs, { ...split, mode: "none" }).length, 0);
});
