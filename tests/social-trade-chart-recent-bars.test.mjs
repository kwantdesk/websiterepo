import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const chartSource = fs.readFileSync("src/components/socials/TradePostChart.tsx", "utf8");
const sessionSource = fs.readFileSync("src/app/api/backtesting/session/route.ts", "utf8");

test("recent social trades do not cache an empty archive response", () => {
  assert.match(chartSource, /backtesting\/session[\s\S]*cache: "no-store"/);
  assert.doesNotMatch(chartSource, /cache: "force-cache"/);
  assert.match(sessionSource, /recentRequest[\s\S]*private, no-store, max-age=0/);
});

test("recent social trades can use retained live minute bars", () => {
  assert.match(sessionSource, /order-flow-levels/);
  assert.match(sessionSource, /symbol\.split\("\."\)\[0\]/);
  assert.match(sessionSource, /mergeCandles\(archiveCandles, tickerPlantCandles\)/);
});

test("the trade card falls back to recent real chart bars", () => {
  assert.match(chartSource, /\/api\/cme-history/);
  assert.match(chartSource, /recentCandles\.slice\(-180\)/);
  assert.match(chartSource, /available session bars/);
});
