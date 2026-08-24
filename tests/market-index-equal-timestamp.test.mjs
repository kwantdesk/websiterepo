import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { shouldAcceptMarketIndexFrame } from "../src/lib/marketIndexLiveClient.ts";

test("SPX accepts genuine price changes inside one provider minute", () => {
  const previous = { timestamp: 1_787_582_460_000, lastPrice: 7_655.57 };

  assert.equal(shouldAcceptMarketIndexFrame(previous, {
    timestamp: previous.timestamp,
    lastPrice: 7_656.31,
  }), true);
  assert.equal(shouldAcceptMarketIndexFrame(previous, { ...previous }), false);
  assert.equal(shouldAcceptMarketIndexFrame(previous, {
    timestamp: previous.timestamp - 60_000,
    lastPrice: 7_650,
  }), false);
  assert.equal(shouldAcceptMarketIndexFrame(previous, {
    timestamp: previous.timestamp + 60_000,
    lastPrice: 7_657,
  }), true);
});

test("the workspace ticker uses timestamp and price identity", async () => {
  const workspace = await readFile(
    new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(workspace, /shouldAcceptMarketIndexFrame\(previousFrame/);
  assert.doesNotMatch(workspace, /timestamp <= previousTimestamp/);
});
