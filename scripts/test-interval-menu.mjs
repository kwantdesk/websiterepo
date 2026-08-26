import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CHART_INTERVAL_GROUPS, makeCustomChartInterval } from "../src/lib/chartIntervals.ts";

/**
 * The interval menu, restored.
 *
 * The top bar's favourites are a shortcut to a handful of intervals. The menu
 * behind them is where every interval the feed supports lives, along with the
 * custom builders for volume, range, tick, renko and delta bars, and how much
 * history the chart loads.
 *
 * It was removed wholesale by "Make the top bar a global favourites switcher"
 * (fcb39791), which took the trigger, the drafts, applyCustomInterval and the
 * Load range block with it — leaving only the favourites, so any interval not
 * already pinned became unreachable and the load range could not be changed at
 * all.
 */

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the trigger is left of the favourites", () => {
  const trigger = workspace.indexOf('aria-label="Chart intervals"');
  const favourites = workspace.indexOf("{visibleFavouriteIntervals.map((tf) => (");
  assert.ok(trigger > 0 && favourites > 0, "both the trigger and the favourites strip must exist");
  assert.ok(trigger < favourites, "the menu button opens the bar; it belongs before the pinned intervals");
  assert.match(workspace, /aria-expanded=\{showAllTF\}/);
});

check("it shows the load range, defaulting to 5D", () => {
  assert.match(workspace, /\["1D", "5D", "1W", "1M", "3M", "6M", "1Y", "All"\]\.map\(\(range\) => \(/);
  assert.match(workspace, /onClick=\{\(\) => handleChartPeriod\(activePaneId, range\)\}/,
    "the range applies to the pane being looked at, not globally");
  assert.match(workspace, /standard is 5D/);
});

check("every interval kind has a custom builder draft", () => {
  // A kind without a draft renders no inputs, so the builder row is dead for
  // that group — which is how volume and range bars became untypeable.
  const kinds = [...new Set(CHART_INTERVAL_GROUPS.map((group) => group.kind))];
  const drafts = workspace.slice(
    workspace.indexOf("const [intervalDrafts, setIntervalDrafts]"),
    workspace.indexOf("const [intervalDrafts, setIntervalDrafts]") + 900,
  );
  for (const kind of kinds) {
    assert.ok(
      drafts.includes(`${kind}:`) || drafts.includes(`"${kind}":`),
      `interval kind "${kind}" has no seeded draft`,
    );
  }
});

check("a custom interval is refused when the feed cannot serve it", () => {
  const apply = workspace.slice(workspace.indexOf("const applyCustomInterval"), workspace.indexOf("const applyCustomInterval") + 600);
  assert.match(apply, /if \(!interval \|\| !supportsChartInterval\(interval, activeChartBrokerLabel\)\) return;/,
    "switching to an interval the feed cannot serve would load an empty chart");
  assert.match(apply, /setShowAllTF\(false\);/, "applying closes the menu");
  // And the builder actually produces the interval the library understands.
  // Read off the builder itself rather than assumed: lowercase for volume,
  // range and trade; uppercase R is RENKO, not range.
  assert.equal(makeCustomChartInterval("volume", 500, 1), "500v");
  assert.equal(makeCustomChartInterval("range", 40, 1), "40r");
  assert.equal(makeCustomChartInterval("renko", 20, 1), "20R");
  assert.equal(makeCustomChartInterval("volume-bars", 4, 2), "4/2VB");
});

check("the menu can be dismissed", () => {
  const dismiss = workspace.slice(workspace.indexOf("if (!showAllTF) return;"), workspace.indexOf("const applyCustomInterval"));
  // Pointerdown, so it closes on the press that starts an interaction elsewhere
  // rather than waiting for the release.
  assert.match(dismiss, /document\.addEventListener\("pointerdown", closeOnOutsidePointer\)/);
  assert.match(dismiss, /if \(event\.key === "Escape"\) setShowAllTF\(false\);/);
  assert.match(dismiss, /document\.removeEventListener\("pointerdown", closeOnOutsidePointer\)/);
  assert.match(dismiss, /timeframeMenuRef\.current\?\.contains\(target\)/, "pressing inside the menu is not a dismissal");
});

check("intervals can be pinned to the bar from inside the menu", () => {
  // Otherwise the favourites strip could only ever shrink.
  const menu = workspace.slice(workspace.indexOf("{showAllTF ? ("), workspace.indexOf("{showAllTF ? (") + 9_000);
  assert.match(menu, /onClick=\{\(\) => toggleFavTF\(option\.id\)\}/);
  assert.match(menu, /selectTimeframe\(option\.id\);/);
});

console.log(`\ninterval menu: ${passed}/${passed} checks passed`);
