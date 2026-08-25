import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The GEX Map opens on gamma across SPX, SPY and QQQ.
 *
 * It used to open its three columns on three DIFFERENT greeks — gamma, then
 * delta, then vanna — so the first thing on screen compared three unlike
 * measures across three underlyings. Reading gamma across the index, the ETF
 * and the Nasdaq proxy side by side is what the map is opened for; the other
 * greeks are a click away per column.
 */

const source = readFileSync(new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

/** The panel list a named const declares, in order. */
function panelsOf(name) {
  const start = source.indexOf(`const ${name}`);
  assert.ok(start > 0, `${name} is gone`);
  const body = source.slice(start, source.indexOf("];", start));
  return [...body.matchAll(/symbol: "([A-Z]+)", greekMode: "([A-Z]+)"/g)]
    .map((match) => ({ symbol: match[1], greekMode: match[2] }));
}

check("it opens on SPX, SPY and QQQ gamma", () => {
  assert.deepEqual(panelsOf("DEFAULT_PANELS"), [
    { symbol: "SPX", greekMode: "GAMMA" },
    { symbol: "SPY", greekMode: "GAMMA" },
    { symbol: "QQQ", greekMode: "GAMMA" },
  ]);
});

check("every default column reads the same greek", () => {
  // The actual complaint: three columns, three different measures.
  for (const name of ["DEFAULT_PANELS", "MARKET_PANELS"]) {
    const modes = new Set(panelsOf(name).map((panel) => panel.greekMode));
    assert.deepEqual([...modes], ["GAMMA"], `${name} opens on mixed greeks: ${[...modes].join(", ")}`);
  }
});

check("a pinned market keeps its own family", () => {
  // Consistent greeks must not flatten the market scoping — an NQ-linked map
  // still leads with NDX.
  const start = source.indexOf("const MARKET_PANELS");
  const nq = source.slice(source.indexOf("NQ: [", start), source.indexOf("ES: [", start));
  assert.match(nq, /symbol: "NDX", greekMode: "GAMMA"/, "an NQ map must still lead with NDX");
});

check("an untouched old layout is carried forward, a chosen one is not", () => {
  // A pane still holding the exact old default was never configured; anything
  // else is the trader's choice and must survive untouched.
  assert.match(source, /const LEGACY_DEFAULT_PANELS/);
  assert.deepEqual(panelsOf("LEGACY_DEFAULT_PANELS"), [
    { symbol: "SPX", greekMode: "GAMMA" },
    { symbol: "SPY", greekMode: "DELTA" },
    { symbol: "QQQ", greekMode: "VANNA" },
  ], "the migration must match the layout that actually shipped");
  assert.match(
    source,
    /panels: isLegacyDefaultPanels\(panels\) \? DEFAULT_PANELS\.map\(\(panel\) => \(\{ \.\.\.panel \}\)\) : panels,/,
    "only the untouched old default may be replaced",
  );
});

console.log(`\ngex map defaults: ${passed}/${passed} checks passed`);
