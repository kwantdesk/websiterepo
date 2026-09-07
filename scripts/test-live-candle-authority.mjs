import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CHART_INTERVAL_OPTIONS, isEventBasedChartInterval } from "../src/lib/chartIntervals.ts";
import {
  isFullyObservedLiveBucket,
  mergeHistoricalAndLiveCandle,
} from "../src/lib/liveCandleAuthority.ts";

function durationMs(timeframe) {
  const match = timeframe.match(/^(\d+)(s|m|h|D|W|M)$/);
  assert.ok(match, `time interval ${timeframe} has an unsupported shape`);
  const unit = {
    s: 1_000,
    m: 60_000,
    h: 60 * 60_000,
    D: 24 * 60 * 60_000,
    W: 7 * 24 * 60 * 60_000,
    M: 30 * 24 * 60 * 60_000,
  }[match[2]];
  return Number(match[1]) * unit;
}

const timeframes = CHART_INTERVAL_OPTIONS.filter((option) => !isEventBasedChartInterval(option.id));
for (const { id } of timeframes) {
  const duration = durationMs(id);
  const bucketForTimestamp = (timestamp) => Math.floor(timestamp / duration) * duration;
  const firstBucket = bucketForTimestamp(Date.parse("2026-09-06T22:00:00Z"));
  const firstObservedTimestamp = firstBucket + Math.max(1, Math.floor(duration / 3));
  const nextBucket = firstBucket + duration;

  assert.equal(
    isFullyObservedLiveBucket(firstBucket, firstObservedTimestamp, bucketForTimestamp),
    false,
    `${id} must keep archive authority for the partially observed startup bucket`,
  );
  assert.equal(
    isFullyObservedLiveBucket(nextBucket, firstObservedTimestamp, bucketForTimestamp),
    true,
    `${id} must give open authority to the next fully observed live bucket`,
  );

  const historical = {
    timestamp: nextBucket,
    open: 100,
    high: 111,
    low: 99,
    close: 103,
    volume: 80,
  };
  const live = {
    timestamp: nextBucket,
    open: 105,
    high: 109,
    low: 102,
    close: 108,
    volume: 35,
  };
  const merged = mergeHistoricalAndLiveCandle(historical, live, nextBucket, true);
  assert.equal(merged.open, 105, `${id} late history rewound the observed live open`);
  assert.equal(merged.close, 108, `${id} late history rewound the live close`);
  assert.equal(merged.high, 111, `${id} lost a valid historical high`);
  assert.equal(merged.low, 99, `${id} lost a valid historical low`);
  assert.equal(merged.volume, 80, `${id} duplicated or reduced cumulative volume`);

  const partial = mergeHistoricalAndLiveCandle(historical, live, firstBucket, false);
  assert.equal(partial.open, 100, `${id} replaced a partially observed bar's authoritative open`);
}

const workspaceSource = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
assert.ok(
  workspaceSource.match(/mergeHistoricalAndLiveCandle\(/g)?.length >= 2,
  "both history/live reconciliation paths must use the candle authority arbiter",
);
const chartSource = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
assert.match(
  chartSource,
  /latestDirectLiveCandleRef\.current = \{[\s\S]*key: liveCandleEventKey,[\s\S]*instrument,[\s\S]*timeframe,[\s\S]*candle: authoritativeCandle/,
  "the renderer must retain direct live authority separately from React props",
);
assert.match(
  chartSource,
  /authoritativeCandle = retainFormingCandleExtrema\([\s\S]*previousDirectCandle,[\s\S]*detail\.candle/,
  "the final renderer boundary must not allow a stale same-bar snapshot to shrink a wick",
);
assert.match(
  chartSource,
  /directLiveCandle\?\.timestamp === propLastCandle\.timestamp/,
  "a same-bucket React repaint must be reconciled against the direct live candle",
);

console.log(`Live candle authority: ${timeframes.length} time intervals passed`);
