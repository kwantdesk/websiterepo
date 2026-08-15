import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const workspaceSource = await fs.readFile(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);
const componentSource = await fs.readFile(
  new URL("../src/components/order-flow/SpoofingDetectorWorkspace.tsx", import.meta.url),
  "utf8",
);
const engineSource = await fs.readFile(
  new URL("../src/lib/spoofingDetector.ts", import.meta.url),
  "utf8",
);
const streamSource = await fs.readFile(
  new URL("../src/lib/rithmicLiquidityStream.ts", import.meta.url),
  "utf8",
);
const gatewaySource = await fs.readFile(
  new URL("../services/rithmic_gateway/src/server.mjs", import.meta.url),
  "utf8",
);

test("the existing spoofing workspace identity mounts the live detector rather than a generic chart", () => {
  assert.match(workspaceSource, /id: "tool-spoofing-detector", label: "SPOOFING DETECTOR"/);
  assert.match(workspaceSource, /const SpoofingDetectorWorkspace = dynamic\(loadSpoofingDetectorWorkspace/);
  assert.match(workspaceSource, /value !== "tool-spoofing-detector"/);
  assert.match(workspaceSource, /case "tool-spoofing-detector":[\s\S]*?<SpoofingDetectorWorkspace/);
});

test("the detector is a canvas-native microstructure chart with honest states and workspace settings", () => {
  assert.match(componentSource, />PHANTOM ORDERS</);
  assert.match(componentSource, /<canvas/);
  assert.match(componentSource, /LIVE CONTRACTS/);
  assert.match(componentSource, /SUSPECT/);
  assert.match(componentSource, /PULLED/);
  assert.match(componentSource, /DUMPED/);
  assert.match(componentSource, /kwantdesk:spoofing-detector:\$\{workspaceId\}:v1/);
  assert.match(componentSource, /This tool flags suspicious order-book behaviour\. It does not determine trader identity or legally establish intent\./);
});

test("live and retained replay frames use the same shared normalized Rithmic stream", () => {
  assert.match(componentSource, /subscribeRithmicLiquidity\(\{/);
  assert.match(componentSource, /replayHistory: true/);
  assert.match(streamSource, /includeOrderEvents: "1"/);
  assert.match(streamSource, /source\.addEventListener\("history"/);
  assert.match(streamSource, /updateTrackers\(stream, \{ status: payload\.status, snapshot \}, recipients\)/);
  assert.match(gatewaySource, /frame\.snapshot\.orderEvents = state\.pendingOrderEvents\.slice\(\)/);
});

test("the scoring engine preserves exact live, cancelled and aggressive quantities", () => {
  assert.match(engineSource, /liveContracts: row\.size/);
  assert.match(engineSource, /cancelledContracts: 0/);
  assert.match(engineSource, /aggressiveContracts: executions\.get\(key\) \?\? 0/);
  assert.match(engineSource, /Math\.max\(aggregateReduction, lifecycleReduction\) - executed/);
  assert.match(engineSource, /cancellationRatio >= settings\.cancellationRatio/);
  assert.match(engineSource, /executionRatio <= settings\.maximumExecutionRatio/);
  assert.match(engineSource, /settings\.layeringEnabled/);
  assert.match(engineSource, /settings\.pullRepostEnabled/);
});
