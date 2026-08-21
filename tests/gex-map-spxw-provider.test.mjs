import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { gexMapProviderTicker } from "../src/lib/gexMap.ts";
import { DARK_POOL_OPTIONS_UNDERLYING_SOURCES, defaultDarkPoolSource } from "../src/lib/darkPoolMap.ts";

test("SPXW GEX panels read the provider's SPX underlying surface", () => {
  assert.equal(gexMapProviderTicker("SPXW"), "SPX");
  assert.equal(gexMapProviderTicker(" spxw "), "SPX");
});

test("other GEX Map symbols retain their own provider roots", () => {
  assert.equal(gexMapProviderTicker("SPX"), "SPX");
  assert.equal(gexMapProviderTicker("NDX"), "NDX");
  assert.equal(gexMapProviderTicker("QQQ"), "QQQ");
});

test("SPXW dark pool prints come from the tradable SPY source", () => {
  // SPXW publishes no off-exchange executions of its own; SPY is the liquid
  // proxy whose prints are mapped into SPXW price space.
  assert.equal(DARK_POOL_OPTIONS_UNDERLYING_SOURCES.SPXW, "SPY");
  assert.equal(defaultDarkPoolSource("SPXW"), "SPY");
});

/**
 * Asking `exposure-by-strike` for SPXW returns a successful but EMPTY payload,
 * so any adapter that forwards the raw ticker fails with a 422 rather than a
 * network error — silent, and invisible to the pure-math feature tests. Every
 * adapter reachable with an SPXW source must therefore address the provider
 * ticker. This scans the source because the alternative is a live vendor call.
 */
test("every SPXW-reachable exposure adapter maps the provider ticker", () => {
  const source = readFileSync(new URL("../src/lib/quantData.server.ts", import.meta.url), "utf8");
  const adapters = [
    // Bounce Levels live profile + Dark Pool GEX confluence.
    "export async function getNetGammaExposureSurface",
    // Gamma workspace, Gameplan/KWANT levels, Expected Move, Zyon context.
    "async function buildOptionsFlowPayload",
    // Chart Gamma Levels (SPXW is a compatible ES-root source).
    "export async function getChartGammaLevels",
    // GEX Map ladder panels and the FUTURE matrix.
    "async function buildGexMapPanel",
    "export async function getGexMapFutureChain",
  ];
  for (const declaration of adapters) {
    const start = source.indexOf(declaration);
    assert.notEqual(start, -1, `${declaration} was renamed — update this guard.`);
    const rest = source.slice(start + declaration.length);
    // Stop at the next top-level declaration of any kind so one adapter's body
    // never absorbs the next one's provider calls.
    const boundary = rest.search(/\n(?:export )?(?:async )?function \w/);
    const body = rest.slice(0, boundary === -1 ? rest.length : boundary);
    // Every identifier this adapter hands to exposure-by-strike as a filter
    // ticker must itself be assigned from gexMapProviderTicker in that body.
    const mapped = new Set(
      [...body.matchAll(/const (\w+)(?::[^=]+)? = gexMapProviderTicker\(/g)].map((match) => match[1]),
    );
    const tickers = [...body.matchAll(/filter: \{ ticker: (\w+)[,\s}]/g)].map((match) => match[1]);
    assert.ok(tickers.length > 0, `${declaration} no longer filters by ticker — update this guard.`);
    for (const ticker of new Set(tickers)) {
      assert.ok(
        mapped.has(ticker),
        `${declaration} forwards unmapped "${ticker}" to the provider; SPXW would return an empty surface.`,
      );
    }
  }
});
