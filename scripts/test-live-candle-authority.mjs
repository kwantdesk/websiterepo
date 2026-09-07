import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CHART_INTERVAL_OPTIONS, isEventBasedChartInterval } from "../src/lib/chartIntervals.ts";
import {
  isFullyObservedLiveBucket,
  mergeHistoricalAndLiveCandle,
  mergeHistoricalAndLiveCandleSeries,
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

// Cash/options-underlying history can land after several live snapshots. The
// whole observed candle must survive that seam, not only its final price.
{
  const minute = 60_000;
  const firstObserved = 120_010;
  const history = [
    { timestamp: 60_000, open: 98, high: 101, low: 97, close: 100, volume: 10 },
    { timestamp: 120_000, open: 100, high: 103, low: 99, close: 102, volume: 5 },
  ];
  const observed = [
    ...history,
    { timestamp: 120_000, open: 102, high: 112, low: 101, close: 104, volume: 0 },
    { timestamp: 180_000, open: 108, high: 110, low: 107, close: 109, volume: 0 },
  ];
  const merged = mergeHistoricalAndLiveCandleSeries(
    history,
    observed,
    firstObserved,
    (timestamp) => Math.floor(timestamp / minute) * minute,
  );
  assert.deepEqual(
    [merged[1].open, merged[1].high, merged[1].low, merged[1].close],
    [100, 112, 99, 104],
    "the partially observed options candle lost history authority or its live wick",
  );
  assert.deepEqual(
    [merged[2].open, merged[2].high, merged[2].low, merged[2].close],
    [108, 110, 107, 109],
    "a fully observed options candle did not retain exact live OHLC or its genuine opening gap",
  );
}

const workspaceSource = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
assert.ok(
  workspaceSource.includes("mergeHistoricalAndLiveCandleSeries("),
  "the history/live tail must use the shared candle-series authority arbiter",
);
assert.ok(
  workspaceSource.includes("mergeHistoricalAndLiveCandle("),
  "the observed-second seam must use the single-candle authority arbiter",
);
assert.match(
  workspaceSource,
  /pane\.broker === "Market Index"[\s\S]{0,700}\? mergeHistoricalWithLiveTail\(/,
  "options/index history must merge the complete observed live tail",
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
