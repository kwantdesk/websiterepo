import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { exactCustomDrawVolumeProfile } from "../src/lib/customDrawVolumeProfile.ts";

const control = readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/components/ChartDrawSettings.tsx", import.meta.url), "utf8");

assert.ok(
  control.includes('"custom-draw-on-volume-profile",'),
  "draw-on volume profile must be a rendered library item",
);
assert.ok(
  control.includes('detail: { chartInstanceId, tool: "fixedRangeVolumeProfile" }'),
  "Add must arm the real profile tool on the selected chart",
);
assert.ok(
  chart.includes('window.addEventListener("kwantdesk:activate-chart-drawing"'),
  "each chart must listen for its scoped placement request",
);
assert.ok(
  chart.includes('period: "custom"')
    && chart.includes("profileGroupTicks")
    && chart.includes("profileMinTradeVolume")
    && chart.includes("profileMaxTradeVolume"),
  "a committed range must request an exact filtered Rithmic profile",
);
assert.ok(
  layer.includes("exactCustomDrawVolumeProfile(volumeProfiles[drawing.id])"),
  "the drawing renderer must prefer exact execution rows",
);
for (const label of [
  "Price grouping",
  "Minimum trade",
  "Maximum trade",
  "Value area",
  "Show POC line",
  "Show VAH / VAL lines",
]) {
  assert.ok(settings.includes(label), `profile settings must expose ${label}`);
}

const exact = exactCustomDrawVolumeProfile({
  schemaVersion: "kwantify-volume-profile-v1",
  provider: "Rithmic",
  source: "test",
  root: "NQ",
  contractSymbol: "NQZ6",
  period: "custom",
  startMs: 1,
  endMs: 2,
  complete: true,
  tickSize: 0.25,
  groupTicks: 4,
  valueAreaPercent: 68,
  minTradeVolume: 0,
  maxTradeVolume: 0,
  totalVolume: 60,
  bidVolume: 30,
  askVolume: 30,
  delta: 0,
  trades: 6,
  poc: 101,
  vah: 102,
  val: 100,
  vwap: 101,
  standardDeviation: 1,
  levels: [
    { price: 102, volume: 10, bidVolume: 5, askVolume: 5, delta: 0, trades: 1 },
    { price: 100, volume: 20, bidVolume: 10, askVolume: 10, delta: 0, trades: 2 },
    { price: 101, volume: 30, bidVolume: 15, askVolume: 15, delta: 0, trades: 3 },
  ],
  developingPoc: [],
  asOf: new Date(2).toISOString(),
});
assert.ok(exact);
assert.deepEqual(exact.bins.map((bin) => [bin.priceLow, bin.priceHigh, bin.volume]), [
  [99.5, 100.5, 20],
  [100.5, 101.5, 30],
  [101.5, 102.5, 10],
]);
assert.equal(exact.pocIndex, 1);
assert.equal(exact.maxVol, 30);
assert.equal(exact.vahHigh, 102);
assert.equal(exact.valLow, 100);

console.log("Custom draw-on volume profile tests passed.");
