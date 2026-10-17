import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("weekly failure reaches the chart instead of looking like indefinite loading", () => {
  const market = readFileSync(new URL("../src/lib/institutionalMarketData.ts", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(market, /signal: AbortSignal\.timeout\(15_000\)/);
  assert.match(market, /payload\.complete === false\s*\? "Required session history is missing or incomplete/);
  assert.match(workspace, /setWeeklyProfileFailure\(profile \? null/);
  assert.match(workspace, /volumeProfileError=\{weeklyProfileInstance/);
  assert.match(chart, /\{volumeProfileError\}/);
});
