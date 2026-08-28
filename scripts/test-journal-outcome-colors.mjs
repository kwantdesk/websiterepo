import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { resolveOutcomeColors, isRed, isGreen, SEMANTIC_WIN, SEMANTIC_LOSS } =
  await import("../src/lib/outcomeColors.ts");
const { themePresets } = await import("../src/lib/themePresets.ts");

/**
 * The journal's win and loss colours.
 *
 * They were pinned to a fixed green and red because following the theme had
 * produced a calendar where a winning day and a losing day came out the same
 * colour. Following the theme is right; the fixed pair was a workaround for the
 * theme sometimes not offering a usable one.
 *
 * Three rules decide it, and the first is absolute: red never lands on a
 * positive. A trader reads the colour before the number, and a red profit is a
 * lie told faster than the figure can correct it.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const journal = readFileSync(
  new URL("../src/components/journal/JournalWorkspace.tsx", import.meta.url),
  "utf8",
);
const forTheme = (t) => resolveOutcomeColors({
  up: t.candleUp, upOutline: t.candleUpBorder,
  down: t.candleDown, downOutline: t.candleDownBorder,
  primary: t.primary, accent: t.accent, danger: t.danger, background: t.background,
});

check("red never lands on a positive, on any theme", () => {
  const offenders = themePresets
    .filter((preset) => isRed(forTheme(preset.colors).win))
    .map((preset) => `${preset.name} -> ${forTheme(preset.colors).win}`);
  assert.deepEqual(offenders, [], `a winning day would be red: ${offenders.join(", ")}`);
});

check("green never lands on a negative, on any theme", () => {
  const offenders = themePresets
    .filter((preset) => isGreen(forTheme(preset.colors).loss))
    .map((preset) => `${preset.name} -> ${forTheme(preset.colors).loss}`);
  assert.deepEqual(offenders, [], `a losing day would be green: ${offenders.join(", ")}`);
});

check("a win and a loss are never the same colour", () => {
  // The bug that caused the fixed pair: a calendar where both read identically.
  const clashes = themePresets.filter((preset) => {
    const { win, loss } = forTheme(preset.colors);
    return win.toLowerCase() === loss.toLowerCase();
  });
  assert.deepEqual(clashes.map((preset) => preset.name), []);
});

check("neither colour is invisible against the theme's own background", () => {
  /*
   * A theme may paint its bearish candle the colour of the chart - that is what
   * a hollow candle is - and that body cannot double as the losing colour.
   */
  for (const preset of themePresets) {
    const { win, loss } = forTheme(preset.colors);
    for (const [role, colour] of [["win", win], ["loss", loss]]) {
      assert.notEqual(
        colour.toLowerCase(),
        preset.colors.background.toLowerCase(),
        `${preset.name} ${role} is the background`,
      );
    }
  }
});

check("the theme is actually followed, not quietly replaced", () => {
  /*
   * The fallback exists for themes that cannot satisfy the rules. If it fires
   * everywhere then this is the old fixed pair wearing a resolver, which is
   * what the owner asked to be rid of.
   */
  const semantic = themePresets.filter((preset) => {
    const { win, loss } = forTheme(preset.colors);
    return win === SEMANTIC_WIN && loss === SEMANTIC_LOSS;
  });
  assert.ok(
    semantic.length <= 5,
    `${semantic.length} of ${themePresets.length} themes fall back entirely: ${semantic.map((p) => p.name).join(", ")}`,
  );
});

check("a theme with a red bullish candle still gets a non-red win", () => {
  // The rule has to hold even when the theme itself is the problem.
  const out = resolveOutcomeColors({
    up: "#FF2A2A", down: "#FF2A2A", primary: "#FF0000", accent: "#CC0000",
    danger: "#FF2A2A", background: "#000000",
  });
  assert.ok(!isRed(out.win), `win came out red: ${out.win}`);
  assert.notEqual(out.win.toLowerCase(), out.loss.toLowerCase());
});

check("the journal reads the colours instead of hardcoding them", () => {
  assert.doesNotMatch(journal, /#22C55E/i, "a hardcoded green survived");
  assert.doesNotMatch(journal, /#EF4444/i, "a hardcoded red survived");
  assert.match(journal, /--journal-win/, "the win variable is never set");
  assert.match(journal, /--journal-loss/, "the loss variable is never set");
  // And it must follow a theme change rather than only reading once at mount.
  assert.match(journal, /kwantdesk:theme-change/, "the journal ignores theme changes");
});

console.log(`\njournal outcome colours: ${passed}/${passed} checks passed`);
