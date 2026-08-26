import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";

/**
 * GEX CAL is a GEX BOX tool, not a page.
 *
 * It is the GEX Map FUTURE matrix - the forward expiration x strike surface -
 * which already existed inside GEX Map behind a PRESENT/FUTURE switch, with the
 * map's symbol, greek, lookahead, value-mode, zoom and palette controls
 * attached to it. Hosting the real workspace pinned to that horizon gives it
 * every one of those controls; a page of its own would just be GEX Map on a
 * second URL, and a reimplementation would drift from it.
 */

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const map = readFileSync(new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../src/components/AppSidebar.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/app/(workspace)/layout.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../src/components/gexbot/GexBoxDashboard.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("it is offered in GEX BOX, under KwantDesk", () => {
  assert.match(dashboard, /\{ id: "gex-cal", label: "GEX CAL", category: "KwantDesk"/);
  assert.match(dashboard, /if \(panel\.toolId === "gex-cal"\) return <GexMapWorkspace lockedTimeHorizon="future" \/>;/,
    "the panel hosts the real workspace pinned to FUTURE");
  // No endpoint: the workspace fetches for itself, and the shared feed would be
  // handed a URL nothing reads.
  assert.match(dashboard, /id: "gex-cal"[^}]*endpoint: null/);
  assert.match(dashboard, /const GexMapWorkspace = dynamic\(\(\) => import\("@\/components\/gex-map\/GexMapWorkspace"\), \{ ssr: false \}\)/,
    "loaded on demand, so GEX BOX does not carry the map unless a panel asks");
});

check("the page and its button are gone", () => {
  assert.ok(!existsSync(new URL("../src/app/(workspace)/gex-cal", import.meta.url)), "the route directory must be deleted");
  assert.doesNotMatch(sidebar, /gexcal/, "no nav entry, no sidebar key");
  assert.doesNotMatch(sidebar, /GEX FUTURE/, "the interim label must not linger");
  assert.doesNotMatch(layout, /gex-cal/, "the path must no longer map to a section");
  // Deleting only the route would leave the section reachable through saved
  // workspaces.
  assert.doesNotMatch(workspace, /"gexcal"/);
});

check("a pinned horizon wins but does not overwrite the map's own", () => {
  // GEX Map has to reopen on whichever horizon IT was last left on, so the
  // pinned value must not be written back to the shared preference.
  assert.match(map, /const timeHorizon = lockedTimeHorizon \?\? storedTimeHorizon;/);
  assert.match(map, /const \[storedTimeHorizon, setTimeHorizon\]/);
});

check("the horizon switch is hidden when pinned", () => {
  // A panel that is only ever FUTURE must not offer a way out of itself.
  assert.match(map, /\$\{lockedTimeHorizon \? "hidden" : "flex"\}/);
});

check("it keeps the map's real controls", () => {
  // The point of hosting the workspace rather than the bare matrix.
  assert.match(map, /<GexMapFutureMatrix palette=\{activePalette\} zoom=\{futureZoom\} \/>/);
  assert.match(map, /adjustFutureZoom/);
});

console.log(`
gex cal as a tool: ${passed}/${passed} checks passed`);
