import assert from "node:assert/strict";
import test from "node:test";
import {
  detectSourceIndicatorLanguage,
  inferSourceLanguageFromFileName,
  prepareSourceIndicator,
  runSourceIndicator,
} from "../src/lib/indicatorSourceAdapters.ts";

const candles = Array.from({ length: 80 }, (_, index) => ({
  timestamp: Date.UTC(2026, 7, 5, 13, index),
  open: 29_000 + index,
  high: 29_004 + index,
  low: 28_996 + index,
  close: 29_002 + index,
  volume: 1_000 + index * 10,
}));

const theme = {
  primary: "#9dff00",
  secondary: "#ffffff",
  positive: "#9dff00",
  negative: "#ff4d68",
  muted: "#6b7280",
};

test("auto-detects and runs a thinkScript EMA overlay", () => {
  const source = `declare upper;
input price = close;
input length = 20;
def avg = ExpAverage(price, length);
plot FastEMA = avg;
FastEMA.SetDefaultColor(Color.CYAN);
FastEMA.SetLineWeight(3);`;

  assert.equal(detectSourceIndicatorLanguage(source), "thinkscript");
  const prepared = prepareSourceIndicator(source, "auto");
  assert.equal(prepared.language, "thinkscript");
  assert.equal(prepared.program.overlay, true);
  assert.equal(prepared.diagnostics.some((item) => item.severity === "error"), false);

  const result = runSourceIndicator(source, "auto", candles, theme, "think-1");
  assert.equal(result.runtimeError, null);
  assert.equal(result.series.length, 1);
  assert.equal(result.series[0].label, "FastEMA");
  assert.equal(result.series[0].placement, "overlay");
  assert.equal(result.series[0].lineWidth, 3);
  assert.equal(result.series[0].color, "#22d3ee");
});

test("auto-detects and runs a TradeStation EasyLanguage study", () => {
  const source = `Inputs: FastLength(9), SlowLength(21);
Vars: FastAvg(0), SlowAvg(0);
FastAvg = XAverage(Close, FastLength);
SlowAvg = AverageFC(Close, SlowLength);
Plot1(FastAvg, "Fast", Green, Default, 3);
Plot2(SlowAvg, "Slow", White);`;

  assert.equal(detectSourceIndicatorLanguage(source), "easylanguage");
  const result = runSourceIndicator(source, "auto", candles, theme, "easy-1");
  assert.equal(result.prepared.diagnostics.some((item) => item.severity === "error"), false);
  assert.equal(result.series.length, 2);
  assert.equal(result.series[0].label, "Fast");
  assert.equal(result.series[0].lineWidth, 3);
  assert.equal(result.series[0].color, "#22c55e");
});

test("uses source file extensions as a language hint", () => {
  assert.equal(inferSourceLanguageFromFileName("study.pine"), "pine");
  assert.equal(inferSourceLanguageFromFileName("study.thinkscript"), "thinkscript");
  assert.equal(inferSourceLanguageFromFileName("study.eld"), "easylanguage");
  assert.equal(inferSourceLanguageFromFileName("study.txt"), "auto");
});

test("detects but refuses to execute full NinjaScript C#", () => {
  const source = `namespace NinjaTrader.NinjaScript.Indicators {
    public class Example : Indicator {
      protected override void OnBarUpdate() { Value[0] = SMA(20)[0]; }
    }
  }`;
  assert.equal(detectSourceIndicatorLanguage(source), "ninjascript");
  const prepared = prepareSourceIndicator(source, "auto");
  assert.ok(prepared.diagnostics.some((item) => item.severity === "error" && item.message.includes("compiled C#")));
});

test("blocks trading commands inside imported study languages", () => {
  const thinkScript = `declare upper;
AddOrder(OrderType.BUY_AUTO, close > close[1]);
plot Price = close;`;
  const easyLanguage = `Inputs: Length(20);
Buy next bar at market;
Plot1(Average(Close, Length), "Average");`;
  assert.ok(prepareSourceIndicator(thinkScript, "thinkscript").diagnostics.some((item) => item.severity === "error"));
  assert.ok(prepareSourceIndicator(easyLanguage, "easylanguage").diagnostics.some((item) => item.severity === "error"));
});
