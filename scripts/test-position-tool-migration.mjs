import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * A position calculator saved before the new toolbar must still be grabbable.
 *
 * Two engines can draw a long/short calculator. The LEGACY one in Chart.tsx
 * renders into an SVG overlay whose rail was retired, so that overlay now sits
 * at pointer-events:none. Calculators saved by it were still being DRAWN,
 * which made them look completely normal and behave completely dead: grabbing
 * a corner did nothing, because nothing under the cursor was listening. The
 * live layer's own corner drag was fine the whole time — it was never the code
 * being reached.
 *
 * They are now moved into the live layer on load. Both engines use the same
 * three-point model (entry, stop carrying the shared right edge, target), so
 * the conversion is a copy rather than a reinterpretation.
 */

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const hydration = chart.slice(
  chart.indexOf("const positionKey = positionDrawingsStorageKey"),
  chart.indexOf("const positionHydrationTimer"),
);

check("legacy calculators are moved into the live layer", () => {
  assert.match(hydration, /const legacyPositions = normalizePositionDrawings/);
  assert.match(hydration, /createDrawing\(legacy\.tool as DrawToolId/, "they become real live drawings");
  assert.match(hydration, /commitDrawings\(\[\.\.\.chartingDrawingsRef\.current, \.\.\.migrated\]\)/,
    "appended to the live set, not replacing it");
});

check("the legacy overlay is left holding nothing", () => {
  // Anything it kept would render a second, inert copy underneath the live
  // one — the same dead calculator, now with a working twin on top of it.
  assert.match(hydration, /setDrawings\(\[\]\);/);
  assert.doesNotMatch(
    hydration,
    /setDrawings\(normalizePositionDrawings/,
    "the legacy overlay must no longer be populated from the position store",
  );
});

check("all three points survive the move", () => {
  // Entry, stop, and target — with the stop's time carrying the shared right
  // edge, which is what both engines mean by it.
  assert.match(hydration, /\{ time: entry\.time, price: entry\.price \}/);
  assert.match(hydration, /\{ time: stop\.time, price: stop\.price \}/);
  assert.match(hydration, /\{ time: stop\.time, price: target\.price \}/,
    "the target shares the stop's right edge");
});

check("a calculator saved without a target still gets one", () => {
  // The legacy renderer derived the target at draw time when the third point
  // was absent, so a straight copy would produce a two-point drawing the live
  // tool cannot render at all.
  assert.match(hydration, /const target = legacy\.points\[2\] \?\?/);
  assert.match(hydration, /risk \* 2/, "the same 2R the legacy renderer derived");
  assert.match(hydration, /legacy\.tool === "longPosition" \? entry\.price \+ risk \* 2 : entry\.price - risk \* 2/,
    "and in the correct direction for the side");
});

check("it runs once and never destroys the original", () => {
  // If the conversion is ever wrong, the trader's own calculators have to
  // still be on disk to recover from — so this claims the migration rather
  // than deleting what it read.
  assert.match(hydration, /kwantdesk:position-drawings:migrated:v1:/);
  assert.match(hydration, /const alreadyMigrated = window\.localStorage\.getItem\(positionMigrationClaimKey\) != null;/);
  assert.match(hydration, /if \(legacyPositions\.length && !alreadyMigrated\)/, "guarded, so it cannot duplicate");
  assert.doesNotMatch(hydration, /removeItem\(positionKey\)/, "the original must not be deleted");
});

check("the live set is read through a ref, not a stale closure", () => {
  // This runs from a hydration effect; appending to the drawings captured when
  // that effect was created would drop anything drawn since.
  assert.match(chart, /const chartingDrawingsRef = useRef<Drawing\[\]>\(chartingDrawings\);/);
  assert.match(chart, /chartingDrawingsRef\.current = chartingDrawings;/);
});

check("the legacy overlay is still the inert one", () => {
  // The premise of the whole fix. If this overlay ever becomes interactive
  // again there would be two live position engines fighting for the pointer.
  assert.match(
    chart,
    /isSvgPositionTool\(selectedTool\) \? "pointer-events-auto" : "pointer-events-none"/,
    "the legacy overlay's interactivity gate must be unchanged",
  );
});

console.log(`\nposition tool migration: ${passed}/${passed} checks passed`);
