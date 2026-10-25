import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chartProgressCopy } from "../src/lib/chartProgressCopy.ts";

test("replay suppresses routine history loading and completion copy at every period/interval", () => {
  for (const period of ["5D", "1M", "1Y", "All"]) {
    for (const interval of ["1m", "3m", "1h", "1D"]) {
      const message = `Loading ${period} of ${interval} data... this may take a moment`;
      assert.equal(chartProgressCopy(message, true), undefined);
      assert.equal(chartProgressCopy(message, false), message);
    }
  }
  for (const message of ["Loaded 1,380 candles", "Loaded 0 candles", "Connecting to CME history…"]) {
    assert.equal(chartProgressCopy(message, true), undefined);
    assert.equal(chartProgressCopy(message, false), message);
  }
});

test("real replay errors and limits remain visible; empty messages stay empty", () => {
  for (const message of ["Too many candles for this timeframe/period combination. Reduce the period or increase the timeframe.", "CME returned no 1m candles for this window.", "Market data unavailable", "", undefined]) {
    assert.equal(chartProgressCopy(message, true), message);
  }
});

test("shared CVD continuity keeps the proven series without execution-sync or waiting badges", () => {
  const panes = readFileSync(new URL("../src/components/ChartIndicatorPanes.tsx", import.meta.url), "utf8");
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(panes, /SYNCING EXECUTIONS/i);
  assert.doesNotMatch(chart, /WAITING FOR EXECUTIONS/);
  assert.match(panes, /cvdSeriesRegressed\(previous, group\.series\)[\s\S]*?series: previous,[\s\S]*?statusLabel: undefined/);
});

test("all shared workspace panes apply the replay presentation filter", () => {
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.equal(workspace.match(/chartProgressCopy\(loadingMessage, replayActive\)/g)?.length, 2);
});
