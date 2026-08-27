import assert from "node:assert/strict";

import {
  contractKey,
  parseContractKey,
  perContractDollarGamma,
  tradeInventoryDelta,
  classifyConsolidatedTrade,
  classifyConsolidatedTape,
  carryDealerInventory,
  advanceDealerInventory,
  emptyDealerInventory,
  revalueDealerGex,
  representationScale,
  DEALER_INVENTORY_OI_BOUND,
  DEALER_INVENTORY_WARMUP_CONTRACTS,
  decayDealerInventory,
  DEALER_FLOW_HALF_LIFE_MS,
  v2Readiness,
  accumulateDecayedTape,
} from "../src/lib/gexMapV2.ts";

/**
 * The v2 engine's arithmetic.
 *
 * v1 shows a vendor's snapshot and cannot flip one strike while its neighbours
 * hold, cannot move when the market moves and nothing trades, and cannot carry
 * anything across the open. Those three are the whole reason v2 exists, so they
 * are asserted directly rather than inferred from a score.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("contract keys round-trip", () => {
  const key = contractKey("2026-08-21", 765, "put");
  assert.deepEqual(parseContractKey(key), { expiration: "2026-08-21", strike: 765, right: "put" });
  assert.equal(parseContractKey("rubbish"), null);
  assert.equal(parseContractKey("2026-08-21|765|banana"), null);
});

check("per-contract gamma is positive on both sides", () => {
  // The provider signs puts negative by convention. A long put and a long call
  // both have POSITIVE gamma; carrying that convention into the state would
  // bake in the dealer positioning this engine exists to measure.
  const gamma = perContractDollarGamma({
    strike: 765, callExposure: 20_000, putExposure: -60_000,
    callOpenInterest: 100, putOpenInterest: 200,
  });
  assert.equal(gamma.call, 200);
  assert.equal(gamma.put, 300);
  // No open interest means no per-contract figure to divide out, not Infinity.
  const empty = perContractDollarGamma({
    strike: 1, callExposure: 5, putExposure: -5, callOpenInterest: 0, putOpenInterest: 0,
  });
  assert.deepEqual(empty, { call: 0, put: 0 });
});

const trade = (over = {}) => ({
  expiration: "2026-08-21", strike: 765, right: "call", contracts: 100,
  dealerSign: -1, dealerCounterpartyProbability: 1, economicTradeWeight: 1,
  complexLegWeight: 1, quoteConfidence: 1, ...over,
});

check("a customer buy makes the dealer shorter gamma", () => {
  assert.equal(tradeInventoryDelta(trade({ dealerSign: -1 })), -100);
  assert.equal(tradeInventoryDelta(trade({ dealerSign: 1 })), 100);
  // Unresolved direction contributes nothing rather than a guessed direction.
  assert.equal(tradeInventoryDelta(trade({ dealerSign: 0 })), 0);
});

check("uncertainty scales a trade down, it does not reverse it", () => {
  const half = tradeInventoryDelta(trade({ quoteConfidence: 0.5 }));
  assert.equal(half, -50);
  // Weights multiply, so two half-confident dimensions compound.
  assert.equal(tradeInventoryDelta(trade({ quoteConfidence: 0.5, complexLegWeight: 0.5 })), -25);
  // Out-of-range weights are clamped, never negated.
  assert.equal(tradeInventoryDelta(trade({ quoteConfidence: 5 })), -100);
  // Math.abs, because a zeroed weight legitimately produces -0 and strict
  // equality distinguishes it from 0 while arithmetic does not.
  assert.equal(Math.abs(tradeInventoryDelta(trade({ quoteConfidence: -5 }))), 0);
  assert.equal(tradeInventoryDelta(trade({ contracts: -100 })), 0);
});

check("the provider's own labels drive the classifier", () => {
  const raw = {
    strikePrice: 765, contractType: "PUT", expirationDate: "2026-08-21",
    size: 500, tradeSideCode: "BID", tradeConsolidationType: "SPLIT",
    tradeType: "AUTO", openInterest: 26031,
  };
  const classified = classifyConsolidatedTrade(raw);
  assert.ok(classified);
  // Customer hit the bid, so a dealer bought it and is longer gamma.
  assert.equal(classified.dealerSign, 1);
  assert.equal(classified.right, "put");
  assert.equal(classified.contracts, 500);
  // A SPLIT is the record most at risk of double counting against its legs.
  assert.equal(classified.economicTradeWeight, 0.6);

  // Lifting the offer is the mirror image.
  assert.equal(classifyConsolidatedTrade({ ...raw, tradeSideCode: "ASK" })?.dealerSign, -1);
  // Through the quote is the least ambiguous print on the tape.
  assert.equal(classifyConsolidatedTrade({ ...raw, tradeSideCode: "BELOW_BID" })?.quoteConfidence, 1);
  assert.ok(classifyConsolidatedTrade({ ...raw, tradeSideCode: "BID" }).quoteConfidence < 1);
  // A midpoint print has no aggressor, so it is dropped, not guessed.
  assert.equal(classifyConsolidatedTrade({ ...raw, tradeSideCode: "MID_MARKET" }), null);
  // A multi-leg print is one side of a spread whose partner offsets it.
  assert.equal(classifyConsolidatedTrade({ ...raw, tradeType: "MULTI_AUTO_COB" })?.complexLegWeight, 0.5);
  // Unusable records are dropped rather than defaulted into the state.
  assert.equal(classifyConsolidatedTrade({ ...raw, size: 0 }), null);
  assert.equal(classifyConsolidatedTrade({ ...raw, contractType: "" }), null);
});

check("a tape is classified in time order", () => {
  const base = {
    strikePrice: 765, contractType: "CALL", expirationDate: "2026-08-21",
    size: 1, tradeSideCode: "ASK", tradeConsolidationType: "SWEEP", tradeType: "AUTO",
  };
  const out = classifyConsolidatedTape([
    { ...base, tradeTime: 300, size: 3 },
    { ...base, tradeTime: 100, size: 1 },
    { ...base, tradeTime: 200, size: 2, tradeSideCode: "MID_MARKET" },
  ]);
  // Ordering matters because the bound is applied per step.
  assert.deepEqual(out.map((t) => t.contracts), [1, 3]);
});

const oiOf = (map) => (key) => map[key] ?? 0;

check("inventory accumulates and is held inside the OI bound", () => {
  const key = contractKey("2026-08-21", 765, "call");
  const openInterest = oiOf({ [key]: 1_000 });
  let state = emptyDealerInventory("2026-08-21", 0);
  state = advanceDealerInventory(state, [trade({ contracts: 200, dealerSign: -1 })], openInterest);
  assert.equal(state.contracts[key], -200);
  // Runaway accumulation is classifier error, not inventory, so it stops at the
  // bound rather than growing without limit.
  state = advanceDealerInventory(state, [trade({ contracts: 5_000, dealerSign: -1 })], openInterest);
  assert.equal(state.contracts[key], -1_000 * DEALER_INVENTORY_OI_BOUND);
  // And a position at the bound is still free to trade back the other way.
  state = advanceDealerInventory(state, [trade({ contracts: 100, dealerSign: 1 })], openInterest);
  assert.ok(state.contracts[key] > -1_000 * DEALER_INVENTORY_OI_BOUND);
});

check("state carries across sessions, minus what expired", () => {
  const live = contractKey("2026-08-28", 765, "call");
  const dead = contractKey("2026-08-20", 765, "call");
  const previous = {
    sessionDate: "2026-08-21", asOfMs: 1, carried: false, absorbedContracts: 900,
    contracts: { [live]: 500, [dead]: -400 },
  };
  const carried = carryDealerInventory(previous, "2026-08-21", 2);
  // Gamma of an expired contract is gone; carrying it would revalue a position
  // that no longer exists.
  assert.deepEqual(Object.keys(carried.contracts), [live]);
  assert.equal(carried.carried, true);
  assert.equal(carried.absorbedContracts, 900);
});

check("a unit change cannot flip a sign", () => {
  // This is why the $1 / 1% toggle was ruled out as the cause of the Skylit
  // divergence: both directions are positive scalars.
  assert.ok(representationScale("PER_ONE_DOLLAR_MOVE", "PER_ONE_PERCENT_MOVE", 765) > 0);
  assert.ok(representationScale("PER_ONE_PERCENT_MOVE", "PER_ONE_DOLLAR_MOVE", 765) > 0);
  assert.equal(representationScale("PER_ONE_DOLLAR_MOVE", "PER_ONE_DOLLAR_MOVE", 765), 1);
  // A round trip returns the original magnitude.
  const there = representationScale("PER_ONE_DOLLAR_MOVE", "PER_ONE_PERCENT_MOVE", 765);
  const back = representationScale("PER_ONE_PERCENT_MOVE", "PER_ONE_DOLLAR_MOVE", 765);
  assert.ok(Math.abs(there * back - 1) < 1e-12);
  // A nonsense spot must not produce a nonsense scale.
  assert.equal(representationScale("PER_ONE_DOLLAR_MOVE", "PER_ONE_PERCENT_MOVE", 0), 1);
});

const rows = [
  { strike: 764, callExposure: 10_000, putExposure: -10_000, callOpenInterest: 100, putOpenInterest: 100 },
  { strike: 765, callExposure: 20_000, putExposure: -60_000, callOpenInterest: 100, putOpenInterest: 200 },
];

check("one strike can flip while its neighbour holds", () => {
  // THE POINT. A vendor snapshot recomputed every frame cannot do this; a
  // per-contract signed quantity can.
  const state = {
    sessionDate: "2026-08-21", asOfMs: 1, carried: true, absorbedContracts: 1e6,
    contracts: {
      [contractKey("2026-08-21", 764, "call")]: 50,
      [contractKey("2026-08-21", 765, "call")]: -50,
    },
  };
  const frame = revalueDealerGex({
    state, rows, expirations: ["2026-08-21"], spot: 765,
    representation: "PER_ONE_DOLLAR_MOVE", providerRepresentation: "PER_ONE_DOLLAR_MOVE",
  });
  const at = (strike) => frame.nodes.find((node) => node.strike === strike);
  assert.ok(at(764).net > 0);
  assert.ok(at(765).net < 0);
  // The Star is the largest absolute node, whichever way it points.
  assert.equal(frame.starStrike, 765);
  assert.equal(frame.status, "ready");
});

check("a strike with no inventory is absent, not zero", () => {
  const state = emptyDealerInventory("2026-08-21", 1);
  const frame = revalueDealerGex({
    state, rows, expirations: ["2026-08-21"], spot: 765,
    representation: "PER_ONE_DOLLAR_MOVE", providerRepresentation: "PER_ONE_DOLLAR_MOVE",
  });
  // A confident zero is a claim. No position is not the same as flat.
  assert.deepEqual(frame.nodes, []);
  assert.equal(frame.starStrike, null);
});

check("a cold state reports itself as warming", () => {
  // An engine that presents a from-nothing estimate as settled is worse than
  // one that says it is still filling up.
  const cold = {
    sessionDate: "2026-08-21", asOfMs: 1, carried: false, absorbedContracts: 10,
    contracts: { [contractKey("2026-08-21", 765, "call")]: 5 },
  };
  const frame = revalueDealerGex({
    state: cold, rows, expirations: ["2026-08-21"], spot: 765,
    representation: "PER_ONE_DOLLAR_MOVE", providerRepresentation: "PER_ONE_DOLLAR_MOVE",
  });
  assert.equal(frame.status, "warming");
  assert.ok(DEALER_INVENTORY_WARMUP_CONTRACTS > 0);
  // A state carried from a real previous session is not warming.
  assert.equal(revalueDealerGex({
    state: { ...cold, carried: true }, rows, expirations: ["2026-08-21"], spot: 765,
    representation: "PER_ONE_DOLLAR_MOVE", providerRepresentation: "PER_ONE_DOLLAR_MOVE",
  }).status, "ready");
});

check("the same book reprices when the market moves", () => {
  // v1 needs a new vendor snapshot to change. v2 changes because gamma and spot
  // changed under an unchanged position.
  const state = {
    sessionDate: "2026-08-21", asOfMs: 1, carried: true, absorbedContracts: 1e6,
    contracts: { [contractKey("2026-08-21", 765, "call")]: 100 },
  };
  const shared = { state, expirations: ["2026-08-21"], spot: 765, representation: "PER_ONE_PERCENT_MOVE", providerRepresentation: "PER_ONE_DOLLAR_MOVE" };
  const before = revalueDealerGex({ ...shared, rows });
  const richer = rows.map((row) => (row.strike === 765 ? { ...row, callExposure: 40_000 } : row));
  const after = revalueDealerGex({ ...shared, rows: richer });
  assert.ok(Math.abs(after.nodes[0].net) > Math.abs(before.nodes[0].net));
  // Same position, same sign - only the valuation moved.
  assert.equal(Math.sign(after.nodes[0].net), Math.sign(before.nodes[0].net));
});

check("decaying the book per step equals decaying every trade", () => {
  // The engine decays the whole accumulated position once per step, which is
  // O(1) instead of O(trades). That is only legitimate because exponential
  // decay composes - this proves it rather than asserting it.
  const key = contractKey("2026-08-21", 765, "call");
  const half = DEALER_FLOW_HALF_LIFE_MS;
  const openInterest = () => 1e9;

  let stepwise = emptyDealerInventory("2026-08-21", 0);
  stepwise = advanceDealerInventory(stepwise, [trade({ contracts: 100, dealerSign: 1 })], openInterest);
  stepwise = decayDealerInventory(stepwise, half, half);
  stepwise = advanceDealerInventory(stepwise, [trade({ contracts: 100, dealerSign: 1 })], openInterest);
  stepwise = decayDealerInventory(stepwise, half * 2, half);

  // The first trade is two half-lives old by the end, the second is one.
  const perTrade = 100 * 2 ** -2 + 100 * 2 ** -1;
  assert.ok(
    Math.abs(stepwise.contracts[key] - perTrade) < 1e-9,
    `stepwise ${stepwise.contracts[key]} vs per-trade ${perTrade}`,
  );
});

check("decay drops fragments and never runs backwards", () => {
  const key = contractKey("2026-08-21", 765, "call");
  const state = {
    sessionDate: "2026-08-21", asOfMs: 1_000, carried: true, absorbedContracts: 1e6,
    contracts: { [key]: 4 },
  };
  // Long enough and the position is a rounding artefact, not a book.
  assert.deepEqual(decayDealerInventory(state, 1_000 + DEALER_FLOW_HALF_LIFE_MS * 4).contracts, {});
  // A clock that goes backwards, or a repeated frame, must not amplify it.
  assert.equal(decayDealerInventory(state, 0).contracts[key], 4);
  assert.equal(decayDealerInventory(state, 1_000).contracts[key], 4);
  // Decay shrinks magnitude and never flips a sign.
  const aged = decayDealerInventory({ ...state, contracts: { [key]: -1_000 } }, 1_000 + DEALER_FLOW_HALF_LIFE_MS);
  assert.ok(aged.contracts[key] < 0 && aged.contracts[key] > -1_000);
});

check("v2 declares where it is validated and where it is not", () => {
  // Measured mean correlation vs v1: cash index 0.603 vs 0.141, SPY -0.330 vs
  // 0.006, QQQ 0.038 vs 0.244. Shipping a number because it is newer, when it
  // measured worse than what it replaces, is the failure this prevents.
  assert.equal(v2Readiness("SPX"), "validated");
  assert.equal(v2Readiness("spxw"), "validated");
  assert.equal(v2Readiness("SPY"), "experimental");
  assert.equal(v2Readiness("QQQ"), "experimental");
  assert.equal(v2Readiness("AAPL"), "experimental");
});

check("ageing per trade is not the same as one decay at the end", () => {
  // THE BUG THIS CAUGHT. The server accumulated the whole tape at full weight
  // and decayed the book once. One factor applied to everything is a global
  // scalar, and a global scalar leaves every relative value unchanged - so the
  // book was silently on the `carry` policy, which measured -0.302 against the
  // reference where the shipped 3h policy measured +0.603. It showed up live as
  // 94% of rows positive above spot and negative below: a function of distance
  // from spot, not a dealer book.
  const half = DEALER_FLOW_HALF_LIFE_MS;
  const oi = () => 1e9;
  const at = (ms, right, contracts, dealerSign) => ({
    tradeTimeMs: ms, expiration: "2026-08-21", strike: 765, right, contracts, dealerSign,
    dealerCounterpartyProbability: 1, economicTradeWeight: 1, complexLegWeight: 1, quoteConfidence: 1,
  });
  // An old buy and a recent sell of equal size at the same strike.
  const tape = [at(0, "call", 100, -1), at(half * 3, "call", 100, 1)];
  const now = half * 3;

  const aged = accumulateDecayedTape(emptyDealerInventory("2026-08-21", 0), tape, oi, now, half);
  const key = contractKey("2026-08-21", 765, "call");

  // Correct: the three-half-life-old buy is worth an eighth of the fresh sell,
  // so the book is net LONG.
  assert.ok(aged.contracts[key] > 0, `expected net long, got ${aged.contracts[key]}`);

  // The old way: advance both at full weight, then decay once. They cancel
  // exactly and the strike vanishes - age carried no information at all.
  let broken = emptyDealerInventory("2026-08-21", 0);
  broken = advanceDealerInventory(broken, tape, oi);
  broken = decayDealerInventory(broken, now, half);
  assert.ok(
    !broken.contracts[key],
    `one decay at the end must lose the age information, got ${broken.contracts[key]}`,
  );
});

console.log(`\ngex map v2: ${passed}/${passed} checks passed`);
