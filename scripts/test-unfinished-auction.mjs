import assert from "node:assert/strict";
import { buildUnfinishedAuctionFrame, normalizeUnfinishedAuctionSettings } from "../src/lib/unfinishedAuction.ts";

const tickSize = 0.25;
const row = (tickIndex, bidVolume, askVolume) => ({ tickIndex, price: tickIndex * tickSize, bidVolume, askVolume, unknownVolume: 0 });
const bar = (id, startTime, rows, closeTick, isClosed = true) => ({
  id, startTime, endTime: startTime + 60_000, highTick: Math.max(...rows.map((item) => item.tickIndex)),
  lowTick: Math.min(...rows.map((item) => item.tickIndex)), closeTick, close: closeTick * tickSize,
  rows, hasPriceLevelFlow: true, isClosed,
});

const base = Date.parse("2026-09-03T23:00:00Z");
const first = bar("one", base, [row(100, 20, 0), row(101, 15, 25), row(102, 3, 30)], 101);
const second = bar("two", base + 60_000, [row(101, 20, 10), row(102, 0, 12), row(103, 0, 8)], 101);
const frame = buildUnfinishedAuctionFrame([first, second], [first, second], "NQ", tickSize, { extendLines: true, removeOnShadowTouch: true });
const badHigh = frame.levels.find((item) => item.id.includes("one:high"));
assert.ok(badHigh, "a non-zero Bid at the exact high must create an unfinished-auction high");
assert.equal(badHigh.state, "triggered", "a later wick touching the level must trigger it when shadow mode is enabled");
assert.equal(frame.levels.some((item) => item.id.includes("one:low")), false, "a normal low with zero Ask must not be fabricated as unfinished");

const closeOnly = buildUnfinishedAuctionFrame([first, second], [first, second], "NQ", tickSize, { extendLines: true, removeOnShadowTouch: false });
assert.equal(closeOnly.levels.find((item) => item.id.includes("one:high"))?.state, "fresh", "wick touch must not trigger close-only mode");

const filtered = buildUnfinishedAuctionFrame([first], [first], "NQ", tickSize, { filterMode: "manual", manualMinimumVolume: 4 });
assert.equal(filtered.levels.length, 0, "manual minimum applies to the anomalous opposite-side volume");

const unavailable = buildUnfinishedAuctionFrame([{ ...first, rows: [], hasPriceLevelFlow: false }], [], "NQ", tickSize);
assert.equal(unavailable.status, "WAITING_FOR_VOLUME_AT_PRICE");
assert.deepEqual(unavailable.levels, []);

const normalized = normalizeUnfinishedAuctionSettings({ daysToLoad: 0, lineWidth: 99, opacity: -2 });
assert.equal(normalized.daysToLoad, 1);
assert.equal(normalized.lineWidth, 8);
assert.equal(normalized.opacity, 0);

const beforeRth = bar("overnight", Date.parse("2026-09-04T13:29:00Z"), [row(98, 10, 5), row(99, 2, 8)], 98);
const atRth = bar("rth-open", Date.parse("2026-09-04T13:30:00Z"), [row(98, 0, 5), row(99, 0, 8)], 98);
const dualReset = buildUnfinishedAuctionFrame([beforeRth, atRth], [beforeRth, atRth], "NQ", tickSize, {
  extendLines: true,
  resetMode: "eth-and-rth-open",
});
assert.equal(
  dualReset.levels.find((item) => item.id.includes("overnight:high"))?.extensionEndMs,
  beforeRth.endTime,
  "ETH-and-RTH reset mode must stop overnight extensions at the 08:30 Chicago RTH open",
);

console.log("Unfinished Auction tests passed.");
