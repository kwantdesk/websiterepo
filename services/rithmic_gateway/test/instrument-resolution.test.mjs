import test from "node:test";
import assert from "node:assert/strict";

import {
  compareInstrumentCandidates, resolveInstrumentCandidate,
} from "../src/instrument-resolution.mjs";

/**
 * A micro root aliases to its parent so an MNQ request can be answered from
 * NQ's book. The match that produces is symmetric, so once the micros were
 * actually subscribed a plain NQ request matched MNQU6 too - and it sorted
 * first.
 *
 * Measured live: /v1/market-data/history?symbol=NQ came back as MNQU6 with 27
 * five-minute candles against 809 for NQU6 over the same window, because the
 * micro had only been recorded since the morning it was subscribed. Every NQ
 * timeframe showed about forty minutes and looked like the archive was gone.
 */

const contractRoot = (symbol) => String(symbol).toUpperCase().replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "");
const resolve = (candidates, requested, ownRoot) => resolveInstrumentCandidate(candidates, {
  requestedSymbol: requested, ownRoot, rootOf: contractRoot,
});

const NQ = { symbol: "NQU6", exchange: "CME", status: "LIVE" };
const MNQ = { symbol: "MNQU6", exchange: "CME", status: "LIVE" };

test("a mini request is never answered with the micro", () => {
  // Book order must not decide this: the micro is listed first on purpose.
  assert.equal(resolve([MNQ, NQ], "NQ", "NQ").symbol, "NQU6");
  assert.equal(resolve([NQ, MNQ], "NQ", "NQ").symbol, "NQU6");
});

test("a micro request gets the micro", () => {
  assert.equal(resolve([NQ, MNQ], "MNQ", "MNQ").symbol, "MNQU6");
  assert.equal(resolve([MNQ, NQ], "MNQ", "MNQ").symbol, "MNQU6");
});

test("a micro request still falls back to the parent when no micro is subscribed", () => {
  /*
   * The reason the aliasing exists. A micro tracks its parent tick for tick,
   * and for a long time the micros were not in the book at all.
   */
  assert.equal(resolve([NQ], "MNQ", "MNQ").symbol, "NQU6");
});

test("an exactly named contract always wins", () => {
  // Asking for NQZ6 by name must not be answered with the front month just
  // because it is the livelier book.
  const back = { symbol: "NQZ6", exchange: "CME", status: "STALE" };
  assert.equal(resolve([NQ, back], "NQZ6", "NQ").symbol, "NQZ6");
});

test("status only breaks ties between equals", () => {
  const staleMini = { symbol: "NQU6", exchange: "CME", status: "STALE" };
  const liveMicro = { symbol: "MNQU6", exchange: "CME", status: "LIVE" };
  // The requested root still outranks a livelier book of the wrong instrument.
  assert.equal(resolve([liveMicro, staleMini], "NQ", "NQ").symbol, "NQU6");

  const staleBack = { symbol: "NQZ6", exchange: "CME", status: "STALE" };
  assert.equal(resolve([staleBack, NQ], "NQ", "NQ").symbol, "NQU6", "a live book should win a tie");
});

test("the comparator is a consistent ordering", () => {
  assert.ok(compareInstrumentCandidates(NQ, MNQ, "NQ", contractRoot) < 0);
  assert.ok(compareInstrumentCandidates(MNQ, NQ, "NQ", contractRoot) > 0);
  assert.equal(compareInstrumentCandidates(NQ, NQ, "NQ", contractRoot), 0);
});

test("an empty book resolves to nothing rather than guessing", () => {
  assert.equal(resolve([], "NQ", "NQ"), undefined);
});
