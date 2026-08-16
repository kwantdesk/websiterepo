import assert from "node:assert/strict";
import {
  PocAuctionSuiteEngine,
  choosePocCell,
  normalizePocAuctionSuiteSettings,
} from "../src/lib/pocAuctionSuite.ts";

const tickSize = 0.25;
const row = (tickIndex, bidVolume, askVolume, bidTrades = bidVolume > 0 ? 1 : 0, askTrades = askVolume > 0 ? 1 : 0) => ({
  tickIndex,
  price: tickIndex * tickSize,
  bidVolume,
  askVolume,
  unknownVolume: 0,
  bidTrades,
  askTrades,
  unknownTrades: 0,
  classifiedVolume: bidVolume + askVolume,
  totalVolume: bidVolume + askVolume,
  volume: bidVolume + askVolume,
  delta: askVolume - bidVolume,
  deltaPercent: (askVolume - bidVolume) / Math.max(1, bidVolume + askVolume),
  betweenVolume: 0,
  betweenTrades: 0,
  isPoc: false,
  isValueArea: false,
  isBidImbalance: false,
  isAskImbalance: false,
  bidImbalance: false,
  askImbalance: false,
  isStackedBidImbalance: false,
  isStackedAskImbalance: false,
  stackedBidVolume: 0,
  stackedAskVolume: 0,
  isUnfinishedAuctionHigh: false,
  isUnfinishedAuctionLow: false,
  isMaxBid: false,
  isMaxAsk: false,
  isMaxVolume: false,
  isMaxPositiveDelta: false,
  isMaxNegativeDelta: false,
  isMaxTrades: false,
});

const makeBar = (id, startTime, rows, closeTick, isClosed = true) => {
  const lowTick = Math.min(...rows.map((item) => item.tickIndex));
  const highTick = Math.max(...rows.map((item) => item.tickIndex));
  const bidVolume = rows.reduce((sum, item) => sum + item.bidVolume, 0);
  const askVolume = rows.reduce((sum, item) => sum + item.askVolume, 0);
  const bidTrades = rows.reduce((sum, item) => sum + item.bidTrades, 0);
  const askTrades = rows.reduce((sum, item) => sum + item.askTrades, 0);
  return {
    id,
    instrument: "NQ",
    startTime,
    endTime: startTime + 60_000,
    timestamp: startTime,
    open: closeTick * tickSize,
    high: highTick * tickSize,
    low: lowTick * tickSize,
    close: closeTick * tickSize,
    openTick: closeTick,
    highTick,
    lowTick,
    closeTick,
    bidVolume,
    askVolume,
    unknownVolume: 0,
    betweenVolume: 0,
    classifiedVolume: bidVolume + askVolume,
    totalVolume: bidVolume + askVolume,
    volume: bidVolume + askVolume,
    delta: askVolume - bidVolume,
    deltaPercent: (askVolume - bidVolume) / Math.max(1, bidVolume + askVolume),
    deltaOpen: 0,
    deltaHigh: askVolume - bidVolume,
    deltaLow: 0,
    deltaClose: askVolume - bidVolume,
    bidTrades,
    askTrades,
    unknownTrades: 0,
    totalTrades: bidTrades + askTrades,
    trades: bidTrades + askTrades,
    rows,
    levels: new Map(rows.map((item) => [item.tickIndex, item])),
    pocTick: null,
    valueAreaHighTick: null,
    valueAreaLowTick: null,
    maxBidTick: null,
    maxAskTick: null,
    maxVolumeTick: null,
    maxPositiveDeltaTick: null,
    maxNegativeDeltaTick: null,
    maxTradesTick: null,
    pocPrice: null,
    deltaPocPrice: null,
    vah: null,
    val: null,
    vwap: null,
    isClosed,
    hasPriceLevelFlow: rows.length > 0,
  };
};

const tied = [
  { lowTick: 100, highTick: 100, centreTick: 100, bidVolume: 50, askVolume: 50, unknownVolume: 0, totalVolume: 100, delta: 0, absoluteDelta: 0, bidTradeCount: 2, askTradeCount: 2, totalTradeCount: 4 },
  { lowTick: 102, highTick: 102, centreTick: 102, bidVolume: 50, askVolume: 50, unknownVolume: 0, totalVolume: 100, delta: 0, absoluteDelta: 0, bidTradeCount: 2, askTradeCount: 2, totalTradeCount: 4 },
];
assert.equal(choosePocCell(tied, "total-volume", "highest-price", 101)?.cell.centreTick, 102);
assert.equal(choosePocCell(tied, "total-volume", "lowest-price", 101)?.cell.centreTick, 100);
assert.equal(choosePocCell(tied, "total-volume", "closest-to-close", 102)?.cell.centreTick, 102);
assert.equal(choosePocCell(tied, "trade-count", "follow-shared-profile-engine", 101)?.tieCount, 2);

const base = Date.parse("2026-08-14T14:30:00.000Z");
const display = makeBar("NQ:one", base, [row(400, 20, 20), row(402, 90, 90), row(404, 12, 40)], 402);
const raw = makeBar("NQ:one", base, [row(400, 0, 15), row(401, 15, 18), row(402, 50, 80), row(403, 10, 25), row(404, 0, 40)], 402);
const settings = normalizePocAuctionSuiteSettings({
  auctionExtremeSource: "raw-exchange-tick",
  excessEnabled: false,
  maximumOppositeExtremeVolume: 0,
  minimumAggressiveExtremeVolume: 1,
  minimumAggressiveExtremeTradeCount: 1,
  alertsEnabled: true,
});
const engine = new PocAuctionSuiteEngine();
const first = engine.update([display], [raw], "NQ", tickSize, 2, settings);
assert.equal(first.barPocs[0]?.centreTick, 402.5, "grouped bar POC must use the displayed two-tick price group");
const highAuction = first.auctions.find((item) => item.extremeSide === "high");
assert.ok(highAuction, "closed high auction must be classified");
assert.equal(highAuction.completionState, "zero-side", "auction classification must use the raw one-tick high, not grouped bid volume");
assert.equal(highAuction.exactZeroSide, true);

const nextDisplay = makeBar("NQ:two", base + 60_000, [row(400, 10, 10), row(406, 200, 200), row(408, 0, 20)], 406, false);
const nextRaw = makeBar("NQ:two", base + 60_000, [row(406, 200, 200), row(407, 5, 10), row(408, 0, 20)], 406, false);
const migrated = engine.update([display, nextDisplay], [raw, nextRaw], "NQ", tickSize, 2, { ...settings, showSessionPoc: true });
const sessionPoc = migrated.dynamicPocs.find((item) => item.scope === "session");
assert.ok(sessionPoc, "session POC must be generated from the shared bar range");
assert.ok(sessionPoc.migrationTicks > 0, "developing session POC must expose deterministic migration");
assert.ok(migrated.alerts.some((alert) => alert.type === "session-poc-migrated"), "migration transition must emit once");
const repeated = engine.update([display, nextDisplay], [raw, nextRaw], "NQ", tickSize, 2, { ...settings, showSessionPoc: true });
assert.equal(repeated.alerts.filter((alert) => alert.type === "session-poc-migrated").length, 0, "identical updates must not duplicate alerts");

const unavailable = new PocAuctionSuiteEngine().update([{ ...display, rows: [], hasPriceLevelFlow: false }], [], "NQ", tickSize, 1, settings);
assert.equal(unavailable.status, "WAITING_FOR_VOLUME_AT_PRICE");
assert.equal(unavailable.barPocs.length, 0, "the suite must never fabricate POC from OHLC bars");

console.log("POC & Auction Suite engine tests passed.");
