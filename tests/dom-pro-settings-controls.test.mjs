import assert from "node:assert/strict";
import test from "node:test";
import { createDomProState, domProSettingsFromRecord, domProColumnToggleValue, patchDomProColumnToggle, visibleDomProRows } from "../src/lib/domPro.ts";
test("DOM generic switches and column controls use the same saved column state", () => {
    let record = { domColumns: JSON.stringify([{ id: "orders", enabled: false }, { id: "pullStack", enabled: true }]) };
    assert.equal(domProColumnToggleValue(record, "showOrderCount"), false);
    record = patchDomProColumnToggle(record, "showOrderCount", true);
    assert.equal(domProSettingsFromRecord(record).columns.find(column => column.id === "orders").enabled, true);
    record = patchDomProColumnToggle(record, "showRecentTrades", false);
    assert.ok(domProSettingsFromRecord(record).columns.filter(column => ["buy", "sell", "trades"].includes(column.id)).every(column => !column.enabled));
    assert.equal(domProSettingsFromRecord(record).columns.find(column => column.id === "pullStack").enabled, true);
    record = patchDomProColumnToggle(record, "showRecentTrades", true);
    assert.equal(domProColumnToggleValue(record, "showRecentTrades"), true);
});
test("cumulative DOM shows outward book sums without changing raw resting quantities", () => {
    const state = createDomProState(.25);
    state.bestBidTick = 100;
    state.bestAskTick = 102;
    state.lastTick = 101;
    for (const [tick, bidSize, askSize] of [[100, 10, 0], [99, 20, 0], [97, 30, 0], [102, 0, 4], [104, 0, 8]]) {
        state.levels.set(tick, { tick, bidSize, askSize, bidOrders: 0, askOrders: 0, bidAdded: 0, askAdded: 0, bidRemoved: 0, askRemoved: 0, buyVolume: 0, sellVolume: 0 });
    }
    const raw = visibleDomProRows({ state, rowCount: 9, centreTick: 101 });
    const cumulative = visibleDomProRows({ state, rowCount: 9, centreTick: 101, cumulative: true });
    const at = tick => cumulative.find(row => row.tick === tick);
    assert.equal(at(100).bidSize, 10);
    assert.equal(at(99).bidSize, 30);
    assert.equal(at(97).bidSize, 60);
    assert.equal(at(101).bidSize, 0);
    assert.equal(at(101).askSize, 0);
    assert.equal(at(102).askSize, 4);
    assert.equal(at(104).askSize, 12);
    assert.equal(raw.find(row => row.tick === 99).bidSize, 20);
    assert.equal(state.levels.get(99).bidSize, 20);
    assert.equal(domProSettingsFromRecord({ showCumulative: true }).showCumulative, true);
});
