import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * v2 is offered on the standalone GEX MAP page and nowhere else.
 *
 * The two GEX Map surfaces look identical and share one component, which is
 * exactly why this needs a test rather than a convention. The panels embedded
 * in GEX VUE sit beside charts, overlays and a replay clock; a panel there that
 * could silently be showing a different MEASUREMENT than the one next to it is
 * worse than one that cannot show it at all.
 *
 * v1 is also untouched and tagged. Everything here is additive.
 */

const workspace = readFileSync(new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8");
const host = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/gex-map/route.ts", import.meta.url), "utf8");
const server = readFileSync(new URL("../src/lib/gexMapV2.server.ts", import.meta.url), "utf8");
const quantData = readFileSync(new URL("../src/lib/quantData.server.ts", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("only the standalone page opts in", () => {
  // THE BOUNDARY. One mount site passes the flag; the GEX VUE pane must not.
  const mounts = host.match(/<GexMapWorkspace[^>]*/g) ?? [];
  assert.ok(mounts.length >= 2, `expected the standalone page and the GEX VUE pane, found ${mounts.length}`);
  const optedIn = mounts.filter((mount) => mount.includes("enableDealerModel"));
  assert.equal(optedIn.length, 1, "exactly one mount may offer the dealer model");
  // The GEX VUE pane is the one that carries a market and persisted pane state.
  const embedded = mounts.find((mount) => mount.includes("persistedState"));
  assert.ok(embedded, "the GEX VUE pane mount is missing");
  assert.ok(!embedded.includes("enableDealerModel"), "GEX VUE must stay on the structural model");
});

check("the control is hidden unless the host opts in", () => {
  assert.match(workspace, /enableDealerModel = false,/, "it must default off");
  assert.match(workspace, /\{enableDealerModel \? \(/, "the control is gated on the prop");
});

check("v1 is the default everywhere", () => {
  // A trader who has not chosen must be looking at the same numbers as before.
  assert.match(workspace, /useState<"STRUCTURAL_OI" \| "DEALER_INVENTORY">\("STRUCTURAL_OI"\)/);
  assert.match(route, /searchParams\.get\("model"\) \|\| "STRUCTURAL_OI"/);
});

check("the model is part of the cache key", () => {
  // Without this, switching models serves the other calculation's numbers from
  // cache under the new label - the worst failure available to a panel whose
  // entire purpose is which calculation you are looking at.
  assert.match(workspace, /exposureModel === "DEALER_INVENTORY" \? `\$\{base\}:dealer` : base/);
  // And switching must actually refetch.
  assert.match(workspace, /\}, \[exposureModel, expiryScope, panelCacheKey/);
});

check("v2 is gamma only, and says so rather than failing", () => {
  // A dealer book is a gamma position. The same carried contracts revalued
  // through a delta surface would be a different measurement wearing this
  // model's name.
  assert.match(route, /model === "DEALER_INVENTORY" && greekMode !== "GAMMA"/);
  assert.match(route, /dealer inventory model is gamma only/);
  // A DELTA panel stays structural instead of failing the whole load.
  assert.match(workspace, /exposureModel === "DEALER_INVENTORY" && panel\.greekMode === "GAMMA"/);
});

check("v1's own path is untouched", () => {
  // getGexMapPanel must still be reachable and still be what a request without
  // a model parameter gets.
  assert.match(route, /: await getGexMapPanel\(symbol, greekMode, sessionDate, scope, representation\)/);
  assert.doesNotMatch(quantData, /getGexMapPanel[\s\S]{0,4000}?DEALER_INVENTORY/,
    "the structural builder must not learn about the dealer model");
});

check("the tape read is bounded and reports what it missed", () => {
  // The provider caps this endpoint at 100 rows a request and every request
  // takes a slot in the 80ms scheduler. An unbounded read on a five-second
  // panel refresh is the August quota burn again.
  assert.match(quantData, /export async function readConsolidatedTape\(/);
  assert.match(quantData, /maxPages = 100/);
  assert.match(quantData, /truncated: boolean/);
  assert.match(server, /const TAPE_PAGE_LIMIT = 100;/);
  // And the built book is cached so refreshes do not re-read the tape.
  assert.match(server, /unstable_cache\(/);
});

check("the panel admits what the book was built from", () => {
  // A partial book presented as a full one is the dishonesty this prevents.
  assert.match(server, /absorbedPrints: number;/);
  assert.match(server, /tapeTruncated: boolean;/);
  assert.match(server, /tapeFromMs: number \| null;/);
  assert.match(server, /readiness: ReturnType<typeof v2Readiness>;/);
});

check("the two models cannot be confused in the payload", () => {
  const gexMap = readFileSync(new URL("../src/lib/gexMap.ts", import.meta.url), "utf8");
  assert.match(gexMap, /model: "STRUCTURAL_OI" \| "DEALER_INVENTORY";/);
  assert.match(server, /model: "DEALER_INVENTORY",/);
});

check("an empty dealer book fails instead of mimicking v1", () => {
  // THE BUG THE OWNER CAUGHT. The panel keeps the last renderable surface while
  // a request is in flight, so an empty v2 response was silently replaced on
  // screen by the v1 rows already there - identical numbers under a DEALER
  // label, with nothing erroring. The toggle simply appeared to do nothing.
  assert.match(server, /if \(!latestStrikes\.length\) \{/);
  assert.match(server, /throw new QuantDataError\(/);
  assert.match(server, /no dealer book can be built/);
  // The distinction matters for diagnosis: no classified flow at all is a
  // different failure from flow that nets to nothing at every strike.
  assert.match(server, /absorbed === 0/);
});

check("a surface from the other model is dropped, not shown", () => {
  // Retaining the last surface is right for a refresh and wrong across a model
  // change: the two are different measurements, so holding v1's rows under a
  // DEALER heading shows a number the label denies.
  assert.match(workspace, /const expectedModel = exposureModel === "DEALER_INVENTORY"/);
  assert.match(workspace, /if \(next\[panel\.id\] && next\[panel\.id\]\?\.model !== expectedModel\) delete next\[panel\.id\];/);
  assert.match(workspace, /cached\.model === expectedModel/);
});

check("v2 never borrows v1's frames", () => {
  // Frames drive the change columns and replay. Passing the structural frames
  // through would put v1's history under a DEALER label beside v2's ladder -
  // the same lie as the empty-book fallback, in the one place a trader reads to
  // see how a node is BUILDING. A node whose value came from one model and
  // whose change came from another is worse than no change at all.
  //
  // It shipped as an EMPTY list for that reason, and that is what left the
  // dealer model with no replay timeline at all. v2 builds its own now; the
  // rule it was protecting still stands.
  assert.doesNotMatch(server, /frames: structural\.frames,/);
});

check("the book is valued from the contract's own gamma, never a quotient", () => {
  /*
   * THE MEASUREMENT THAT CHANGED THE MODEL.
   *
   * v2 used to recover per-contract gamma by dividing the provider's derived
   * exposure by open interest. Gamma is IDENTICAL for a call and a put at one
   * strike and expiry, so that quotient has one testable property: the call
   * figure and the put figure must agree. Measured on SPX at 2026-08-26, they
   * agreed within 10% at 17% of strikes, with the call/put ratio spanning 0.066
   * to 4,339 against a required 1.0 - so the quotient is not gamma, and every
   * magnitude, every star node and the whole concentration profile were built
   * on it.
   *
   * The provider sends `greeks.gamma` on every consolidated print, and every
   * contract in the book got there BY trading, so every one of them has its own
   * gamma on the same tape the book is built from. It costs nothing extra.
   */
  const engine = readFileSync(new URL("../src/lib/gexMapV2.ts", import.meta.url), "utf8");
  assert.doesNotMatch(engine, /perContractDollarGamma/, "the invalid derivation must not come back");
  assert.doesNotMatch(server, /perContractDollarGamma/);
  // parseFlow must keep carrying the greek through, or the lookup is empty and
  // every strike silently drops out of the ladder.
  assert.match(quantData, /gamma: isRecord\(value\.greeks\) \? finiteNumber\(value\.greeks\.gamma\) : null/);
  assert.match(server, /gammaByContract/);
  assert.match(server, /revalueDealerGex\(\{/);
  // Latest print per contract, not first: gamma moves with spot and time, and
  // the panel revalues the book as it stands NOW.
  assert.match(server, /if \(\(gammaAsOf\.get\(key\) \?\? -1\) >= print\.tradeTime\) continue;/);
});

check("open interest covers the same contracts as the exposure", () => {
  // Open interest no longer sets the VALUE of a contract, but it still bounds
  // how much inventory one strike may absorb, so it must still cover the same
  // contracts the panel lists. Front-expiry exposure read against all-expiry
  // open interest inflates that bound on every front-dated strike.
  assert.match(quantData, /expiration\?: string \| null,/);
  assert.match(quantData, /\.\.\.\(expiration \? \{ expirationDate: expiration \} : \{\}\)/);
  assert.match(
    server,
    /readOpenInterestByStrike\(symbol, sessionDate, scope === "FRONT_EXPIRY" \? structural\.expiration : null\)/,
  );
  // And the structural panel has to be awaited first, because its expiration is
  // what decides the scope of that request.
  const order = server.indexOf("const structural = await getGexMapPanel");
  assert.ok(order > 0 && order < server.indexOf("readOpenInterestByStrike(symbol, sessionDate, scope"));
});

check("the book is carried across prior sessions, and that read is cached", () => {
  /*
   * A book that opens flat discards more flow than it keeps: the 2026-08-21 SPX
   * expiry took 2,072 prints across the prior four sessions against 1,523 on
   * the day itself. Scored against the reference lattice, carrying three
   * sessions took strike coverage from 36% to 82% and sign agreement from 64%
   * to 68%.
   *
   * The cost has to stay bounded or this is the August quota burn again. A
   * completed session's tape cannot change, so each prior session is read once
   * and cached for a day; only the live session's tape is ever re-read.
   */
  assert.match(server, /const readCarriedTape = \(symbol: string, sessionDate: string\) => joinInFlight\(/);
  assert.match(server, /revalidate: 24 \* 60 \* 60/);
  assert.match(server, /priorTradingDates\(sessionDate, DEALER_BOOK_CARRY_SESSIONS\)/);
  // A missing prior session must not fail today's panel - a holiday has no tape.
  assert.match(server, /return \[\] as OptionsFlowPrint\[\];/);
  // Carried prints are filtered to the panel's own expirations and merged in
  // TIME order: the book is aged to each print as it folds in, so appending a
  // prior session after today's would decay the wrong ones.
  assert.match(server, /const inScope = new Set\(expirations\);/);
  assert.match(server, /\.sort\(\(left, right\) => left\.tradeTime - right\.tradeTime\)/);
});

check("a spread leg is dropped, and the half-life is the measured one", () => {
  const engine = readFileSync(new URL("../src/lib/gexMapV2.ts", import.meta.url), "utf8");
  // Multi-leg prints are 57% of the tape and their direction is unreadable
  // without their partners. Halving them still let them dominate; dropping them
  // raised correlation 0.418 -> 0.572 and doubled the star matches.
  assert.doesNotMatch(engine, /complexLegWeight/, "down-weighting a spread leg is not the fix");
  assert.match(engine, /if \(MULTI_LEG_TRADE_TYPES\.has\(String\(raw\.tradeType \?\? ""\)\.toUpperCase\(\)\)\) return null;/);
  // M2S measured as REAL directional flow - dropping it too cut sign 68% -> 62%.
  assert.doesNotMatch(engine, /MULTI_LEG_TRADE_TYPES = new Set\(\[[\s\S]*?M2S/);
  assert.match(engine, /DEALER_FLOW_HALF_LIFE_MS = 12 \* 60 \* 60 \* 1_000;/);
});


check("the panel reports what its nodes are made of", () => {
  /*
   * v2 is no longer pure flow, and the surface must never have to guess. Four
   * fifths is the measured dealer book; the last fifth is the provider's
   * structural surface, which was measured to be a genuinely different signal
   * (r=0.566 against the reference while correlating only 0.32-0.46 with our
   * flow) and which gives the ladder an opinion at every listed strike instead
   * of the 80% flow reaches.
   */
  assert.match(server, /blendDealerNodes\(/);
  assert.match(server, /structural\.latestStrikes,/);
  assert.match(server, /flowShare: DEALER_FLOW_SHARE,/);
  assert.match(server, /flowShare: number;/);
  // The structural side is v1's own surface, so the two models still share a
  // clock and a greek - the thing that makes any comparison between them mean
  // something.
  assert.match(server, /const structural = await getGexMapPanel\(symbol, "GAMMA", sessionDate, scope, representation\);/);
});


check("the dealer model has a replay timeline of its own", () => {
  /*
   * THE BUG. The replay timeline is built from `payload.frames` and nothing
   * else, and v2 shipped `frames: []` - so on the DEALER model the scrubber had
   * nothing to scrub and replay simply did not work. Passing v1's frames
   * through was never the answer: a node whose value comes from one model and
   * whose change comes from another is worse than no change at all.
   *
   * Building them costs no provider requests. The tape is already in hand.
   */
  assert.doesNotMatch(server, /frames: \[\],/, "an empty timeline is what broke replay");
  assert.match(server, /frames: dealerFrames,/);
  assert.match(server, /replayDealerLadders\(\{/);
  // Each minute blends against the structural surface AS IT STOOD THEN, which
  // means walking its incremental updates rather than reusing the closing one.
  assert.match(server, /for \(const update of structural\.frames\[index\]\?\.updates \?\? \[\]\) \{/);
  // Spot comes from the session's own candles, never later than the frame.
  assert.match(server, /if \(candle\.timestamp > timestampMs\) break;/);
  // Sent as updates, not full ladders: a replay payload is already megabytes.
  assert.match(server, /const FRAME_UPDATE_EPSILON = 0\.0001;/);
  assert.match(server, /if \(Math\.sign\(previous\) !== Math\.sign\(row\.net\)\) return true;/);
});


console.log(`\ngex map v2 wiring: ${passed}/${passed} checks passed`);
