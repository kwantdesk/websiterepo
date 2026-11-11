import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const timer = await fs.readFile(new URL("../src/components/CandleCountdownBadge.tsx", import.meta.url), "utf8");
const workspace = await fs.readFile(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

test("the larger candle timer reserves space and can grow for longer labels", () => {
  assert.match(timer, /data-candle-timer\s+className="[^"]*h-\[21px\] min-w-\[41px\][^"]*text-\[9px\]/);
  assert.match(timer, /whitespace-nowrap/);
});

test("the chart load range remains in the interval picker", () => {
  assert.match(workspace, /Load range<\/div>[\s\S]*?\["5D", "1M"\]\.map/);
});
