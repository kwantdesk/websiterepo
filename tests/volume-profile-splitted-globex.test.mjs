import "../scripts/alias-hook.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
const sessions = await import("../src/lib/volumeProfileSessions.ts");
const { cmeSessionDateKey, cmeSessionWindowForDate } = await import("../src/lib/chartHistoryWindow.ts");
const { planVolumeProfileVariantJobs } = await import("../src/lib/volumeProfileVariants.ts");
const { normalizeStoredIndicator } = await import("../src/lib/chartIndicatorConfig.ts");
const selected = { filterMode: "splitted", sessionSelectionArmed: true, sessionGlobexEnabled: true,
  sessionAsiaEnabled: false, sessionLondonEnabled: false, sessionNewYorkEnabled: true };
const ast = ts.createSourceFile("workspace.tsx", readFileSync("src/components/KwantifyWorkspace.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["sessionFilterModeFor", "sessionFilterTimeFor", "sessionSegmentsForTradingDate"], declarations = new Map();
function visit(n) { if (ts.isVariableDeclaration(n) && names.includes(n.name.getText(ast))) declarations.set(n.name.getText(ast), n.initializer.getText(ast)); ts.forEachChild(n, visit); }
visit(ast); assert.equal(declarations.size, names.length);
const dependencies = { ...sessions, chicagoTradingDate: cmeSessionDateKey };
const code = ts.transpileModule(names.map(n => `const ${n}=${declarations.get(n)};`).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const plan = new Function(...Object.keys(dependencies), `${code};return sessionSegmentsForTradingDate;`)(...Object.values(dependencies));

test("actual daily planner keeps full Globex and New York independently across DST and date attribution", () => {
  for (const date of ["2026-03-09", "2026-10-30", "2026-11-02"]) for (const useEndSessionAsStartDay of [false, true]) {
    const result = plan(date, { ...selected, useEndSessionAsStartDay }), day = cmeSessionWindowForDate(date);
    assert.deepEqual(result.map(r => r.id), ["globex", "newyork"]);
    assert.equal(result[0].startMs, day.startMs); assert.equal(result[0].endMs, day.endMs - 3600000);
    assert.ok(result[1].startMs > result[0].startMs); assert.ok(result[1].endMs < result[0].endMs);
  }
});
test("Globex includes executions during Asia, London, New York and post-cash trading", () => {
  const [globex, ny] = plan("2026-10-30", selected), day = cmeSessionWindowForDate("2026-10-30");
  for (const time of ["2026-10-29T23:00:00Z", "2026-10-30T01:00:00Z", "2026-10-30T09:00:00Z", "2026-10-30T15:00:00Z", "2026-10-30T20:30:00Z"]) {
    assert.ok(Date.parse(time) >= globex.startMs && Date.parse(time) < globex.endMs);
  }
  assert.equal(globex.endMs, day.endMs - 3600000); assert.equal(ny.startMs, Date.parse("2026-10-30T13:30:00Z"));
  assert.equal(ny.endMs, Date.parse("2026-10-30T20:00:00Z"));
});
test("switching individual sessions never shortens the full Globex envelope", () => {
  const expected = plan("2026-10-30", selected)[0];
  for (const sessionAsiaEnabled of [false, true]) for (const sessionLondonEnabled of [false, true]) for (const sessionNewYorkEnabled of [false, true]) {
    assert.deepEqual(plan("2026-10-30", { ...selected, sessionAsiaEnabled, sessionLondonEnabled, sessionNewYorkEnabled })[0], expected);
  }
});
test("legacy RTH/custom splits and opening-block Sessions retain their meanings", () => {
  assert.deepEqual(plan("2026-10-30", { ...selected, sessionSelectionArmed: false }).map(r => r.id), ["rth"]);
  assert.deepEqual(plan("2026-10-30", { ...selected, sessionSelectionArmed: false, filterTime: "custom", sessionStartMinutes: 510, sessionEndMinutes: 900 }).map(r => r.id), ["custom"]);
  const opening = plan("2026-10-30", { ...selected, filterMode: "triple" });
  assert.equal(opening[0].endMs, Date.parse("2026-10-30T00:00:00Z"));
});
test("saved selections restore and stale Asia/London identities are pruned", () => {
  const restored = normalizeStoredIndicator({ indicatorId: "kwant-profile", instanceId: "daily", enabled: true, settings: selected });
  assert.equal(restored.settings.filterMode, "splitted");
  const ids = sessions.requestedSessionIds(restored.settings);
  assert.deepEqual([...ids], ["globex", "newyork"]);
  assert.equal(sessions.profileMatchesRequestedSessions("asia", ids), false);
  assert.equal(sessions.profileMatchesRequestedSessions("london", ids), false);
});
test("session-profile variant jobs use full independent ranges and distinct cache identities", () => {
  const args = { candles: [], visibleLogicalRange: null, intervalMs: 60000, clockMs: Date.parse("2026-10-30T20:30:00Z"), symbol: "NQ" };
  const instance = { indicatorId: "session-volume-profile", instanceId: "sessions", enabled: true, settings: { ...selected, numberOfProfiles: 1 } };
  const jobs = planVolumeProfileVariantJobs({ ...args, instances: [instance] });
  assert.equal(jobs.length, 2);
  const globex = jobs.find(j => j.label.endsWith("Globex"));
  assert.equal(globex.request.endMs, cmeSessionWindowForDate("2026-10-30").endMs - 3600000);
  const prior = planVolumeProfileVariantJobs({ ...args, instances: [{ ...instance, settings: { ...instance.settings, filterMode: "triple" } }] });
  assert.notEqual(globex.key, prior.find(j => j.label.endsWith("Globex")).key);
});
