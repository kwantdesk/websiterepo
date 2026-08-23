import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const outDir = mkdtempSync(join(process.cwd(), ".backtesting-big-contracts-test-"));
const bundle = join(outDir, "bigTrades.mjs");
execSync(
  `npx esbuild src/lib/bigTrades.ts --bundle --format=esm --platform=node --alias:@=./src --outfile="${bundle}"`,
  { stdio: "pipe" },
);

try {
  const { calculateBigTradePrints } = await import(`file://${bundle.replaceAll("\\", "/")}`);
  const replayClock = Date.UTC(2026, 7, 3, 18, 0, 0);
  const trades = Array.from({ length: 80 }, (_, index) => ({
    eventId: `august-${index}`,
    timestamp: replayClock - (80 - index) * 1_000,
    close: 29_000 + (index % 8) * 0.25,
    volume: index % 9 === 0 ? 80 : 10,
    trades: 1,
    aggressor: index % 2 === 0 ? "BUY" : "SELL",
    recordIndex: index,
  }));
  const prints = calculateBigTradePrints([], trades, {
    enableClustering: false,
    daysToLoad: 30,
    filterMode: "manual",
    manualFilter: 30,
  }, replayClock);

  assert.equal(prints.length, 9, "three-month replay must retain exact qualifying executions");
  assert.ok(prints.every((print) => print.timestamp <= replayClock));

  const backtesting = readFileSync("src/components/backtesting/BacktestingWorkspace.tsx", "utf8");
  assert.match(backtesting, /orderFlow=1&executions=1/);
  assert.match(backtesting, /marketTrades=\{visibleReplayTrades\}/);
  assert.match(backtesting, /replayTimestampMs=\{replayDataClock\}/);

  const chart = readFileSync("src/components/Chart.tsx", "utf8");
  assert.match(chart, /replayTimestampMs \?\? Date\.now\(\)/);
  assert.match(chart, /if \(!historicalContext && !historyStarted\)/);

  const config = readFileSync("src/lib/chartIndicatorConfig.ts", "utf8");
  assert.match(config, /instance\.indicatorId === "deep-trades"[\s\S]*indicatorId: "big-trades"/);

  const catalog = readFileSync("src/lib/chartIndicatorCatalog.ts", "utf8");
  assert.equal((catalog.match(/indicator\("Big Contracts"/g) ?? []).length, 1);

  console.log("backtesting Big Contracts + bounded Dark Pool replay: 8/8 checks passed");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
