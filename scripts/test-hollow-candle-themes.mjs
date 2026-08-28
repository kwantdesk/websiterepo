import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { themePresets } = await import("../src/lib/themePresets.ts");
const { defaultTheme } = await import("../src/lib/theme.ts");

/**
 * A theme can describe a hollow candle.
 *
 * It could only ever say one colour per side, and that colour was applied to
 * the body, the border and the wick alike - so "green up, black body with a
 * light grey outline down", which is how most terminals draw a bearish bar,
 * could not be expressed at all.
 *
 * The outline defaults to its own side's body, so every palette written before
 * this keeps drawing exactly what it drew.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const byName = new Map(themePresets.map((preset) => [preset.name, preset.colors]));

check("the theme carries an outline as well as a body", () => {
  assert.ok("candleUpBorder" in defaultTheme, "there is no up outline");
  assert.ok("candleDownBorder" in defaultTheme, "there is no down outline");
  // The default theme is not hollow; its outline matches its body.
  assert.equal(defaultTheme.candleUpBorder, defaultTheme.candleUp);
  assert.equal(defaultTheme.candleDownBorder, defaultTheme.candleDown);
});

check("Chromey Mono draws a green bull and a hollow bear", () => {
  const t = byName.get("Chromey Mono");
  assert.ok(t, "Chromey Mono is missing");
  assert.equal(t.candleUp, "#00FF00", "bullish is not the green");
  assert.equal(t.candleUpBorder, t.candleUp, "a solid bull must be outlined in its own colour");
  // Hollow: the body is the chart, the outline is not.
  assert.equal(t.candleDown, t.chartBackground, "the bearish body is not the chart background");
  assert.notEqual(t.candleDownBorder.toLowerCase(), t.candleDown.toLowerCase(), "the bear has no outline to see");
  assert.match(t.candleDownBorder, /^#[0-9A-Fa-f]{6}$/);
});

check("the red belongs to the levels, not the candles", () => {
  /*
   * The first cut of this theme painted bearish candles red, which was an
   * invention - in the terminal it was matched from, the red is the horizontal
   * level bars and the down candles are hollow.
   */
  const t = byName.get("Chromey Mono");
  assert.equal(t.danger, "#C11414", "the level red moved");
  assert.notEqual(t.candleDown, t.danger, "the bearish candle is painted the level red again");
  assert.notEqual(t.candleDownBorder, t.danger, "the bearish outline is painted the level red");
});

check("no other theme changed when outlines were added", () => {
  // The outline defaults to the body, so every pre-existing palette must still
  // have them equal. Anything else means a theme silently changed appearance.
  const changed = themePresets.filter((preset) => preset.name !== "Chromey Mono"
    && (preset.colors.candleUpBorder !== preset.colors.candleUp
      || preset.colors.candleDownBorder !== preset.colors.candleDown));
  assert.deepEqual(changed.map((preset) => preset.name), [], "themes changed appearance");
});

check("applying a theme sends the outline to the border AND the wick", () => {
  /*
   * On a hollow candle a wick drawn in the body colour is a wick drawn in the
   * background - the bar loses its high and low entirely.
   */
  const workspace = readFileSync(
    new URL("../src/components/KwantifySettingsWorkspace.tsx", import.meta.url),
    "utf8",
  );
  for (const field of ["borderUpColor", "wickUpColor"]) {
    assert.match(workspace, new RegExp(`${field}: theme\\.candleUpBorder \\?\\? theme\\.candleUp`), `${field} ignores the outline`);
  }
  for (const field of ["borderDownColor", "wickDownColor"]) {
    assert.match(workspace, new RegExp(`${field}: theme\\.candleDownBorder \\?\\? theme\\.candleDown`), `${field} ignores the outline`);
  }
});

console.log(`\nhollow candle themes: ${passed}/${passed} checks passed`);
