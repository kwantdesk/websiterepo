import assert from "node:assert/strict";

import { insideMarket } from "../public/heatmap-app/src/live-market.js";

/**
 * The liquidity map's inside market.
 *
 * Measured live on NQ: the collector published a book whose ask stack was
 * correct from tick 118590 up, while two phantom asks sat at 118156 and 118214
 * - about a hundred points BELOW the market. Both the collector and the map
 * pick the inside market with a plain min/max, so a phantom became bestAsk and
 * was reported ~400 ticks below bestBid. The ask trail was then drawn far off
 * the bottom of the plot, and the map showed one price line where it draws two.
 *
 * A resting ask below the best bid would already have traded, so a crossed
 * inside market is a level the book never removed, not a real quote.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const bids = (...ticks) => new Map(ticks.map((t) => [t, 1]));
const asks = bids;

check("a healthy book is returned untouched", () => {
  // The common case must cost nothing and change nothing: these are the
  // collector's own numbers and they are already correct.
  const out = insideMarket(bids(118587, 118586), asks(118590, 118591), 118587, 118590, 118589);
  assert.deepEqual(out, { bid: 118587, ask: 118590 });
});

check("a phantom ask below the market no longer sets the inside", () => {
  // The measured failure, with its real tick values.
  const book = asks(118156, 118214, 118590, 118591);
  const out = insideMarket(bids(118587, 118586, 118585), book, 118587, 118156, 118589);
  assert.equal(out.ask, 118590, "the ask must come from the stack above the trade");
  assert.equal(out.bid, 118587);
  assert.ok(out.ask > out.bid, "the inside market must not be crossed");
});

check("a phantom bid above the market is repaired the same way", () => {
  // Nothing about the failure is specific to the ask side.
  const book = bids(119900, 118587, 118586);
  const out = insideMarket(book, asks(118590, 118591), 119900, 118590, 118589);
  assert.equal(out.bid, 118587);
  assert.equal(out.ask, 118590);
});

check("the spread stays realistic rather than merely uncrossed", () => {
  const out = insideMarket(
    bids(118587, 118586, 118585),
    asks(118156, 118590, 118591),
    118587, 118156, 118589,
  );
  // Four ticks on NQ is a normal overnight spread. The old value was 431.
  assert.ok(out.ask - out.bid <= 8, `spread ${out.ask - out.bid} is not a real inside market`);
});

check("without a trade to referee, the collector's numbers stand", () => {
  /*
   * The last trade is what makes the repair honest - it comes from the tape
   * rather than the book. With no trade there is nothing to prefer one side
   * over the other, and inventing a level would be worse than showing what the
   * collector actually published.
   */
  const out = insideMarket(bids(118587), asks(118156), 118587, 118156, Number.NaN);
  assert.deepEqual(out, { bid: 118587, ask: 118156 });
});

check("a side with nothing past the trade keeps what it had", () => {
  // Every ask sits below the trade: there is no better answer available, so
  // the collector's own value is returned rather than Infinity.
  const out = insideMarket(bids(118587), asks(118100, 118156), 118587, 118100, 118589);
  assert.equal(out.ask, 118100, "an impossible book must not produce an impossible number");
  assert.ok(Number.isFinite(out.bid) && Number.isFinite(out.ask));
});

console.log(`\nliquidity inside market: ${passed}/${passed} checks passed`);
