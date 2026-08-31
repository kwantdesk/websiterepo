import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();

async function loadEngine() {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "kwantdesk-smt-"));
  const sourcePath = "src/lib/smtDivergence.ts";
  const source = await readFile(path.join(root, sourcePath), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    fileName: sourcePath,
  });
  const outputPath = path.join(outputDirectory, "smtDivergence.mjs");
  await writeFile(outputPath, result.outputText, "utf8");
  return import(`${new URL(`file:///${outputPath.replaceAll("\\", "/")}`).href}?v=${Date.now()}`);
}

const engine = await loadEngine();
const minute = 60_000;
const fixture = JSON.parse(await readFile(path.join(
  root,
  "native/parity/fixtures/charts/smt-divergence-authoritative.json",
), "utf8"));

function candles(highs, lows = highs.map((high) => high - 3)) {
  return highs.map((high, index) => ({
    timestamp: (index + 1) * minute,
    open: lows[index] + 1,
    high,
    low: lows[index],
    close: high - 1,
    volume: 100,
  }));
}

const settings = fixture.calculation.settings;

test("Divergence Detector is registered as the ES-NQ SMT study and wired to the chart primitive", async () => {
  const catalog = await readFile(path.join(root, "src/lib/chartIndicatorCatalog.ts"), "utf8");
  const chart = await readFile(path.join(root, "src/components/Chart.tsx"), "utf8");
  assert.match(catalog, /indicator\("Divergence Detector",\s*"Market Structure",\s*"Confirmed ES-NQ SMT divergence/);
  assert.match(chart, /loadSmtComparisonCandles\([\s\S]*smtComparisonMarket,[\s\S]*selectedTimeframe/);
  assert.match(chart, /new SmtDivergencePrimitive\(\)/);
});

test("NQ higher high against an ES lower high prints confirmed bearish SMT", () => {
  const nq = candles(fixture.calculation.primaryHighs);
  const es = candles(fixture.calculation.comparisonHighs);
  const signals = engine.calculateSmtDivergences({
    primaryCandles: nq,
    comparisonCandles: es,
    primaryMarket: "NQ",
    comparisonMarket: "ES",
    tickSize: 0.25,
    settings,
  });
  const bearish = signals.find((signal) => signal.kind === "bearish");
  assert.ok(bearish);
  assert.equal(bearish.failedMarket, fixture.calculation.expected.failedMarket);
  assert.equal(bearish.startPrice, fixture.calculation.expected.startPrice);
  assert.equal(bearish.endPrice, fixture.calculation.expected.endPrice);
  assert.equal(bearish.confirmationTime, fixture.calculation.expected.confirmationTimeUnixMs);
  assert.equal(bearish.label, fixture.calculation.expected.label);
});

test("stored settings use the exact bounded twenty-field contract", async () => {
  const config = await readFile(path.join(root, "src/lib/chartIndicatorConfig.ts"), "utf8");
  assert.match(config, /if \(normalizedInstance\.indicatorId === "divergence-detector"\)/);
  assert.match(config, /settings\.comparisonMode = "automatic-es-nq"/);
  assert.match(config, /settings\.divergenceDetectorSettingsVersion = 1/);
  assert.match(config, /\^#\[0-9a-f\]\{6\}\$/i);
});

test("the inverse ES chart draws the same SMT event on ES pivots", () => {
  const nq = candles([100, 102, 110, 103, 104, 106, 113, 105, 104, 103]);
  const es = candles([200, 202, 210, 203, 204, 205, 208, 204, 203, 202]);
  const signals = engine.calculateSmtDivergences({
    primaryCandles: es,
    comparisonCandles: nq,
    primaryMarket: "ES",
    comparisonMarket: "NQ",
    tickSize: 0.25,
    settings,
  });
  const bearish = signals.find((signal) => signal.kind === "bearish");
  assert.ok(bearish);
  assert.equal(bearish.failedMarket, "ES");
  assert.equal(bearish.startPrice, 210);
  assert.equal(bearish.endPrice, 208);
});

test("a pivot is not emitted until the right-side confirmation bar exists", () => {
  const nq = candles([100, 102, 110, 103, 104, 106, 113]);
  const es = candles([200, 202, 210, 203, 204, 205, 208]);
  const signals = engine.calculateSmtDivergences({
    primaryCandles: nq,
    comparisonCandles: es,
    primaryMarket: "NQ",
    comparisonMarket: "ES",
    tickSize: 0.25,
    settings,
  });
  assert.equal(signals.length, 0);
});

test("micro and dated futures symbols resolve to their parent SMT market", () => {
  assert.equal(engine.resolveSmtMarket("MNQ"), "NQ");
  assert.equal(engine.resolveSmtMarket("NQU6 · CME"), "NQ");
  assert.equal(engine.resolveSmtMarket("MES.v.0"), "ES");
  assert.equal(engine.comparisonSmtMarket("ES"), "NQ");
  assert.equal(engine.resolveSmtMarket("CL"), null);
});
