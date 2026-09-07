import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isLiveIndicatorBoundaryAppend } from "../src/lib/chartLiveEvents.ts";

const candle = (timestamp, close = 100) => ({
  timestamp,
  open: close,
  high: close,
  low: close,
  close,
  volume: 1,
});

test("one new live bucket is not classified as a heavyweight history hydration", () => {
  const previous = [candle(60_000), candle(120_000)];
  assert.equal(
    isLiveIndicatorBoundaryAppend(previous, [...previous, candle(180_000)]),
    true,
  );
});

test("backfills, corrections and replacements remain authoritative hydration", () => {
  const previous = [candle(60_000), candle(120_000)];
  assert.equal(isLiveIndicatorBoundaryAppend(previous, [candle(0), ...previous]), false);
  assert.equal(isLiveIndicatorBoundaryAppend(previous, [candle(60_000), candle(120_000, 101)]), false);
  assert.equal(isLiveIndicatorBoundaryAppend(previous, [...previous, candle(90_000)]), false);
});

test("workspace commits every live bar boundary as interruptible React work", () => {
  const workspace = readFileSync(
    new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(workspace, /if \(activeRef\.current\) setCandles\(/);
  assert.match(workspace, /startTransition\(\(\) => setCandles\(reconciledCandles\)\)/);
  assert.match(workspace, /startTransition\(\(\) => setCandles\(committed\)\)/);
  assert.match(workspace, /startTransition\(\(\) => setCandles\(\[\.\.\.next\]\)\)/);
});

test("direct live indicator samples cannot synchronously block the chart canvas", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(
    chart,
    /if \(liveVolumeCandle\) \{[\s\S]*?startTransition\(\(\) => \{[\s\S]*?setSampledIndicatorCandles/,
  );
});
