import "./alias-hook.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";
const sessions = await import("../src/lib/volumeProfileSessions.ts");
const { cmeSessionDateKey, cmeSessionWindowForDate } = await import("../src/lib/chartHistoryWindow.ts");
const { normalizeStoredIndicator, defaultIndicatorSettings } = await import("../src/lib/chartIndicatorConfig.ts");
const { planVolumeProfileVariantJobs } = await import("../src/lib/volumeProfileVariants.ts");
const { calculateVolumeProfileValueArea } = await import("../src/lib/volumeProfileMath.ts");
const oldSource = execFileSync("git", ["show", "cf7ff1c1:src/lib/volumeProfileSessions.ts"], { encoding: "utf8" });
const oldJs = ts.transpileModule(oldSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const baseline = await import("data:text/javascript;base64," + Buffer.from(oldJs).toString("base64"));
const config = { ...sessions.DEFAULT_SESSION_FILTER, mode: "triple" };
const selected = { filterMode: "triple", sessionSelectionArmed: true, sessionAsiaEnabled: true, sessionLondonEnabled: false, sessionNewYorkEnabled: true };
const renamed = rows => rows.map(row => ({ ...row, label: row.id === "asia" ? "Globex" : row.label }));
const windowFor = date => { const day = cmeSessionWindowForDate(date); return sessions.resolveSessionSegments(day.startMs, day.endMs, config); };

test("all old calculation windows match the restored version exactly; only Asia's label changes", () => {
  for (const [start, end] of [["2026-10-29T12:00:00Z", "2026-10-31T12:00:00Z"], ["2026-03-06T00:00:00Z", "2026-03-11T00:00:00Z"], ["2026-10-29T00:00:00Z", "2026-11-05T00:00:00Z"]]) {
    for (const mode of ["none", "filter", "splitted", "triple"]) for (const window of ["rth", "eth", "custom"]) {
      const args = [Date.parse(start), Date.parse(end), { ...config, mode, window, customStartMinutes: 18 * 60, customEndMinutes: 2 * 60 }];
      assert.deepEqual(sessions.resolveSessionSegments(...args).filter(s => s.id !== "tokyo"), renamed(baseline.resolveSessionSegments(...args)));
    }
  }
});
test("the new Tokyo start is always 10:00 Brisbane, through both US DST changes", () => {
  const local = t => new Intl.DateTimeFormat("en-GB", { timeZone: "Australia/Brisbane", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(t);
  for (const date of ["2026-03-06", "2026-03-09", "2026-10-30", "2026-11-02"]) {
    const rows = windowFor(date), globex = rows.find(s => s.id === "asia"), tokyo = rows.find(s => s.id === "tokyo");
    assert.ok(tokyo); assert.equal(local(tokyo.startMs), "10:00");
    assert.equal(tokyo.endMs, globex.endMs); assert.ok(tokyo.startMs > globex.startMs);
  }
});
test("Tokyo does not create weekend windows", () => {
  const rows = sessions.resolveSessionSegments(Date.parse("2026-10-29T00:00:00Z"), Date.parse("2026-11-04T00:00:00Z"), config).filter(r => r.id === "tokyo");
  assert.ok(rows.length); for (const r of rows) assert.ok(![0, 6].includes(new Date(r.startMs).getUTCDay()));
});
test("existing saved selections still select the identical tape; Tokyo defaults off", () => {
  for (const sessionAsiaEnabled of [false, true]) for (const sessionLondonEnabled of [false, true]) for (const sessionNewYorkEnabled of [false, true]) {
    const settings = { ...selected, sessionAsiaEnabled, sessionLondonEnabled, sessionNewYorkEnabled };
    assert.deepEqual([...sessions.requestedSessionIds(settings)], [...baseline.requestedSessionIds(settings)]);
    const saved = { indicatorId: "kwant-profile", instanceId: "daily", enabled: true, settings }, restored = normalizeStoredIndicator(saved);
    assert.equal(restored.settings.sessionTokyoEnabled, false);
    for (const k of Object.keys(settings)) assert.equal(restored.settings[k], settings[k]);
    assert.deepEqual(normalizeStoredIndicator(restored), restored);
  }
  assert.equal(defaultIndicatorSettings("kwant-profile").sessionTokyoEnabled, false);
  assert.deepEqual([...sessions.requestedSessionIds({ ...selected, sessionTokyoEnabled: true })], ["asia", "tokyo", "newyork"]);
});
test("Globex retains identical volume, POC and value-area levels after the label change", () => {
  const day = cmeSessionWindowForDate("2026-10-30"), before = baseline.resolveSessionSegments(day.startMs, day.endMs, config).find(s => s.id === "asia"), after = windowFor("2026-10-30").find(s => s.id === "asia");
  const prints = Array.from({ length: 100 }, (_, i) => ({ timestamp: before.startMs + i * 300000, price: 20000 + (i % 9) * .25, volume: i + 1 }));
  const build = s => { const rows = new Map(); for (const p of prints) if (p.timestamp >= s.startMs && p.timestamp < s.endMs) rows.set(p.price, (rows.get(p.price) ?? 0) + p.volume); return [...rows].map(([price, volume]) => ({ price, volume })); };
  assert.deepEqual(build(after), build(before));
  assert.deepEqual(calculateVolumeProfileValueArea(build(after), .25, 68), calculateVolumeProfileValueArea(build(before), .25, 68));
});
test("session variant request keys and old execution bounds are unaffected when Tokyo is enabled", () => {
  const args = { candles: [], visibleLogicalRange: null, intervalMs: 60000, clockMs: Date.parse("2026-10-30T20:00:00Z"), symbol: "NQ" };
  const instance = settings => ({ indicatorId: "session-volume-profile", instanceId: "sessions", enabled: true, settings: { ...settings, numberOfProfiles: 1 } });
  const oldJobs = planVolumeProfileVariantJobs({ ...args, instances: [instance(selected)] });
  const extraJobs = planVolumeProfileVariantJobs({ ...args, instances: [instance({ ...selected, sessionTokyoEnabled: true })] });
  assert.equal(oldJobs.length, 2); assert.equal(extraJobs.length, 3);
  for (const old of oldJobs) assert.deepEqual(extraJobs.find(j => j.key === old.key), old);
  assert.ok(oldJobs.some(j => j.label.endsWith("Globex"))); assert.ok(extraJobs.some(j => j.label.endsWith("Asia")));
});
test("actual daily planner adds Tokyo independently without moving Globex or New York", () => {
  const source = readFileSync("src/components/KwantifyWorkspace.tsx", "utf8"), ast = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ["sessionFilterModeFor", "sessionFilterTimeFor", "sessionSegmentsForTradingDate"], found = new Map();
  function visit(n) { if (ts.isVariableDeclaration(n) && names.includes(n.name.getText(ast))) found.set(n.name.getText(ast), n.initializer.getText(ast)); ts.forEachChild(n, visit); } visit(ast);
  const dependencies = { ...sessions, chicagoTradingDate: cmeSessionDateKey };
  const js = ts.transpileModule(names.map(n => `const ${n}=${found.get(n)};`).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const plan = new Function(...Object.keys(dependencies), js + ";return sessionSegmentsForTradingDate;")(...Object.values(dependencies));
  for (const date of ["2026-03-09", "2026-10-30", "2026-11-02"]) for (const useEndSessionAsStartDay of [false, true]) {
    const before = plan(date, { ...selected, useEndSessionAsStartDay }), after = plan(date, { ...selected, useEndSessionAsStartDay, sessionTokyoEnabled: true });
    assert.deepEqual([...new Set(before.map(p => p.label))], ["Globex", "New York"]);
    assert.deepEqual(after.filter(s => s.id !== "tokyo"), before);
    assert.deepEqual([...new Set(after.map(p => p.label))], ["Globex", "Asia", "New York"]);
  }
});
test("saved explicit Tokyo selection and per-session pruning survive normalization", () => {
  const settings = { ...selected, sessionTokyoEnabled: true }, saved = { indicatorId: "kwant-profile", instanceId: "daily", enabled: true, settings };
  assert.equal(normalizeStoredIndicator(saved).settings.sessionTokyoEnabled, true);
  const ids = sessions.requestedSessionIds({ ...settings, sessionAsiaEnabled: false });
  assert.equal(sessions.profileMatchesRequestedSessions("asia", ids), false);
  assert.equal(sessions.profileMatchesRequestedSessions("tokyo", ids), true);
});
