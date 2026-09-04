import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildSpeedOfTapeInstantFrame,
  normalizeSpeedOfTapeInstantSettings,
} from "../src/lib/speedOfTapeInstant.ts";

const trade = (timestamp, volume, aggressor, recordIndex, trades = 1, flowOnly = false) => ({
  timestamp, volume, aggressor, recordIndex, trades, flowOnly,
  open: 100, high: 100, low: 100, close: 100,
  bidVolume: aggressor === "SELL" ? volume : 0,
  askVolume: aggressor === "BUY" ? volume : 0,
  delta: aggressor === "BUY" ? volume : aggressor === "SELL" ? -volume : 0,
});

const base = 1_800_000;
const tape = [
  trade(base + 1_000, 2, "BUY", 1, 1),
  trade(base + 2_000, 3, "SELL", 2, 2),
  trade(base + 11_000, 7, "BUY", 3, 3),
  trade(base + 12_000, 99, "BUY", 4, 1, true),
  trade(base + 21_000, 5, "SELL", 5, 4),
];

{
  const settings = normalizeSpeedOfTapeInstantSettings({ numberOfSeconds: -5, barsToShow: 100, lineWidth: 99 });
  assert.equal(settings.numberOfSeconds, 1);
  assert.equal(settings.barsToShow, 20);
  assert.equal(settings.lineWidth, 6);
  assert.equal(settings.inputData, "volume");
}

{
  const frame = buildSpeedOfTapeInstantFrame(tape, { numberOfSeconds: 10, barsToShow: 3, standardDeviationLookback: 10 });
  assert.deepEqual(frame.bars.map((bar) => bar.value), [5, 7, 5]);
  assert.deepEqual(frame.bars.map((bar) => bar.positive), [false, true, false]);
  assert.equal(frame.latestTradeMs, base + 21_000);
  assert.equal(frame.bars.some((bar) => bar.total === 99), false, "flow-only history must not masquerade as prints");
}

{
  const frame = buildSpeedOfTapeInstantFrame(tape, {
    numberOfSeconds: 10, barsToShow: 3, inputData: "trades", displayValue: "total",
    standardDeviationLookback: 10,
  });
  assert.deepEqual(frame.bars.map((bar) => bar.value), [3, 3, 4]);
}

{
  const frame = buildSpeedOfTapeInstantFrame(tape, {
    numberOfSeconds: 10, barsToShow: 3, displayValue: "delta", filterMin: 3, filterMax: 7,
    standardDeviationLookback: 10, plotReversed: true,
  });
  assert.deepEqual(frame.bars.map((bar) => bar.value), [-5, 7, -3]);
  assert.ok(frame.standardDeviation > 0);
}

{
  const config = fs.readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8");
  const controls = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  const chart = fs.readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  const workspace = fs.readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(config, /"speed-of-tape-instant"/);
  assert.match(controls, /<option value="volume">Volume<\/option><option value="trades">Trades<\/option>/);
  assert.match(controls, /<option value="total">Total<\/option>.*<option value="delta">Delta<\/option>/s);
  assert.match(chart, /buildSpeedOfTapeInstantFrame\(marketTrades, instantTapeSettings\)/);
  assert.match(chart, /right=\{nativePriceScaleWidth \+ miniDomReservedWidth\}/);
  assert.match(workspace, /footprintLiveActive \|\| instantTapeLiveActive/);
}

console.log("Speed of Tape (Instant) fixtures passed: 5/5");
