import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

test("the chart timeframe selector occupies the true centre column", () => {
  assert.match(workspace, /kwant-chart-command-deck[^\n]*grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/);
  assert.match(workspace, /col-start-2 row-start-2 flex min-w-0 items-center justify-self-center/);
  assert.match(workspace, /ref=\{timeframeMenuRef\}/);
});

test("status and chart actions remain isolated to the left and right columns", () => {
  assert.match(workspace, /col-start-1 row-start-2[\s\S]*?Backtest Active/);
  assert.match(workspace, /col-start-3 row-start-2 flex min-w-0 items-center justify-end/);
});
