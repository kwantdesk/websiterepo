import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { defaultIndicatorSettings } = await import("../src/lib/chartIndicatorConfig.ts");

const primitive = readFileSync(new URL("../src/lib/bigTradesPrimitive.ts", import.meta.url), "utf8");
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const control = readFileSync(
  new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8",
);

/**
 * A big print leaves a level, and a session pick behaves like a pick.
 *
 * Two things read out of DeepChart's own assembly: their Big Trades study
 * (`Deepchart.Evaluation.EvaluatorCompiler`) carries MinFilterTrade plus a
 * projection that extends TillCloseCross - it does not merely mark the print,
 * it leaves a level that stays until price closes through it. Ours drew a
 * circle and nothing else; our filtering is richer than theirs, the level was
 * the gap.
 *
 * Separately, the volume profile's session buttons decided "has the trader
 * picked yet" by asking whether all four sessions were still enabled. That is
 * true again the moment you build a selection back up to all four, so the next
 * click isolated instead of removing and a lit session could not be switched
 * off.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the level is off by default", () => {
  // An existing workspace must open looking exactly as it was left.
  const defaults = defaultIndicatorSettings("big-trades");
  assert.equal(defaults.showProjection, false);
  assert.equal(defaults.projectionLineStyle, "dashed");
  assert.equal(defaults.projectionOpacity, 55);
});

check("a marker carries where its level stops", () => {
  assert.match(primitive, /projectionEndTime\?: Time \| null;/);
  assert.match(primitive, /showProjection: boolean;/);
});

check("an unresolved level runs to the right edge", () => {
  /*
   * Nothing has closed through it, so it is still live. Stopping it at the
   * print would be drawing a level that had been resolved when it had not.
   */
  assert.match(
    primitive,
    /const endX = marker\.projectionEndTime == null\s*\n\s*\? mediaSize\.width/,
    "an unresolved level no longer extends to the edge",
  );
});

check("levels are drawn under the markers", () => {
  // A line painted over the print that created it hides the thing being marked.
  const levelPass = primitive.indexOf("if (options.showProjection) {");
  const markerPass = primitive.indexOf("// Resolve both coordinates inside the Lightweight Charts draw pass.");
  assert.ok(levelPass > 0 && markerPass > levelPass, "the level pass no longer precedes the markers");
});

check("a close through the level ends it, a wick does not", () => {
  /*
   * The DeepChart behaviour is ExtendTillCloseCross. Testing consecutive
   * CLOSES either side of the price is what makes a wick through it
   * insufficient.
   */
  assert.match(
    chart,
    /if \(\(previous - print\.price\) \* \(close - print\.price\) < 0\) \{/,
    "the level no longer ends on a close crossing it",
  );
  assert.ok(!/high >= print\.price/.test(chart), "the level ends on a wick again");
});

check("the forward scan is bounded", () => {
  // It runs per print over the candles; unbounded it would be a main-thread
  // cost that grows with the session.
  assert.match(chart, /const MAX_FORWARD_BARS = 600;/);
  assert.match(chart, /Math\.min\(bars\.length, low \+ MAX_FORWARD_BARS\)/);
});

check("nothing is computed while the level is switched off", () => {
  assert.match(
    chart,
    /if \(bigTradesIndicator\?\.settings\?\.showProjection !== true\) return ends;/,
    "the scan runs even when the level is off",
  );
});

check("a session pick is recorded, not inferred", () => {
  /*
   * The reported bug: with all four lit, clicking one isolated it instead of
   * removing it, so a session could never be switched back off.
   */
  assert.match(
    control,
    /const nothingPickedYet = settings\.sessionSelectionArmed !== true;/,
    "whether the trader has picked is inferred from the flags again",
  );
  assert.ok(
    !/const nothingPickedYet = DESK_SESSION_SETTING_KEYS\s*\n\s*\.every\(/.test(control),
    "the all-four-still-on inference is back",
  );
  assert.match(control, /settings\.sessionSelectionArmed = true;/, "the first pick does not arm the selection");
  assert.match(control, /settings\.sessionSelectionArmed = false;/, "clearing the selection does not disarm it");
});

check("an emptied selection still falls back to the whole day", () => {
  // Removing the last session must not draw nothing at all.
  assert.match(control, /settings\.filterMode = "none";/);
  assert.match(control, /for \(const sessionKey of DESK_SESSION_SETTING_KEYS\) settings\[sessionKey\] = true;/);
});

console.log(`\nbig trade levels: ${passed}/${passed} checks passed`);
