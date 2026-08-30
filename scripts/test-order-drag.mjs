import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  constrainDraggedPaperOrderPrice, updatePaperOrderPrice,
  paperProjectedPnl, paperTickSize,
} = await import("../src/lib/paperTrading.ts");

/**
 * Dragging a resting order's price.
 *
 * Moving the entry is the one adjustment that changes both sides of a trade at
 * once: the stop and target stay where the trader put them, and the risk and
 * reward measured against them move instead. Dragging the exits along with it
 * would leave both untouched and make the gesture pointless.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const order = (over = {}) => ({
  id: "o1", accountId: "a1", symbol: "NQ", side: "buy", type: "limit",
  quantity: 2, price: 20000, status: "working", createdAt: 0,
  stopLoss: 19950, takeProfits: [{ price: 20100, quantity: 2 }],
  ...over,
});
const ledgerWith = (o) => ({
  accounts: { a1: { id: "a1", orders: [o], positions: [], fills: [], updatedAt: 0 } },
});

check("a long entry cannot be dragged through its own stop or target", () => {
  const tick = paperTickSize("NQ");
  const o = order();
  assert.equal(constrainDraggedPaperOrderPrice(o, 19000), o.stopLoss + tick, "dropped below its stop");
  assert.equal(constrainDraggedPaperOrderPrice(o, 21000), 20100 - tick, "dragged above its target");
  // Inside the band it moves freely, snapped to the tick.
  assert.equal(constrainDraggedPaperOrderPrice(o, 20040.1), 20040);
});

check("a short entry is clamped the other way round", () => {
  const tick = paperTickSize("NQ");
  const o = order({ side: "sell", stopLoss: 20050, takeProfits: [{ price: 19900, quantity: 2 }] });
  assert.equal(constrainDraggedPaperOrderPrice(o, 21000), 20050 - tick, "dragged above its stop");
  assert.equal(constrainDraggedPaperOrderPrice(o, 19000), 19900 + tick, "dropped below its target");
});

check("an order with no protection moves anywhere", () => {
  const o = order({ stopLoss: null, takeProfits: [] });
  assert.equal(constrainDraggedPaperOrderPrice(o, 21000), 21000);
  assert.equal(constrainDraggedPaperOrderPrice(o, 100), 100);
});

check("the P&L on each exit follows the new entry", () => {
  /*
   * This is the whole point of the gesture. The stop and target do not move -
   * what they are WORTH does.
   */
  const o = order();
  const before = {
    stop: paperProjectedPnl("NQ", "buy", o.price, o.stopLoss, o.quantity),
    target: paperProjectedPnl("NQ", "buy", o.price, o.takeProfits[0].price, o.quantity),
  };
  const moved = updatePaperOrderPrice(ledgerWith(o), "a1", "o1", 20050);
  const next = moved.accounts.a1.orders[0];
  assert.equal(next.price, 20050, "the order did not move");
  assert.equal(next.stopLoss, o.stopLoss, "the stop was dragged along");
  assert.deepEqual(next.takeProfits, o.takeProfits, "the target was dragged along");

  const after = {
    stop: paperProjectedPnl("NQ", "buy", next.price, next.stopLoss, next.quantity),
    target: paperProjectedPnl("NQ", "buy", next.price, next.takeProfits[0].price, next.quantity),
  };
  // Entry moved UP on a long: more is risked, less is left to make.
  assert.ok(after.stop < before.stop, `risk did not grow: ${before.stop} -> ${after.stop}`);
  assert.ok(after.target < before.target, `reward did not shrink: ${before.target} -> ${after.target}`);
});

check("only a working order can be repriced", () => {
  // A filled entry is a record of what happened, not a setting.
  for (const status of ["filled", "cancelled", "rejected"]) {
    const before = ledgerWith(order({ status }));
    assert.equal(updatePaperOrderPrice(before, "a1", "o1", 20050), before, `${status} was repriced`);
  }
  const missing = ledgerWith(order());
  assert.equal(updatePaperOrderPrice(missing, "a1", "nope", 20050), missing);
  assert.equal(updatePaperOrderPrice(missing, "nope", "o1", 20050), missing);
  assert.equal(updatePaperOrderPrice(missing, "a1", "o1", Number.NaN), missing);
});

check("the chart drags a resting entry and refuses a filled one", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /const restingEntry = level\.kind === "entry" && level\.resting;/);
  assert.match(chart, /if \(level\.kind === "entry" && !restingEntry\) return;/, "a filled entry can be dragged");
  assert.match(chart, /onUpdatePaperOrderPrice\?\.\(level\.position\.accountId, level\.position\.id, latestPrice\)/);
  // The label has to be a handle, or there is nothing to grab.
  assert.match(chart, /\{level\.resting && onUpdatePaperOrderPrice \? \(/);
});

check("the exits reprice while the pointer is still down", () => {
  /*
   * Matching on the dragged level's own id only ever reaches the line under the
   * cursor, so the entry drag carries its position id and the siblings read it.
   */
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /const draggedEntryPrice = paperDragPreview\?\.kind === "entry"/);
  assert.match(chart, /&& paperDragPreview\.positionId === level\.position\.id/);
  assert.match(chart, /const effectiveEntry = draggedEntryPrice \?\? level\.position\.entryPrice;/);
  // And that entry must be the one the projected figure is measured from.
  assert.match(chart, /paperProjectedPnl\(\s*\n\s*level\.position\.symbol,\s*\n\s*level\.position\.side,\s*\n\s*effectiveEntry,/);
});

console.log(`\norder drag: ${passed}/${passed} checks passed`);
