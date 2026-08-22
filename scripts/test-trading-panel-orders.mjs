import assert from "node:assert/strict";
import {
  applyFill, breakevenStopPrice, flattenIntent, isWorking, nextOcoGroupId,
  ocoSiblingsToCancel, openPnlCurrency, openPnlPoints, ordersToCancel,
  resetOcoGroupIds, resolveOrderOptions, resolveTimeInForce, reverseIntent,
  NO_CAPABILITIES,
} from "../src/lib/tradingPanel.ts";

/**
 * The panel drives brokers with different capabilities, so the failures that
 * matter are the silent ones: an OCO sibling left working after its partner
 * filled, or a reduce-only flag dropped by a venue that never supported it.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const order = (over) => ({
  id: "o1", direction: "buy", type: "limit", quantity: 2, filled: 0,
  price: 100, triggerPrice: null, status: "placed", timeInForce: "gtc",
  ocoGroup: null, options: {}, ...over,
});

const CAPS_FULL = {
  serverOco: true, reduceOnly: true, postOnly: true, closeOnTrigger: true,
  timeInForce: ["gtc", "day", "ioc", "fok"],
};

const bracket = () => {
  const group = nextOcoGroupId();
  return [
    order({ id: "target", direction: "sell", type: "limit", price: 110, ocoGroup: group }),
    order({ id: "stop", direction: "sell", type: "stop", price: null, triggerPrice: 90, ocoGroup: group }),
    order({ id: "unrelated", direction: "buy", price: 80, ocoGroup: null }),
  ];
};

check("filling one leg marks the other for cancellation", () => {
  resetOcoGroupIds();
  const doomed = ocoSiblingsToCancel(bracket(), "target").map((o) => o.id);
  assert.deepEqual(doomed, ["stop"]);
});

check("a standalone order takes nothing with it", () => {
  resetOcoGroupIds();
  assert.deepEqual(ocoSiblingsToCancel(bracket(), "unrelated"), []);
});

check("without server OCO the sibling is cancelled locally", () => {
  resetOcoGroupIds();
  const after = applyFill(bracket(), "target", 2, { serverOco: false });
  assert.equal(after.find((o) => o.id === "target").status, "filled");
  assert.equal(after.find((o) => o.id === "stop").status, "canceled");
  assert.equal(after.find((o) => o.id === "unrelated").status, "placed", "an unrelated order must survive");
});

check("a PARTIAL fill still kills the sibling", () => {
  // The position has moved. Leaving the opposite protection working is what
  // puts a trader on the wrong side of an exit meant to be one-or-the-other.
  resetOcoGroupIds();
  const after = applyFill(bracket(), "target", 1, { serverOco: false });
  assert.equal(after.find((o) => o.id === "target").status, "partlyFilled");
  assert.equal(after.find((o) => o.id === "stop").status, "canceled");
});

check("with server OCO we do not race the venue's own cancels", () => {
  resetOcoGroupIds();
  const after = applyFill(bracket(), "target", 2, { serverOco: true });
  assert.equal(
    after.find((o) => o.id === "stop").status, "placed",
    "the broker owns the cancel; duplicating it races its confirmations",
  );
});

check("more than two legs can share one group", () => {
  const group = nextOcoGroupId();
  const three = ["a", "b", "c"].map((id) => order({ id, ocoGroup: group }));
  const after = applyFill(three, "a", 2, { serverOco: false });
  assert.deepEqual(after.filter((o) => o.status === "canceled").map((o) => o.id), ["b", "c"]);
});

check("an already-dead sibling is not cancelled twice", () => {
  const group = nextOcoGroupId();
  const orders = [
    order({ id: "a", ocoGroup: group }),
    order({ id: "b", ocoGroup: group, status: "canceled" }),
  ];
  assert.deepEqual(ocoSiblingsToCancel(orders, "a").map((o) => o.id), []);
});

check("unsupported options are dropped and reported, never sent", () => {
  const { options, dropped } = resolveOrderOptions(
    { reduceOnly: true, postOnly: true }, NO_CAPABILITIES,
  );
  assert.deepEqual(options, {}, "nothing may be sent that the venue ignores");
  assert.deepEqual(dropped, ["Reduce-only", "Post-only"]);
});

check("supported options pass through untouched", () => {
  const { options, dropped } = resolveOrderOptions({ reduceOnly: true }, CAPS_FULL);
  assert.deepEqual(options, { reduceOnly: true });
  assert.deepEqual(dropped, []);
});

check("an unsupported time in force falls back rather than failing", () => {
  const { timeInForce, substituted } = resolveTimeInForce("fok", NO_CAPABILITIES);
  assert.equal(timeInForce, "gtc");
  assert.equal(substituted, true);
  assert.equal(resolveTimeInForce("day", CAPS_FULL).substituted, false);
});

check("cancel bids and asks split by the order's own direction", () => {
  const book = [
    order({ id: "b1", direction: "buy" }),
    order({ id: "s1", direction: "sell" }),
    order({ id: "s2", direction: "sell", status: "filled" }),
  ];
  assert.deepEqual(ordersToCancel(book, "bids").map((o) => o.id), ["b1"]);
  assert.deepEqual(ordersToCancel(book, "asks").map((o) => o.id), ["s1"], "a filled order is not cancellable");
  assert.deepEqual(ordersToCancel(book, "all").map((o) => o.id), ["b1", "s1"]);
});

check("flatten is same size, opposite way, reduce-only where possible", () => {
  assert.deepEqual(
    flattenIntent({ quantity: 3, averagePrice: 100 }, CAPS_FULL),
    { direction: "sell", quantity: 3, options: { reduceOnly: true } },
  );
  assert.deepEqual(
    flattenIntent({ quantity: -3, averagePrice: 100 }, NO_CAPABILITIES),
    { direction: "buy", quantity: 3, options: {} },
  );
  assert.equal(flattenIntent({ quantity: 0, averagePrice: 0 }, CAPS_FULL), null);
});

check("reverse is double size and must NOT be reduce-only", () => {
  // Reduce-only would stop at flat, which is not a reversal.
  assert.deepEqual(reverseIntent({ quantity: 3, averagePrice: 100 }), { direction: "sell", quantity: 6 });
  assert.deepEqual(reverseIntent({ quantity: -2, averagePrice: 100 }), { direction: "buy", quantity: 4 });
  assert.equal(reverseIntent({ quantity: 0, averagePrice: 0 }), null);
});

check("a break-even stop never rounds through the entry", () => {
  const tick = 0.25;
  // Long: rounding DOWN would put the stop below break-even, turning every use
  // of the button into a small loss.
  assert.equal(breakevenStopPrice({ quantity: 1, averagePrice: 29_400.1 }, tick), 29_400.25);
  assert.equal(breakevenStopPrice({ quantity: -1, averagePrice: 29_400.1 }, tick), 29_400);
  // Exactly on a tick stays put rather than drifting one tick out.
  assert.equal(breakevenStopPrice({ quantity: 1, averagePrice: 29_400.25 }, tick), 29_400.25);
  assert.equal(breakevenStopPrice({ quantity: -1, averagePrice: 29_400.25 }, tick), 29_400.25);
});

check("break-even can carry a cost so it clears fees", () => {
  const withCost = breakevenStopPrice({ quantity: 1, averagePrice: 29_400 }, 0.25, 0.5);
  assert.ok(withCost >= 29_400.5, `expected at or above 29400.5, got ${withCost}`);
});

check("break-even is undefined with no position", () => {
  assert.equal(breakevenStopPrice({ quantity: 0, averagePrice: 100 }, 0.25), null);
});

check("open P&L is signed by the position, not the move", () => {
  assert.equal(openPnlPoints({ quantity: 2, averagePrice: 100 }, 105), 5);
  assert.equal(openPnlPoints({ quantity: -2, averagePrice: 100 }, 105), -5);
  assert.equal(openPnlCurrency({ quantity: 2, averagePrice: 100 }, 105, 20), 200);
  assert.equal(openPnlCurrency({ quantity: -2, averagePrice: 100 }, 95, 20), 200);
});

check("working means placed or partly filled, nothing else", () => {
  assert.equal(isWorking(order({ status: "placed" })), true);
  assert.equal(isWorking(order({ status: "partlyFilled" })), true);
  for (const status of ["none", "filled", "canceled"]) {
    assert.equal(isWorking(order({ status })), false, `${status} is not working`);
  }
});

console.log(`\ntrading panel orders: ${passed}/${passed} checks passed`);
