import assert from "node:assert/strict";
import test from "node:test";
import {
  compilePineScript,
  runPineScript,
} from "../src/lib/pineScriptRuntime.ts";

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

test("compiles and evaluates a common Pine v6 EMA overlay", () => {
  const source = `//@version=6
indicator("EMA Ribbon", overlay=true)
fastLength = input.int(20, "Fast")
slowLength = input.int(50, "Slow")
fast = ta.ema(close, fastLength)
slow = ta.ema(close, slowLength)
plot(fast, title="Fast EMA", color=color.lime, linewidth=2)
plot(slow, title="Slow EMA", color=color.white, linewidth=2)`;
  const compiled = compilePineScript(source);
  assert.equal(compiled.name, "EMA Ribbon");
  assert.equal(compiled.overlay, true);
  assert.equal(compiled.diagnostics.some((diagnostic) => diagnostic.severity === "error"), false);

  const result = runPineScript(source, candles, theme, "custom-1");
  assert.equal(result.runtimeError, null);
  assert.equal(result.series.length, 2);
  assert.equal(result.series[0].placement, "overlay");
  assert.equal(result.series[0].data.length, candles.length);
  assert.ok(Number.isFinite(result.series[0].data.at(-1).value));
});

test("supports pane indicators and history references without lookahead", () => {
  const source = `//@version=5
indicator("Momentum pane", overlay=false)
momentum = close - close[5]
plot(momentum, title="Momentum", color=color.aqua, style=plot.style_histogram)`;
  const result = runPineScript(source, candles, theme, "custom-2");
  assert.equal(result.runtimeError, null);
  assert.equal(result.series[0].placement, "pane");
  assert.equal(result.series[0].kind, "histogram");
  assert.equal(result.series[0].data.length, candles.length - 5);
});

test("rejects TradingView-only external data and strategy execution", () => {
  const source = `//@version=6
strategy("Unsafe")
other = request.security("AAPL", "1D", close)
plot(other)`;
  const compiled = compilePineScript(source);
  const errors = compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  assert.ok(errors.some((diagnostic) => diagnostic.message.includes("Strategies")));
  assert.ok(errors.some((diagnostic) => diagnostic.message.includes("External symbols")));
});

test("reports unsupported Pine functions before a script can be added", () => {
  const source = `//@version=6
indicator("Unsupported", overlay=true)
value = ta.supertrend(3, 10)
plot(value)`;
  const compiled = compilePineScript(source);
  assert.ok(compiled.diagnostics.some((diagnostic) => diagnostic.message.includes("ta.supertrend")));
});
