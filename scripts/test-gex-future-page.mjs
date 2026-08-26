import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * GEX CAL is now the GEX Map FUTURE matrix as a page of its own.
 *
 * The forward expiry x strike surface already existed inside GEX Map behind a
 * PRESENT/FUTURE switch, with the map's symbol, greek, lookahead, value-mode,
 * zoom and palette controls attached to it. The old calendar page was a second
 * reading of the same options data with its own, smaller set of controls.
 * Hosting the real thing gives the page every control the map has instead of a
 * reimplementation that would drift from it.
 */

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const map = readFileSync(new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../src/components/AppSidebar.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the route renders the FUTURE matrix, pinned", () => {
  assert.match(workspace, /<GexMapWorkspace lockedTimeHorizon="future" \/>/);
  const section = workspace.slice(workspace.indexOf('resetKey="gexcal"'), workspace.indexOf('resetKey="gexcal"') + 400);
  assert.match(section, /lockedTimeHorizon="future"/);
});

check("the old calendar workspace is no longer mounted anywhere", () => {
  // Leaving the loader behind is how a replaced page quietly comes back.
  assert.doesNotMatch(workspace, /GexCalendarWorkspace/);
});

check("a pinned horizon wins but does not overwrite the map's own", () => {
  // GEX Map has to reopen on whichever horizon IT was last left on, so the
  // pinned value must not be written back to the shared preference.
  assert.match(map, /const timeHorizon = lockedTimeHorizon \?\? storedTimeHorizon;/);
  assert.match(map, /const \[storedTimeHorizon, setTimeHorizon\]/);
});

check("the horizon switch is hidden when the host pinned one", () => {
  // A page that is only ever FUTURE must not offer a way out of itself - that
  // would just be a second GEX Map on a different URL.
  assert.match(map, /\$\{lockedTimeHorizon \? "hidden" : "flex"\}/);
});

check("the page keeps the map's real controls", () => {
  // The point of hosting the workspace rather than the bare matrix: these are
  // what make it customisable, and they come for free.
  assert.match(map, /<GexMapFutureMatrix palette=\{activePalette\} zoom=\{futureZoom\} \/>/);
  assert.match(map, /adjustFutureZoom/);
});

check("the nav says what the page now is", () => {
  assert.match(sidebar, /label: "GEX FUTURE"/);
  assert.match(sidebar, /href: "\/gex-cal"/, "the route itself is unchanged, so saved links keep working");
});

console.log(`\ngex future page: ${passed}/${passed} checks passed`);
