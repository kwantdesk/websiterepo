import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

test("workspaces and the chart timeframe selector occupy the left column", () => {
  assert.match(workspace, /kwant-chart-command-deck[^\n]*grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/);
  assert.match(workspace, /col-start-1 flex h-7 shrink-0 items-center justify-self-start/);
  assert.match(workspace, /col-start-1 row-start-2 flex min-w-0 items-center justify-self-start/);
  assert.match(workspace, /ref=\{timeframeMenuRef\}/);
});

test("status remains centred while source, time, and chart actions stay right-aligned", () => {
  assert.match(workspace, /col-start-2 row-start-2[\s\S]*?Backtest Active/);
  assert.match(workspace, /className="col-start-3 ml-1[\s\S]*?Chart timezone/);
  assert.match(workspace, /col-start-3 row-start-2 flex min-w-0 items-center justify-end/);
});
