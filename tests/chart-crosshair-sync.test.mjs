import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();

async function loadCrosshairSync() {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "kwantdesk-crosshair-"));
  const sourcePath = "src/lib/chartCrosshairSync.ts";
  const source = await readFile(path.join(root, sourcePath), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    fileName: sourcePath,
  });
  const output = result.outputText.replace(
    /import \{ normalizePaperSymbol \} from "@\/lib\/paperTrading";/,
    "const normalizePaperSymbol = (value) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').match(/^(MNQ|NQ|MES|ES)/)?.[1] ?? value;",
  );
  const outputPath = path.join(outputDirectory, "chartCrosshairSync.mjs");
  await writeFile(outputPath, output, "utf8");
  return import(`${new URL(`file:///${outputPath.replaceAll("\\", "/")}`).href}?v=${Date.now()}`);
}

const sync = await loadCrosshairSync();

test("crosshair synchronization is exposed beside the mouse selection tool", async () => {
  const chart = await readFile(path.join(root, "src/components/Chart.tsx"), "utf8");
  const mouseButton = chart.indexOf("<Hand className={toolbarIconClassName} />");
  const linkedButton = chart.indexOf("saveChartCrosshairSyncEnabled(!crosshairSyncEnabled, crosshairSyncScope)");
  assert.ok(mouseButton >= 0);
  assert.ok(linkedButton > mouseButton);
  assert.match(chart, /chart\.subscribeCrosshairMove\(handleNativeCrosshairMove\)/);
  assert.match(chart, /chart\.setCrosshairPosition\(synchronizedPrice, targetTime as Time, candleSeries\)/);
  assert.match(chart, /crosshairSyncScope === "matching" && detail\.instrumentKey !== crosshairSyncInstrumentKey/);
  assert.match(chart, /Link equivalent prices across GEX VUE charts/);
});

test("a synchronized timestamp resolves to the containing candle on the receiving timeframe", () => {
  const candles = [1_000, 2_000, 3_000].map((timestamp) => ({
    timestamp,
    open: 1,
    high: 2,
    low: 0,
    close: 1,
    volume: 1,
  }));
  const chartTimes = new Map([[1_000, 11], [2_000, 22], [3_000, 33]]);
  assert.equal(sync.resolveSyncedChartTime(2_750, candles, chartTimes), 22);
  assert.equal(sync.resolveSyncedChartTime(3_000, candles, chartTimes), 33);
  assert.equal(sync.resolveSyncedChartTime(500, candles, chartTimes), null);
});

test("instrument linking keeps NQ, MNQ, ES and MES charts in separate groups", () => {
  assert.equal(sync.chartCrosshairInstrumentKey("NQU6 · CME"), "NQ");
  assert.equal(sync.chartCrosshairInstrumentKey("MNQU6 · CME"), "MNQ");
  assert.equal(sync.chartCrosshairInstrumentKey("ESU6 · CME"), "ES");
  assert.equal(sync.chartCrosshairInstrumentKey("MESU6 · CME"), "MES");
});

test("GEX VUE maps a pointer to the equivalent percentage price on another instrument", () => {
  assert.equal(sync.resolveEquivalentCrosshairPrice(731, 730, 30_000), 30_000 * (731 / 730));
  assert.equal(sync.resolveEquivalentCrosshairPrice(5_300, 5_300, 530), 530);
  assert.equal(sync.resolveEquivalentCrosshairPrice(1, 0, 100), null);
});

test("the synchronized candle supplies the receiving instrument reference price", () => {
  const candles = [
    { timestamp: 1_000, open: 10, high: 12, low: 9, close: 11, volume: 1 },
    { timestamp: 2_000, open: 11, high: 14, low: 10, close: 13, volume: 1 },
  ];
  assert.equal(sync.resolveSyncedChartCandle(2_500, candles)?.close, 13);
  assert.equal(sync.resolveSyncedChartCandle(500, candles), null);
});
