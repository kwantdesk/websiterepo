import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chartCrosshairSyncGroup } from "../src/lib/chartCrosshairSync.ts";

/**
 * A chart can share only its CURSOR, keeping its own timeframe, zoom and
 * scale. That is a different thing from linking the viewport, and it has its
 * own button.
 *
 * The button did nothing at all. The shared group was resolved from "is this
 * chart a viewport peer", because linking the viewport used to be the only
 * way to share a cursor — so a crosshair-linked chart, which is deliberately
 * NOT a peer, resolved to an empty group. An empty group is dropped on
 * publish and ignored on receive, so pressing the button changed nothing.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const GROUP = "charts-viewport";

check("a chart sharing only its crosshair still joins the group", () => {
  // THE BUG: this returned "" because the chart is not a viewport peer.
  assert.equal(
    chartCrosshairSyncGroup("gamvue", "NQ", GROUP, true), GROUP,
    "a chart that has opted in must land in the shared group",
  );
});

check("a chart that has opted into nothing stays out", () => {
  assert.equal(chartCrosshairSyncGroup("gamvue", "NQ", GROUP, false), "");
});

check("the matching scope still groups by instrument", () => {
  // Unlinked charts follow the cursor only across the same instrument, which
  // is the behaviour every chart had before any of this.
  assert.equal(chartCrosshairSyncGroup("matching", "NQ", GROUP, false), "NQ");
  assert.equal(chartCrosshairSyncGroup("matching", "NQ", GROUP, true), "NQ");
});

check("an empty group is never published into", () => {
  const source = readFileSync(new URL("../src/lib/chartCrosshairSync.ts", import.meta.url), "utf8");
  assert.match(source, /if \(typeof window === "undefined" \|\| !move\.syncGroupId\) return;/,
    "an empty group must stay unpublished — which is why it had to stop being empty");
});

check("both ends of the bus resolve the same group", () => {
  // A chart that publishes into one group and listens on another is silent in
  // both directions. The sending and receiving sides are computed separately,
  // so they have to be fixed together.
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  const matches = chart.match(/viewportSyncRoleRef\.current === "peer" \|\| crosshairLinkedRef\.current/g) ?? [];
  assert.equal(matches.length, 2, `send and receive must agree (found ${matches.length} of 2)`);
});

check("linking a chart's crosshair is what switches it on", () => {
  // There is also a stored per-scope toggle. Requiring that as WELL meant the
  // button changed nothing the trader could see.
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(
    chart,
    /setCrosshairSyncEnabled\(crosshairLinked \|\| readChartCrosshairSyncEnabled\(crosshairSyncScope\)\)/,
    "the button must enable sync on its own",
  );
  // And a deliberately linked chart must not have its crosshair cleared out
  // from under it for not being a viewport peer.
  assert.match(
    chart,
    /if \(crosshairSyncScope !== "gamvue" \|\| viewportSyncRole === "peer" \|\| crosshairLinked\) return;/,
  );
});

check("the button reaches the chart from the workspace", () => {
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /crosshairLinked=\{linkedCrosshairPaneIds\.has\(pane\.id\)\}/);
  assert.match(workspace, /crosshairLinked=\{crosshairLinked\}/, "the pane wrapper must forward it");
  assert.match(workspace, /toggleCrosshairConnection/, "and the header button must set it");
});

console.log(`\ncrosshair link: ${passed}/${passed} checks passed`);
