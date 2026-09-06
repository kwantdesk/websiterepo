import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import {
  DEFAULT_DEEP_PROFILE_VALUES_SETTINGS,
  buildDeepProfileValuesFrame,
  normalizeDeepProfileValuesSettings,
} from "../src/lib/deepProfileValues.ts";
import { calculateVolumeProfileValueArea } from "../src/lib/volumeProfileMath.ts";
import { normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";

const tickSize = 1;
const row = (price, bid = 2, ask = 3, unknown = 0) => ({
  tickIndex: price, price, bidVolume: bid, askVolume: ask, unknownVolume: unknown,
  bidTrades: bid ? 1 : 0, askTrades: ask ? 1 : 0, unknownTrades: unknown ? 1 : 0,
  classifiedVolume: bid + ask, totalVolume: bid + ask + unknown, delta: ask - bid,
  deltaPercent: (ask - bid) / Math.max(1, bid + ask + unknown) * 100,
  isPoc: false, isValueArea: false, isBidImbalance: false, isAskImbalance: false,
  isStackedBidImbalance: false, isStackedAskImbalance: false, stackedBidVolume: 0, stackedAskVolume: 0,
  isUnfinishedAuctionHigh: false, isUnfinishedAuctionLow: false, isMaxBid: false, isMaxAsk: false,
  isMaxVolume: false, isMaxPositiveDelta: false, isMaxNegativeDelta: false, isMaxTrades: false,
  betweenVolume: unknown, betweenTrades: unknown ? 1 : 0, volume: bid + ask + unknown,
  bidImbalance: false, askImbalance: false,
});
const bar = (index, timestamp = index * 60_000, prices = [100 + index % 4]) => ({
  id: `b${index}`, instrument: "NQ", startTime: timestamp, endTime: timestamp + 60_000,
  timestamp, open: prices[0], high: Math.max(...prices), low: Math.min(...prices), close: prices.at(-1),
  openTick: prices[0], highTick: Math.max(...prices), lowTick: Math.min(...prices), closeTick: prices.at(-1),
  bidVolume: 2 * prices.length, askVolume: 3 * prices.length, unknownVolume: 0,
  classifiedVolume: 5 * prices.length, totalVolume: 5 * prices.length, delta: prices.length,
  deltaPercent: 20, deltaOpen: 0, deltaHigh: prices.length, deltaLow: 0, deltaClose: prices.length,
  bidTrades: prices.length, askTrades: prices.length, unknownTrades: 0, totalTrades: 2 * prices.length,
  levels: new Map(), rows: prices.map((price) => row(price)), pocTick: prices[0], valueAreaHighTick: prices.at(-1),
  valueAreaLowTick: prices[0], maxBidTick: prices[0], maxAskTick: prices[0], maxVolumeTick: prices[0],
  maxPositiveDeltaTick: prices[0], maxNegativeDeltaTick: prices[0], maxTradesTick: prices[0],
  vwap: prices[0], isClosed: index < 99, hasPriceLevelFlow: true, betweenVolume: 0,
  volume: 5 * prices.length, trades: 2 * prices.length, pocPrice: prices[0], deltaPocPrice: prices[0],
  vah: prices.at(-1), val: prices[0],
});

const normalized = normalizeDeepProfileValuesSettings({ periodMode: "bad", groupTicks: -2, valueAreaPercent: 120, numberOfProfiles: 0 });
assert.equal(normalized.periodMode, "multiples");
assert.equal(normalized.groupTicks, 1);
assert.equal(normalized.valueAreaPercent, 100);
assert.equal(normalized.numberOfProfiles, 1);

const migrated = normalizeDeepProfileValuesSettings({
  lineWidth: 3,
  showDevelopingValueArea: true,
});
assert.equal(migrated.schemaVersion, 2);
assert.equal(migrated.developingValueArea, "dash");
assert.equal(migrated.pocLineWidth, 3);
assert.equal(migrated.valueAreaLineWidth, 3);
assert.equal(migrated.peakLineWidth, 3);
assert.equal(migrated.valleyLineWidth, 3);
assert.equal(migrated.vwapLineWidth, 3);

const migratedStored = normalizeStoredIndicator({
  instanceId: "legacy-profile-values",
  indicatorId: "deep-profile-values",
  enabled: true,
  settings: { lineWidth: 3, showDevelopingValueArea: true },
});
assert.equal(migratedStored.settings.developingValueArea, "dash");
assert.equal(migratedStored.settings.pocLineWidth, 3);
assert.equal(migratedStored.settings.valueAreaLineWidth, 3);
assert.equal(migratedStored.settings.peakLineWidth, 3);
assert.equal(migratedStored.settings.valleyLineWidth, 3);
assert.equal(migratedStored.settings.vwapLineWidth, 3);

const styled = normalizeDeepProfileValuesSettings({
  developingValueArea: "solid",
  levelLabelSide: "left",
  levelLineStyle: "dash-dot-dot",
  pocLineWidth: 0,
  valueAreaLineWidth: 9,
  peakLineWidth: 1.5,
  valleyLineWidth: 2.5,
  vwapLineWidth: 4,
});
assert.equal(styled.developingValueArea, "solid");
assert.equal(styled.levelLabelSide, "left");
assert.equal(styled.levelLineStyle, "dash-dot-dot");
assert.equal(styled.pocLineWidth, 0.5);
assert.equal(styled.valueAreaLineWidth, 6);
assert.equal(styled.peakLineWidth, 1.5);
assert.equal(styled.valleyLineWidth, 2.5);
assert.equal(styled.vwapLineWidth, 4);

const bars = Array.from({ length: 12 }, (_, index) => ({ ...bar(index), isClosed: index < 11 }));
const composite = buildDeepProfileValuesFrame(bars, "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS, periodMode: "composite", groupingMode: "manual", groupTicks: 1,
  pocLineMode: "developing", developingValueArea: "dash", showDevelopingVwap: true,
});
assert.equal(composite.status, "LIVE");
assert.equal(composite.profiles.length, 1);
assert.equal(composite.profiles[0].contractSymbol, "NQZ6");
assert.equal(composite.profiles[0].totalVolume, 60);
assert.equal(composite.profiles[0].developingPoc.length, bars.length);
assert.equal(composite.profiles[0].developingValueArea.length, bars.length);
assert.equal(composite.profiles[0].developingVwap.length, bars.length);
assert.ok(composite.profiles[0].poc !== null && composite.profiles[0].vah !== null && composite.profiles[0].val !== null);
const sharedValueArea = calculateVolumeProfileValueArea(
  composite.profiles[0].levels,
  tickSize,
  DEFAULT_DEEP_PROFILE_VALUES_SETTINGS.valueAreaPercent,
);
assert.equal(composite.profiles[0].poc, sharedValueArea.poc);
assert.equal(composite.profiles[0].vah, sharedValueArea.vah);
assert.equal(composite.profiles[0].val, sharedValueArea.val);

const visible = buildDeepProfileValuesFrame(bars, "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS, periodMode: "visible", groupingMode: "manual", groupTicks: 1,
}, undefined, { startMs: 3 * 60_000, endMs: 7 * 60_000 });
assert.equal(visible.profiles.length, 1);
assert.equal(visible.profiles[0].startMs, 3 * 60_000);
assert.equal(visible.profiles[0].endMs, 7 * 60_000);

const volumePeriods = buildDeepProfileValuesFrame(bars, "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS, periodMode: "multiples", lengthType: "volume", lengthValue: 20,
  numberOfProfiles: 20, groupingMode: "manual", groupTicks: 1,
});
assert.equal(volumePeriods.profiles.length, 3);
assert.ok(volumePeriods.profiles.every((profile) => profile.totalVolume === 20));

const sessionStart = Date.UTC(2026, 8, 4, 13, 0);
const sessionBars = Array.from({ length: 8 }, (_, index) => bar(index, sessionStart + index * 60 * 60_000));
const split = buildDeepProfileValuesFrame(sessionBars, "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS, periodMode: "composite", filterMode: "split",
  sessionStartMinutes: 8 * 60 + 30, sessionEndMinutes: 15 * 60 + 15, numberOfProfiles: 20,
});
assert.ok(split.profiles.length >= 2, "split time produces separate inside/outside session value sets");
assert.ok(new Set(split.profiles.map((profile) => profile.sessionLabel)).size >= 2);

assert.deepEqual(buildDeepProfileValuesFrame(bars, "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS, inputData: "order",
}), { status: "WAITING_FOR_ORDER_HISTORY", profiles: [] });
const noFlow = bars.map((item) => ({ ...item, rows: [], hasPriceLevelFlow: false }));
assert.deepEqual(buildDeepProfileValuesFrame(noFlow, "NQ", "NQZ6", tickSize), { status: "WAITING_FOR_VOLUME_AT_PRICE", profiles: [] });

const positiveVolumeGap = bars.map((item, index) => index === 5 ? { ...item, rows: [], hasPriceLevelFlow: false } : item);
assert.deepEqual(
  buildDeepProfileValuesFrame(positiveVolumeGap, "NQ", "NQZ6", tickSize, {
    ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS,
    periodMode: "composite",
  }),
  { status: "WAITING_FOR_VOLUME_AT_PRICE", profiles: [] },
  "a positive-volume VAP hole must fail closed rather than join levels across it",
);

const zeroVolumeBridge = bars.map((item, index) => index === 5 ? {
  ...item,
  rows: [],
  hasPriceLevelFlow: false,
  bidVolume: 0,
  askVolume: 0,
  classifiedVolume: 0,
  totalVolume: 0,
  delta: 0,
  totalTrades: 0,
  volume: 0,
  trades: 0,
} : item);
const bridged = buildDeepProfileValuesFrame(zeroVolumeBridge, "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS,
  periodMode: "composite",
});
assert.equal(bridged.profiles.length, 1);
assert.equal(bridged.profiles[0].totalVolume, 55, "a genuine zero-volume bridge contributes no fabricated volume");

const filteredTrades = [
  { recordIndex: 1, timestamp: 30_000, open: 110, high: 110, low: 110, close: 110, trades: 1, volume: 12, bidVolume: 0, askVolume: 12, delta: 12, aggressor: "BUY" },
  { recordIndex: 2, timestamp: 90_000, open: 90, high: 90, low: 90, close: 90, trades: 1, volume: 5, bidVolume: 5, askVolume: 0, delta: -5, aggressor: "SELL" },
];
const filteredDeveloping = buildDeepProfileValuesFrame(bars.slice(0, 2), "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS, periodMode: "composite", filterMin: 10,
  pocLineMode: "developing", developingValueArea: "dash", showDevelopingVwap: true,
}, filteredTrades);
assert.equal(filteredDeveloping.profiles[0].totalVolume, 12);
assert.deepEqual(filteredDeveloping.profiles[0].developingPoc.map((point) => point.price), [110, 110]);
assert.deepEqual(filteredDeveloping.profiles[0].developingVwap.map((point) => point.price), [110, 110]);

const fragmentedTrades = [
  { recordIndex: 1, timestamp: 30_000, open: 110, high: 110, low: 110, close: 110, trades: 1, volume: 6, bidVolume: 0, askVolume: 6, delta: 6, aggressor: "BUY" },
  { recordIndex: 2, timestamp: 30_000, open: 110, high: 110, low: 110, close: 110, trades: 1, volume: 6, bidVolume: 0, askVolume: 6, delta: 6, aggressor: "BUY" },
];
const rejectedIndividualPrints = buildDeepProfileValuesFrame(bars.slice(0, 1), "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS,
  periodMode: "composite",
  inputData: "volume",
  filterMin: 10,
}, fragmentedTrades);
assert.equal(rejectedIndividualPrints.profiles.length, 0, "Volume filters individual prints before price aggregation");
const acceptedAggregateTrade = buildDeepProfileValuesFrame(bars.slice(0, 1), "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS,
  periodMode: "composite",
  inputData: "aggregate-trades",
  filterMin: 10,
}, fragmentedTrades);
assert.equal(acceptedAggregateTrade.profiles[0].totalVolume, 12, "Aggregate Trades combines matching fragments before filtering");
assert.equal(acceptedAggregateTrade.profiles[0].askVolume, 12);

const many = Array.from({ length: 20_000 }, (_, index) => bar(index));
const started = performance.now();
const performanceFrame = buildDeepProfileValuesFrame(many, "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS, periodMode: "multiples", lengthType: "minutes", lengthValue: 60,
  numberOfProfiles: 6, groupingMode: "manual", groupTicks: 1,
});
assert.equal(performanceFrame.profiles.length, 6);
assert.ok(performance.now() - started < 1_500, "20k exact rows remain interactive");

const chartSource = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const rawPocSourceGuard = chartSource.match(/const rawPocAuctionBars = useMemo\(\(\) => \{([\s\S]*?)return buildFootprintBarsCached/);
assert.ok(rawPocSourceGuard, "the shared exact price-ladder source guard remains discoverable");
assert.match(rawPocSourceGuard[1], /deepProfileValuesIndicator/, "Profile Values must activate its own exact VAP source");
assert.match(chartSource, /pocLineWidth: deepProfileValuesSettings\.pocLineWidth/);
assert.match(chartSource, /valueAreaLineWidth: deepProfileValuesSettings\.valueAreaLineWidth/);
assert.match(chartSource, /levelLabelSide: deepProfileValuesSettings\.levelLabelSide/);
assert.match(chartSource, /PROFILE_LEVEL_DASH\[deepProfileValuesSettings\.levelLineStyle\]/);

const settingsSource = readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
for (const label of ["Developing value area", "Level line style", "Level label side"]) {
  assert.match(settingsSource, new RegExp(`\\["${label}"`), `${label} remains available in Profile Values settings`);
}

console.log("deep profile values tests passed");
