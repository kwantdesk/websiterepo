import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { SuperTrendLiveCalculator } from "../src/lib/superTrend.ts";
import { SuperTrendAlertTracker } from "../src/lib/superTrendAlerts.ts";
import { normalizeSuperTrendSettings } from "../src/lib/superTrendSettings.ts";

for (const scenario of ["plays", "unmounted", "rejected", "stale-resume"]) test(`actual Super Trend audio lifecycle: ${scenario}`, async () => {
  const source = fs.readFileSync(new URL("../src/components/useSuperTrendAlerts.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const effects = [], cleanup = [], notices = [], tones = [], gains = [];
  const react = { useRef: current => ({ current }), useEffect: fn => effects.push(fn),
    useState: value => [value, next => notices.push(next)] };
  let resume, reject, closed = 0, now = 1700000100000;
  class Context {
    state = "running"; currentTime = 42; destination = {};
    resume() { return new Promise((resolve, fail) => { resume = resolve; reject = fail; }); }
    close() { closed++; this.state = "closed"; return Promise.resolve(); }
    createOscillator() {
      const tone = { frequency: {}, connect() {}, disconnect() { this.disconnected = true; },
        start() { this.started = true; }, stop(at) { this.stopped = at; } };
      tones.push(tone); return tone;
    }
    createGain() {
      const gain = { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {}, disconnect() { this.disconnected = true; } };
      gains.push(gain); return gain;
    }
  }
  const originalWindow = globalThis.window, originalAudio = globalThis.AudioContext, originalNow = Date.now;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)(name => {
    if (name === "react") return react;
    if (name.endsWith("chartLiveEvents")) return { LIVE_CHART_CANDLE_EVENT: "candle" };
    if (name.endsWith("superTrend")) return { SuperTrendLiveCalculator };
    if (name.endsWith("superTrendAlerts")) return { SuperTrendAlertTracker };
    if (name.endsWith("superTrendSettings")) return { normalizeSuperTrendSettings };
    throw new Error(name);
  }, loaded, loaded.exports);
  globalThis.window = new EventTarget(); globalThis.AudioContext = Context; Date.now = () => now;
  try {
    const history = Array.from({ length: 4 }, (_, i) => ({ timestamp: now - 4000 + i * 1000,
      open: 10, high: 11, low: 9, close: 10 }));
    loaded.exports.useSuperTrendAlerts({ indicators: [{ instanceId: "a", indicatorId: "super-trend", enabled: true,
      settings: { length: 3, multiplier: 1, alertSoundEnabled: true, messagePopupEnabled: false } }],
      history, liveKey: "nq", instrument: "NQ", timeframe: "1m", live: true });
    effects.forEach(fn => { const result = fn(); if (result) cleanup.push(result); });
    assert.equal(tones.length, 0); // loading historical reversals is silent
    window.dispatchEvent(new CustomEvent("candle", { detail: { key: "nq", sourceTimestampMs: now,
      candle: { ...history.at(-1), close: 14, high: 15 } } }));
    assert.equal(typeof resume, "function"); assert.equal(tones.length, 0);
    if (scenario === "unmounted") cleanup.splice(0).forEach(fn => fn());
    if (scenario === "stale-resume") now += 20000;
    if (scenario === "rejected") reject(new Error("Audio blocked")); else resume();
    await Promise.resolve(); await Promise.resolve();
    assert.equal(tones.length, scenario === "plays" ? 1 : 0);
    if (scenario === "plays") {
      assert.equal(tones[0].frequency.value, 880); assert.equal(tones[0].started, true);
      assert.equal(tones[0].stopped, 42.2);
      tones[0].onended(); assert.equal(tones[0].disconnected, true); assert.equal(gains[0].disconnected, true);
    }
    if (scenario === "rejected") assert.match(notices.at(-1), /sound unavailable/);
    else assert.equal(notices.length, 0);
    cleanup.splice(0).forEach(fn => fn()); assert.equal(closed, 1);
  } finally {
    cleanup.forEach(fn => fn()); Date.now = originalNow;
    globalThis.window = originalWindow; globalThis.AudioContext = originalAudio;
  }
});
