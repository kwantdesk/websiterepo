import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as zones from "../src/lib/timeZones.ts";
import * as calendar from "../src/lib/economicCalendar.ts";
import { economicCalendarDateKey } from "../src/lib/economicCalendarFormatting.ts";
import { warmWorkspaceCodeInBackground } from "../src/lib/workspaceCodeWarmup.ts";

const require = createRequire(import.meta.url);
const read = file => fs.readFileSync(file, "utf8");
const baseline = file => execFileSync("git", ["show", `6d22ea26:${file}`], { encoding: "utf8", maxBuffer: 4000000 });
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function load(source, mocks = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(compile(source), { module, exports: module.exports, require: key => key in mocks ? mocks[key] : require(key), ...globals });
  return module.exports;
}
const oldZones = load(baseline("src/lib/timeZones.ts"));

test("cached timezone formatters retain exact legacy, invalid-zone and DST behavior", () => {
  const dates = ["2026-01-01T00:00:00Z", "2026-03-08T06:59:59Z", "2026-03-08T07:00:00Z", "2026-10-03T15:59:59Z", "2026-10-03T16:00:00Z", "2026-11-01T05:59:59Z", "2026-11-01T06:00:00Z"];
  for (const zone of ["UTC", "America/New_York", "Australia/Brisbane", "Australia/Sydney", "Europe/London", "Asia/Kathmandu", "Pacific/Chatham", "(UTC-5) New York", "invalid/zone"]) {
    assert.equal(zones.normalizeTimeZone(zone), oldZones.normalizeTimeZone(zone));
    for (const date of dates) assert.equal(zones.compactTimeZoneLabel(zone, new Date(date)), oldZones.compactTimeZoneLabel(zone, new Date(date)), `${zone}/${date}`);
  }
  for (const date of [new Date("2026-01-01"), new Date("2026-07-01")]) {
    assert.equal(JSON.stringify(zones.timeZoneOptions(date)), JSON.stringify(oldZones.timeZoneOptions(date)));
  }
});

test("closed timezone controls do not build the world timezone list on page entry", () => {
  let builds = 0;
  const mockedZones = { ...zones, timeZoneOptions: (...args) => { builds++; return zones.timeZoneOptions(...args); } };
  const Component = load(read("src/components/ui/TimeZoneSelect.tsx"), { "@/lib/timeZones": mockedZones }).default;
  const html = renderToStaticMarkup(React.createElement(Component, { value: "Australia/Brisbane", onChange() {}, referenceTimestampMs: Date.parse("2026-10-30T00:00:00Z") }));
  assert.match(html, /Brisbane/);
  assert.equal(builds, 0);
});

test("calendar day keys retain timezone boundaries while filtering repeated events", () => {
  for (const zone of ["America/New_York", "Australia/Brisbane", "Europe/London", "Asia/Kathmandu", "invalid/zone"]) {
    for (let i = 0; i < 250; i++) {
      const date = new Date(Date.parse("2026-03-07T00:00:00Z") + i * 1800000);
      const map = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: oldZones.normalizeTimeZone(zone), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map(part => [part.type, part.value]));
      assert.equal(economicCalendarDateKey(date, zone), `${map.year}-${map.month}-${map.day}`);
    }
  }
  assert.equal(economicCalendarDateKey("bad date", "UTC"), "");
});

function news(cache = null) {
  const storage = { getItem: key => key.includes("economic-calendar-cache") && cache ? JSON.stringify(cache) : null };
  const mocks = {
    "@/lib/timeZones": zones, "@/lib/economicCalendar": calendar,
    "@/lib/economicCalendarFormatting": { economicCalendarDateKey },
    "next/navigation": { usePathname: () => "/news", useSearchParams: () => new URLSearchParams() },
    "next/dynamic": { default: () => () => null },
    "@/components/ui/TimeZoneSelect": { default: () => React.createElement("button", { "aria-label": "Economic calendar timezone" }, "Timezone") },
    "@/components/ui/WorkspaceSubnav": { default: () => React.createElement("nav", {}, "News tabs") },
  };
  return load(read("src/components/news/NewsWorkspace.tsx"), mocks, { window: { localStorage: storage }, URLSearchParams }).default;
}

test("News calendar controls render before any calendar network response", () => {
  const html = renderToStaticMarkup(React.createElement(news(), { accountKey: "test" }));
  assert.match(html, /Economic Calendar/);
  assert.match(html, /aria-label="Previous day"/);
  assert.match(html, /aria-label="Economic calendar timezone"/);
  assert.match(html, /aria-label="Calendar events" aria-busy="true"/);
  assert.doesNotMatch(html, /Loading the economic calendar|No events match this view|No major release in this view/);
});

test("saved News calendar appears on its first render without waiting for effects", () => {
  const html = renderToStaticMarkup(React.createElement(news({ events: [], provider: "TradingView", fetchedAt: new Date().toISOString(), refreshAfterMs: 60000, coverage: { from: "2026-10-01", to: "2026-12-01", longRange: true }, partial: false, note: "saved calendar" }), { accountKey: "test" }));
  assert.match(html, /saved calendar/);
  assert.doesNotMatch(html, /aria-label="Calendar events" aria-busy="true"/);
});

test("normal News refreshes reuse the private HTTP cache; manual refresh explicitly reloads", async () => {
  const source = ts.createSourceFile("News.tsx", read("src/components/news/NewsWorkspace.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "loadCalendar") callback = node.initializer.arguments[0];
    ts.forEachChild(node, visit);
  };
  visit(source); assert.ok(callback);
  const requests = [], payloadRef = { current: null };
  const fn = load(`exports.run = ${callback.getText(source)};`, {}, {
    timeZone: "UTC", payloadRef, CALENDAR_HISTORY_DAYS: 7, CALENDAR_FORWARD_DAYS: 90,
    dateKey: economicCalendarDateKey, shiftDate: (date, days) => `${date}/${days}`,
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => ({ events: [] }) }; },
    sanitizeCalendarPayload: value => value, writeLocalStorage() {}, CALENDAR_CACHE_STORAGE_KEY: "test",
    setRefreshing() {}, setLoading() {}, setPayload() {}, setError() {},
  }).run;
  await fn(); await fn(true);
  assert.deepEqual(requests.map(row => row.options.cache), ["default", "reload"]);
  assert.ok(requests.every(row => row.url.startsWith("/api/economic-calendar?")));
});

const drain = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function idleQueue() {
  const queue = [];
  return { queue, schedule(task) { const token = { task }; queue.push(token); return () => { const i = queue.indexOf(token); if (i >= 0) queue.splice(i, 1); }; }, fire() { queue.shift()?.task(); } };
}

test("page code warms only during idle callbacks, once per destination and one import at a time", async () => {
  const idle = idleQueue(), loaded = [];
  let complete;
  const stop = warmWorkspaceCodeInBackground(["news", "news", "journal"], target => { loaded.push(target); return new Promise(resolve => { complete = resolve; }); }, idle.schedule);
  assert.deepEqual(loaded, []);
  idle.fire(); await drain();
  assert.deepEqual(loaded, ["news"]);
  assert.equal(idle.queue.length, 0);
  complete(); await drain();
  assert.equal(idle.queue.length, 1);
  idle.fire(); await drain();
  assert.deepEqual(loaded, ["news", "journal"]);
  complete(); await drain(); stop();
  assert.equal(idle.queue.length, 0);
});

test("page warmup failures and cancellation cannot hold navigation or start further work", async () => {
  const idle = idleQueue(), loaded = [];
  const stop = warmWorkspaceCodeInBackground(["news", "journal"], async target => { loaded.push(target); throw Error("chunk unavailable"); }, idle.schedule);
  idle.fire(); await drain();
  assert.equal(idle.queue.length, 1);
  stop(); idle.fire(); await drain();
  assert.deepEqual(loaded, ["news"]);
});

test("leaving the shell during a code download prevents the remaining warmup queue", async () => {
  const idle = idleQueue(), loaded = [];
  let complete;
  const stop = warmWorkspaceCodeInBackground(["news", "journal"], target => { loaded.push(target); return new Promise(resolve => { complete = resolve; }); }, idle.schedule);
  idle.fire(); await drain(); stop(); complete(); await drain();
  assert.deepEqual(loaded, ["news"]);
  assert.equal(idle.queue.length, 0);
});

test("background code downloads respect hidden tabs and data-saver connections", async () => {
  for (const connection of [{ saveData: true }, { effectiveType: "2g" }, { effectiveType: "slow-2g" }]) {
    let scheduled = 0;
    const helper = load(read("src/lib/workspaceCodeWarmup.ts"), {}, { navigator: { connection }, window: { requestIdleCallback() { scheduled++; } } });
    helper.warmWorkspaceCodeInBackground(["news"], async () => {});
    assert.equal(scheduled, 0);
  }
  const callbacks = [], listeners = new Map(), loaded = [];
  const document = { hidden: true, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
  const helper = load(read("src/lib/workspaceCodeWarmup.ts"), {}, { navigator: {}, document, window: { requestIdleCallback: fn => (callbacks.push(fn), callbacks.length), cancelIdleCallback() {} } });
  const stop = helper.warmWorkspaceCodeInBackground(["news", "journal"], async target => { loaded.push(target); });
  assert.equal(callbacks.length, 0);
  document.hidden = false; listeners.get("visibilitychange")();
  callbacks.shift()(); await drain();
  assert.deepEqual(loaded, ["news"]);
  stop(); callbacks.shift()?.(); await drain();
  assert.deepEqual(loaded, ["news"]);
});
