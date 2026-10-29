import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const out = mkdtempSync(path.join(root, ".cvd-price-test-"));
try {
  const file = path.join(out, "test.mjs");
  const entry = path.join(out, "entry.ts");
  writeFileSync(entry, `export {calculateIndicatorSeries} from '../src/lib/chartIndicatorEngine'; export {detectCvdDivergences,sessionCvdBars} from '../src/lib/cvdDivergence'; export {CvdDivergencePricePrimitive} from '../src/lib/cvdDivergencePricePrimitive';`);
  execSync(`npx esbuild "${entry}" --bundle --format=esm --platform=node --alias:@=./src --outfile="${file}"`, { stdio: "pipe" });
  const { calculateIndicatorSeries, detectCvdDivergences, sessionCvdBars, CvdDivergencePricePrimitive } = await import(pathToFileURL(file));
  const start = Date.parse("2026-10-28T14:30:00Z");
  const candles = Array.from({ length: 80 }, (_, i) => {
    const low = 100 + Math.sin(i * Math.PI / 4) * 4 + i * .02;
    return { timestamp: start + i * 60000, open: low, high: low + 2, low, close: low + 1, volume: 10, trades: 1, askVolume: 0, bidVolume: 10, delta: -10 };
  });
  const instance = { indicatorId: "cvd-divergence", instanceId: "cvd-test", enabled: true, settings: { pivotStrength: 2, lookbackBars: 2000, lineWidth: 3 } };
  const theme = { positive: "#00ff00", negative: "#ff0000", primary: "#fff", secondary: "#aaa", muted: "#888" };
  const calculate = (data, context = {}) => calculateIndicatorSeries(instance, data, theme, context);
  const definitions = calculate(candles);
  const segments = definitions.find(s => s.cvdDivergences)?.cvdDivergences;
  assert.ok(segments.length > 8, "fixture must contain multiple historical signals");
  assert.deepEqual(segments, detectCvdDivergences(candles, sessionCvdBars(candles), instance.settings), "price must receive the pane detector's exact signals");
  const recovered = [...candles, ...Array.from({ length: 30 }, (_, i) => ({ ...candles.at(-1), timestamp: start + (80 + i) * 60000, low: 110 + i, high: 112 + i, askVolume: 1000, bidVolume: 0, delta: 1000 }))];
  const later = calculate(recovered).find(s => s.cvdDivergences).cvdDivergences;
  for (const segment of segments) assert.ok(later.some(s => JSON.stringify(s) === JSON.stringify(segment)), "later CVD recovery must not remove historical price anchors");
  const clock = start + 35 * 60000;
  const replay = calculate(candles, { replayTimestampMs: clock }).find(s => s.cvdDivergences).cvdDivergences;
  assert.deepEqual(replay, calculate(candles.slice(0, 36)).find(s => s.cvdDivergences).cvdDivergences);
  assert.ok(replay.every(s => s.toTime * 1000 <= clock), "replay must not expose future divergences");
  assert.deepEqual(calculateIndicatorSeries({ ...instance, enabled: false }, candles, theme), []);

  let updates = 0;
  const camera = { sx: .1, sy: 10, tx: 20, ty: 100 };
  const calls = [];
  const context = new Proxy({}, { get: (_, key) => (...args) => calls.push({ key, args }), set: () => true });
  const params = { requestUpdate: () => updates++, chart: { timeScale: () => ({ timeToCoordinate: t => (t - start / 1000) * camera.sx + camera.tx }) }, series: { priceToCoordinate: p => (110 - p) * camera.sy + camera.ty } };
  const primitive = new CvdDivergencePricePrimitive();
  primitive.attached(params);
  primitive.update([{ segments, bullishColor: theme.positive, bearishColor: theme.negative, lineWidth: 3, backgroundColor: "#000" }]);
  const renderer = primitive.paneViews()[0].renderer();
  const paint = () => { calls.length = 0; renderer.draw({ useMediaCoordinateSpace: fn => fn({ context, mediaSize: { width: 1000, height: 1000 } }) }); return calls.filter(c => c.key === "lineTo").map(c => c.args); };
  const before = paint();
  assert.equal(before.length, segments.length, "every historical segment must paint, including touching/overlapping anchors");
  camera.tx += 43; camera.ty -= 17;
  const panned = paint();
  assert.equal(panned.length, before.length);
  for (let i = 0; i < panned.length; i++) {
    assert.ok(Math.abs(panned[i][0] - before[i][0] - 43) < 1e-8);
    assert.ok(Math.abs(panned[i][1] - before[i][1] + 17) < 1e-8, "native projection must follow each pan without a React/SVG transform");
  }
  camera.sx *= .75; camera.sy *= 2;
  const zoomed = paint();
  assert.deepEqual(zoomed, segments.map(s => [(s.toTime - start / 1000) * camera.sx + camera.tx, (110 - s.toPrice) * camera.sy + camera.ty]));
  assert.ok(calls.filter(c => c.key === "arc").every(c => c.args[2] === 2.5), "pivot markers keep their screen size while zooming");
  assert.ok(calls.filter(c => c.key === "roundRect").every(c => c.args[2] === 34 && c.args[3] === 13), "labels keep their screen size");
  camera.tx -= 20000; assert.equal(paint().length, 0);
  camera.tx += 20000; assert.equal(paint().length, segments.length, "offscreen culling must never delete signal history");
  primitive.update([]); assert.deepEqual(primitive.paneViews(), []);
  primitive.detached(); assert.equal(paint().length, 0);
  assert.equal(updates, 3);
  const chart = readFileSync("src/components/Chart.tsx", "utf8");
  assert.ok(!chart.includes("detectCvdDivergence(") && !chart.includes("{cvdDivergence ?"), "legacy retracting detector/SVG overlay must be removed");
  assert.match(chart, /candleSeries\.attachPrimitive\(cvdDivergencePricePrimitive\)/);
  assert.match(chart, /cvdDivergencePricePrimitiveRef\.current\?\.update\(baseCalculatedIndicatorSeries/);
  console.log("CVD price history: shared signals, recovery persistence, replay, disable, native pan/zoom, fixed-size markers, culling and teardown passed.");
} finally {
  assert.equal(path.dirname(path.resolve(out)), path.resolve(root));
  assert.ok(path.basename(out).startsWith(".cvd-price-test-"));
  rmSync(out, { recursive: true, force: true });
}
