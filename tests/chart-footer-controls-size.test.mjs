import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const chart = await fs.readFile(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const workspace = await fs.readFile(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

test("chart range selector and candle countdown use the compact half-size treatment", () => {
  assert.match(chart, /CandleCountdownBadge[\s\S]*?h-3\.5 w-\[27px\][\s\S]*?text-\[6px\]/);
  assert.match(workspace, /\["1D", "5D", "1W", "1M", "3M", "6M", "1Y", "All"\][\s\S]*?rounded-\[2px\] px-1 py-0 text-\[6px\]/);
  assert.match(workspace, /absolute left-3 z-20 flex h-4 items-center/);
});
