import assert from "node:assert/strict";
import { buildDynamicPocFrame, normalizeDynamicPocSettings } from "../src/lib/dynamicPoc.ts";
const tickSize = 0.25;
const row = (tickIndex, volume) => ({ tickIndex, bidVolume: volume / 2, askVolume: volume / 2, unknownVolume: 0 });
const bar = (id, time, rows, closeTick, isClosed = true) => ({ id, startTime: time, endTime: time + 60_000, closeTick, close: closeTick * tickSize, rows, hasPriceLevelFlow: true, isClosed });
const base = Date.parse("2026-09-03T23:00:00Z");
const bars = [bar("a", base, [row(100, 10), row(101, 5)], 100), bar("b", base + 60_000, [row(100, 1), row(101, 20)], 101), bar("c", base + 120_000, [row(100, 30), row(101, 1)], 100, false)];
const rolling = buildDynamicPocFrame(bars, "NQ", tickSize, { periodMode: "bars", periodValue: 2 });
assert.deepEqual(rolling.points.map((point) => point.pocTick), [100, 101, 100], "rolling Bar POC must add the newest bar and evict bars outside the window");
assert.equal(rolling.status, "LIVE");
assert.ok((rolling.points[1].envelopes?.[0] ?? 0) > 0, "standard-deviation envelopes must be calculated around the rolling POC");
const percentage = buildDynamicPocFrame(bars.slice(0, 1), "NQ", tickSize, { envelopeMode: "price-percentage", firstEnvelope: 1 });
assert.equal(percentage.points[0].envelopes?.[0], 1);
const unavailable = buildDynamicPocFrame([{ ...bars[0], rows: [], hasPriceLevelFlow: false }], "NQ", tickSize);
assert.equal(unavailable.status, "WAITING_FOR_VOLUME_AT_PRICE");
assert.deepEqual(unavailable.points, []);
const normalized = normalizeDynamicPocSettings({ periodValue: 0, firstEnvelope: 0, lineWidth: 99 });
assert.equal(normalized.periodValue, 1); assert.equal(normalized.firstEnvelope, 0.25); assert.equal(normalized.lineWidth, 8);
console.log("Dynamic POC tests passed.");

const forming = { ...bars[2], endTime: Number.POSITIVE_INFINITY };
const timed = buildDynamicPocFrame([bars[0], bars[1], forming], "NQ", tickSize, {
  periodMode: "last-minutes", periodValue: 2,
});
assert.deepEqual(timed.points.map(point => point.timestamp), [base, base + 60_000, base + 120_000]);
assert.equal(timed.points.at(-1).pocTick, 100);
assert.equal(timed.points.at(-1).envelopes[0], Math.sqrt(21 / 52));

const missing = { ...bars[1], hasPriceLevelFlow: false };
const withGap = buildDynamicPocFrame([bars[0], missing, forming], "NQ", tickSize, { periodMode: "bars" });
assert.deepEqual(withGap.points.map(point => point.pocTick), [100, null, 100]);
assert.equal(withGap.points.at(-1).envelopes[0], Math.sqrt(6 / 46));

const minuteBuckets = buildDynamicPocFrame(bars, "NQ", tickSize, { periodMode: "minute", periodValue: 2 });
assert.deepEqual(minuteBuckets.points.map(point => point.pocTick), [100, 101, 100]);
assert.equal(minuteBuckets.points.at(-1).envelopes[0], Math.sqrt(1 / 31));
assert.equal(normalizeDynamicPocSettings({ envelopeLineStyle: "unknown" }).envelopeLineStyle, "dashed");
assert.equal(normalizeDynamicPocSettings({ envelopeOpacity: 110 }).envelopeOpacity, 100);
import { readFileSync } from "node:fs";
import ts from "typescript";

const rendererModule = { exports: {} };
const rendererSource = readFileSync(new URL("../src/lib/dynamicPocPrimitive.ts", import.meta.url), "utf8");
const rendererJs = ts.transpileModule(rendererSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function("exports", rendererJs)(rendererModule.exports);
const primitive = new rendererModule.exports.DynamicPocPrimitive();
const calls = [];
const coordinateTimes = [];
primitive.attached({
  chart: { timeScale: () => ({ timeToCoordinate: time => { coordinateTimes.push(time); return time; } }) },
  series: { priceToCoordinate: price => price },
  requestUpdate() {},
});
primitive.update({
  frame: timed, chartTime: timestamp => (timestamp - base) / 1_000,
  settings: normalizeDynamicPocSettings({
    showPoc: false, showSecondEnvelope: false, showThirdEnvelope: false,
    envelopeLineStyle: "dotted", envelopeOpacity: 25, envelopeLineWidth: 2,
  }),
});
const context = {
  save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, moveTo() {},
  lineTo(x, y) { calls.push(["line", x, y]); },
  setLineDash(dashes) { calls.push(["dash", dashes]); },
  stroke() { calls.push(["stroke", this.globalAlpha, this.lineWidth]); },
};
primitive.paneViews()[0].renderer().draw({
  useMediaCoordinateSpace: draw => draw({ context, mediaSize: { width: 200, height: 100 } }),
});
assert.deepEqual(coordinateTimes, [0, 60, 120]);
assert.deepEqual(calls.filter(([op]) => op === "dash"), [["dash", [1, 3]], ["dash", [1, 3]]]);
assert.deepEqual(calls.filter(([op]) => op === "stroke"), [["stroke", 0.25, 2], ["stroke", 0.25, 2]]);
assert.equal(calls.filter(([op, x]) => op === "line" && x === 120).length, 2);
console.log("Dynamic POC calculation and renderer tests passed.");
