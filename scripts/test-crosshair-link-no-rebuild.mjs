import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Linking the crosshair must not rebuild the chart.
 *
 * Pressing "Link crosshair" flips the pane's crosshairSyncScope from "matching"
 * to "gamvue". That prop was a DEPENDENCY of the chart-construction effect —
 * the one whose first act is `chartRef.current.remove()` — so toggling the link
 * destroyed the Lightweight Charts instance and built a new one: every series,
 * every primitive, all history re-applied, indicators remounted. From the
 * trader's side the whole chart just refreshed, mid-session, on a click that
 * was only supposed to share a cursor.
 *
 * The scope is never used to CONSTRUCT anything. It is read by the crosshair
 * handlers inside that effect, which is exactly what a ref is for, and the same
 * pattern the viewport sync group next to it already uses.
 */

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

// The construction effect is identified by the teardown it opens with.
const constructionDeps = chart.slice(
  chart.indexOf("}, [chartConstructionSettingsKey,"),
  chart.indexOf("}, [chartConstructionSettingsKey,") + 240,
);

check("the construction effect really is the one that destroys the chart", () => {
  // If this stops being true the test is guarding the wrong effect.
  const effect = chart.slice(chart.indexOf("if (!chartContainerRef.current || candles.length === 0) return;"));
  const teardown = effect.slice(0, effect.indexOf("}, [chartConstructionSettingsKey,"));
  assert.match(teardown, /chartRef\.current\.remove\(\);/, "this effect tears the chart down and rebuilds it");
});

check("a crosshair toggle cannot re-run it", () => {
  // THE REPORTED FAILURE.
  assert.doesNotMatch(
    constructionDeps,
    /crosshairSyncScope[,\]]/,
    "crosshairSyncScope must not be a dependency of the chart-construction effect",
  );
  // The instrument key stays: a different instrument genuinely needs a rebuild.
  assert.match(constructionDeps, /crosshairSyncInstrumentKey/);
});

check("the handlers read the live scope through a ref", () => {
  assert.match(chart, /const crosshairSyncScopeRef = useRef\(crosshairSyncScope\);/);
  // Every in-effect read must go through the ref, or the effect would need the
  // prop back in its dependencies and the rebuild would return.
  const effect = chart.slice(
    chart.indexOf("if (!chartContainerRef.current || candles.length === 0) return;"),
    chart.indexOf("}, [chartConstructionSettingsKey,"),
  );
  // Every mention inside the effect must be the ref. A bare read would force
  // the prop back into the dependency array and bring the rebuild with it.
  const mentions = effect.match(/crosshairSyncScope\w*/g) ?? [];
  assert.ok(mentions.length > 0, "the effect must still consult the scope");
  const bare = mentions.filter((word) => word !== "crosshairSyncScopeRef");
  assert.deepEqual(bare, [], `every read must go through the ref, found: ${bare.join(", ")}`);
});

check("the ref cannot go stale", () => {
  // A ref written by an effect that does not list the prop would freeze at the
  // value it had on mount, and the crosshair link would silently stop working —
  // trading one bug for a quieter one.
  const sync = chart.slice(
    chart.indexOf("viewportSyncGroupRef.current = viewportSyncGroup;"),
    chart.indexOf("viewportSyncGroupRef.current = viewportSyncGroup;") + 700,
  );
  assert.match(sync, /crosshairSyncScopeRef\.current = crosshairSyncScope;/);
  assert.match(sync, /\}, \[crosshairSyncScope, viewportSyncGroup, viewportSyncRole\]\);/,
    "the writing effect must depend on the prop it copies");
});

console.log(`\ncrosshair link rebuild: ${passed}/${passed} checks passed`);
