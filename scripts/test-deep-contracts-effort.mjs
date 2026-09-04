import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  admitLiveDeepContractEvents,
  calculateDeepContractEvents,
  retainDeepContractEvents,
} from "../src/lib/deepContracts.ts";
import { calculateDeepEffort } from "../src/lib/deepEffort.ts";
import { defaultIndicatorSettings, normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";

const now = Date.UTC(2026, 8, 4, 15, 0);
const trade = (id, timestamp, price, volume, aggressor = "BUY") => ({
  eventId: id,
  recordIndex: Number(id.replace(/\D/g, "")) || 0,
  timestamp,
  open: price,
  high: price,
  low: price,
  close: price,
  volume,
  askVolume: aggressor === "BUY" ? volume : 0,
  bidVolume: aggressor === "SELL" ? volume : 0,
  delta: aggressor === "BUY" ? volume : -volume,
  trades: 1,
  aggressor,
});

const settings = {
  daysToLoad: 1,
  deepMinimumTradeSize: 30,
  deepBoxTickRange: 4,
  deepTickMargin: 1,
  clusterWindowMs: 100,
};

{
  const defaults = defaultIndicatorSettings("big-trades");
  assert.equal(defaults.showBigContracts, true);
  assert.equal(defaults.showDeepContracts, false, "Deep contracts is opt-in for existing chart appearance");
  const migrated = normalizeStoredIndicator({
    instanceId: "legacy-big-contracts",
    indicatorId: "big-trades",
    enabled: true,
    settings: { bigTradesSettingsVersion: 5, manualFilter: 75 },
  });
  assert.equal(migrated.settings?.showBigContracts, true);
  assert.equal(migrated.settings?.showDeepContracts, false);
  assert.equal(migrated.settings?.manualFilter, 75, "migration preserves the user's filter");
  assert.equal(migrated.settings?.bigTradesSettingsVersion, 6);

  const effort = normalizeStoredIndicator({
    instanceId: "legacy-big-blocks",
    indicatorId: "deep-m-effort-nq",
    enabled: true,
    settings: { effortSettingsVersion: 4, zoneOpacity: 44 },
  });
  assert.equal(effort.settings?.minimumDeltaPercent, 20);
  assert.equal(effort.settings?.zoneOpacity, 44, "Big Blocks migration preserves visual choices");
  assert.equal(effort.settings?.effortSettingsVersion, 5);
}

{
  const tape = [
    trade("t1", now - 300, 20000, 10),
    trade("t2", now - 200, 20000, 20),
    trade("t3", now - 150, 20000.25, 20),
    trade("t4", now - 20, 20002, 50, "SELL"),
  ];
  const events = calculateDeepContractEvents(tape, settings, 0.25, now);
  assert.equal(events.length, 2, "nearby same-side executions aggregate before filtering");
  assert.equal(events[0].volume, 50);
  assert.equal(events[0].executions, 3);
  assert.equal(events[0].top - events[0].bottom, 1, "box height is exactly four ticks");
  assert.equal(events[1].side, "BID");

  const watermark = tape.at(-1).timestamp;
  const liveTape = [...tape, trade("t5", watermark + 1, 20001, 60)];
  const live = admitLiveDeepContractEvents(liveTape, watermark, settings, 0.25);
  assert.equal(live.length, 1, "a qualifying execution is admitted immediately");
  assert.equal(live[0].volume, 60);
  assert.equal(admitLiveDeepContractEvents(liveTape, live[0].timestamp, settings, 0.25).length, 0,
    "the tape watermark prevents duplicate live boxes");

  const burst = [...tape, ...Array.from({ length: 40 }, (_, index) =>
    trade(`b${index}`, watermark + index + 1, 20001 + (index % 2) * 0.25, index % 8 === 0 ? 60 : 2))];
  const started = performance.now();
  for (let run = 0; run < 500; run += 1) {
    admitLiveDeepContractEvents(burst, watermark, settings, 0.25);
  }
  const perBatch = (performance.now() - started) / 500;
  assert.ok(perBatch < 1, `live Deep Contracts admission must fit inside a frame (${perBatch.toFixed(3)}ms)`);

  const retained = retainDeepContractEvents(events.slice(0, 1), events.slice(1), now - 86_400_000);
  assert.equal(retained.length, 2, "qualified boxes survive raw-tape compaction");
}

{
  const candles = Array.from({ length: 30 }, (_, index) => {
    const open = 20000 + index * 0.25;
    const signal = index === 29;
    return {
      timestamp: now - (30 - index) * 60_000,
      open,
      high: open + (signal ? 2 : 1),
      low: open - 0.5,
      close: open + (signal ? 1.75 : 0.1),
      volume: signal ? 5_000 : 1_000,
      askVolume: signal ? 4_500 : 520,
      bidVolume: signal ? 500 : 480,
      delta: signal ? 4_000 : 40,
      trades: signal ? 1_200 : 250,
    };
  });
  const base = calculateDeepEffort(candles, {
    instrument: "NQ",
    tickSize: 0.25,
    minimumBars: 20,
    minimumDeltaPercent: 20,
    maximumDeltaPercent: 100,
    averageLength: 13,
    entryZoneRangePercent: 28,
  });
  assert.equal(base.zones.at(-1)?.startIndex, 29, "the forming high-effort bar can signal immediately");
  assert.equal(calculateDeepEffort(candles, {
    instrument: "NQ", tickSize: 0.25, minimumBars: 20,
    minimumDeltaPercent: 90, maximumDeltaPercent: 100,
  }).zones.length, 0, "minimum delta percentage is a real filter");
  assert.equal(calculateDeepEffort(candles, {
    instrument: "NQ", tickSize: 0.25, minimumBars: 20,
    minimumDeltaPercent: 20, maximumDeltaPercent: 50,
  }).zones.length, 0, "maximum delta percentage is a real filter");
  assert.equal(calculateDeepEffort(candles, {
    instrument: "NQ", tickSize: 0.25, minimumBars: 20,
    minimumDeltaPercent: 20, maximumDeltaPercent: 100, maximumDeltaEffort: 10,
  }).zones.length, 0, "maximum delta effort is enforced in contracts per tick");

  const started = performance.now();
  for (let run = 0; run < 100; run += 1) {
    calculateDeepEffort(candles.map((candle, index) => (
      index === candles.length - 1 ? { ...candle, close: candle.close + (run % 2) * 0.01 } : candle
    )), {
      instrument: "NQ", tickSize: 0.25, minimumBars: 20,
      minimumDeltaPercent: 20, maximumDeltaPercent: 100,
    });
  }
  const perFormingBar = (performance.now() - started) / 100;
  assert.ok(perFormingBar < 4,
    `forming-bar effort recomputation must remain bounded (${perFormingBar.toFixed(3)}ms)`);
}

{
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.ok(chart.includes("admitLiveDeepContractEvents("), "Deep Contracts uses the execution event path");
  assert.ok(chart.includes("window.addEventListener(LIVE_CHART_CANDLE_EVENT, receive)"),
    "Deep Effort consumes the live forming candle");
  assert.ok(chart.includes("bigBlocksPrimitiveRef.current"), "Deep Effort paints imperatively");
}

console.log("Deep Contracts and Deep Effort tests passed.");
