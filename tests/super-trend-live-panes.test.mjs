import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { SuperTrendPlotBuffer, SUPER_TREND_LIVE_PLOT_EVENT } from "../src/lib/superTrendLivePlot.ts";

for (const indicatorId of ["super-trend", "super-trend-difference"]) test(`${indicatorId} actual pane hook coalesces bursts, isolates charts and restores history on reset/replay`, () => {
  const source = fs.readFileSync(new URL("../src/components/useSuperTrendLivePanes.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const slots = [], pending = [], frames = new Map();
  let cursor = 0, frameId = 0, updates = 0;
  const changed = (a, b) => !a || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));
  const react = {
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value) { const i = cursor++; slots[i] ??= { value }; return [slots[i].value, fn => {
      slots[i].value = typeof fn === "function" ? fn(slots[i].value) : fn; updates++;
    }]; },
    useEffect(fn, deps) { const i = cursor++; if (changed(slots[i]?.deps, deps)) {
      pending.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    } },
    useMemo(fn, deps) { const i = cursor++; if (changed(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value; },
  };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)(name => {
    if (name === "react") return react;
    if (name.endsWith("superTrendLivePlot")) return { SuperTrendPlotBuffer, SUPER_TREND_LIVE_PLOT_EVENT };
    throw new Error(name);
  }, loaded, loaded.exports);
  const original = { window: globalThis.window, requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame };
  globalThis.window = new EventTarget();
  globalThis.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const base = { key: "series", superTrendStyleKey: "style-a", data: [{ time: 1, value: 10 }] };
  const groups = [{ key: "st", indicatorId, series: [base] },
    { key: "working", indicatorId: "cvd", series: [base] }];
  const render = key => { cursor = 0; const value = loaded.exports.useSuperTrendLivePanes(groups, key);
    pending.splice(0).forEach(fn => fn()); return value; };
  const emit = (value, extra = {}) => window.dispatchEvent(new CustomEvent(SUPER_TREND_LIVE_PLOT_EVENT, {
    detail: { chartKey: "nq", instanceId: "st", series: { ...base, data: [{ time: 1, value }] }, ...extra },
  }));
  const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); };
  try {
    assert.equal(render("nq"), groups);
    emit(999, { chartKey: "es" }); emit(999, { instanceId: "working" });
    assert.equal(frames.size, 0);
    for (let i = 0; i < 1000; i++) emit(i);
    assert.equal(frames.size, 1); assert.equal(updates, 0);
    flush(); assert.equal(updates, 1);
    const result = render("nq");
    assert.equal(result[0].series[0].data.at(-1).value, 999);
    assert.equal(result[1], groups[1]);
    emit(0, { reset: true }); flush();
    assert.equal(render("nq")[0], groups[0]);
    emit(300); assert.equal(frames.size, 1);
    assert.equal(render(undefined), groups); // replay cannot leak a buffered live frame
    assert.equal(frames.size, 0);
    emit(301); assert.equal(frames.size, 0);
    render("es"); emit(302); assert.equal(frames.size, 0);
    emit(303, { chartKey: "es" }); flush();
    assert.equal(render("es")[0].series[0].data.at(-1).value, 303);
  } finally {
    for (const slot of slots) slot?.cleanup?.();
    Object.assign(globalThis, original);
  }
});
