import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Velocity is measured from the session open, not from a minute ago.
 *
 * The pill divided by whatever the node held one step back, so a node that was
 * near zero a minute ago read 900% or 3,000% now - arithmetically true, useless
 * to read, and it re-rolled on every refresh. Against the open the same number
 * answers what a trader is asking: how much has this node built today.
 */

const source = readFileSync(new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the surface at the session's first frame is carried alongside the others", () => {
  assert.match(source, /function sessionOpenSurface\(payload: GexMapPanelPayload, upTo: number \| null\)/);
  // The FIRST frame, not the newest one before the cursor.
  assert.match(source, /const first = payload\.frames\.find\(\(frame\) => upTo === null \|\| frame\.timestamp <= upTo\);/);
  // Both snapshot paths supply it - the live one and the replay cursor one -
  // and so does the empty-payload case, or the pill would crash on first paint.
  assert.equal((source.match(/opening: sessionOpenSurface\(payload/g) ?? []).length, 2);
  assert.match(source, /\{ current: new Map\(\), previous: new Map\(\), opening: new Map\(\) \}/);
});

check("the pill measures against the open", () => {
  assert.match(source, /const openedAt = opening\.get\(row\.strike\);/);
  assert.match(
    source,
    /growthPct = openingMagnitude >= velocityBaselineFloor\s*\n\s*\? \(\(Math\.abs\(row\.net\) - openingMagnitude\) \/ openingMagnitude\) \* 100/,
  );
  // The step window is NOT the baseline any more. It still drives the change
  // column, which is a different reading, but not this pill.
  assert.doesNotMatch(source, /growthPct = prior && Math\.abs\(prior\.net\) > 0/);
  assert.match(source, /since the session opened/);
});

check("a node that opened at a rounding error shows no pill", () => {
  // Dividing by a rounding error is what manufactured the readings in the first
  // place. Without this floor the fix just moves the absurdity to a new
  // denominator.
  assert.match(source, /const velocityBaselineFloor = starMagnitude \* 0\.005;/);
  assert.match(source, /if \(!openedAt \|\| Math\.abs\(openedAt\.net\) < velocityBaselineFloor\) continue;/);
});

check("the nodes picked as movers are the nodes whose number is shown", () => {
  // The selection and the pill must share a baseline. Picking the fastest
  // movers over one step and then printing session growth beside them would
  // label the wrong strikes.
  const selection = source.slice(
    source.indexOf("const growthTickStrikes = useMemo"),
    source.indexOf("const greek = GEX_MAP_GREEKS"),
  );
  assert.match(selection, /opening\.get\(row\.strike\)/);
  assert.doesNotMatch(selection, /previous\.get\(row\.strike\)/);
  assert.match(selection, /\}, \[opening, rows, velocityBaselineFloor\]\);/);
});

console.log(`\ngex map velocity: ${passed}/${passed} checks passed`);
