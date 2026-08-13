import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const chart = await fs.readFile(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const workspace = await fs.readFile(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

test("CVD waits for a verified historical order-flow baseline after refresh", () => {
  assert.match(workspace, /const \[orderFlowHistoryReady, setOrderFlowHistoryReady\] = useState\(false\)/);
  assert.match(workspace, /immediateOrderFlowHistoryReady = !needsOrderFlowHistory[\s\S]*?hasUsableOrderFlowHistory\(immediateCandles\)/);
  assert.match(workspace, /orderFlowHistoryReady=\{orderFlowHistoryReady\}/);
  assert.match(chart, /!orderFlowHistoryReady[\s\S]*?"cumulative-volume-delta"[\s\S]*?return \[\]/);
  assert.match(chart, /Restoring cumulative volume delta history\./);
});

test("verified cached and downloaded flow release CVD without blocking price history", () => {
  assert.match(workspace, /if \(hasUsableOrderFlowHistory\(cachedCandles\)\) setOrderFlowHistoryReady\(true\)/);
  assert.match(workspace, /setOrderFlowHistoryReady\(hasUsableOrderFlowHistory\(mergedCandles\)\)/);
  assert.match(workspace, /setCandles\(hasImmediateHistory \? immediateCandles : \[\]\)/);
});
