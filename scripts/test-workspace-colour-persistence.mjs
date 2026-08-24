import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linkPaneIndicatorStateToTheme } from "../src/lib/chartIndicatorConfig.ts";

/**
 * A colour somebody chose survives.
 *
 * Two separate paths used to destroy it, and neither said anything: restoring
 * a saved workspace relinked every indicator to the ACTIVE theme, and choosing
 * a theme overrode every indicator's colours whether or not they had been set
 * deliberately. An afternoon spent colouring CVD, candles, big trades, IB
 * levels, the footprint and the profiles came back as theme colours.
 *
 * `useThemeColors: false` is only ever written when somebody picks a colour,
 * so it is the record of a deliberate choice and nothing may overwrite it.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const instance = (id, settings) => ({
  instanceId: `${id}-1`, indicatorId: id, enabled: true, settings,
});
const state = (...instances) => ({ "pane-1": instances });

check("an indicator with chosen colours is left alone by a theme change", () => {
  const chosen = instance("cumulative-volume-delta", {
    useThemeColors: false, bullishColor: "#ABCDEF", bearishColor: "#123456",
  });
  const linked = linkPaneIndicatorStateToTheme(state(chosen))["pane-1"][0];
  assert.equal(linked.settings.useThemeColors, false, "the choice must survive");
  assert.equal(linked.settings.bullishColor, "#ABCDEF");
  assert.equal(linked.settings.bearishColor, "#123456");
});

check("an indicator still following the theme is relinked", () => {
  const following = instance("volume", { useThemeColors: true });
  const linked = linkPaneIndicatorStateToTheme(state(following))["pane-1"][0];
  assert.equal(linked.settings.useThemeColors, true);
});

check("an indicator that never said either way follows the theme", () => {
  const silent = instance("volume", {});
  const linked = linkPaneIndicatorStateToTheme(state(silent))["pane-1"][0];
  assert.equal(linked.settings.useThemeColors, true, "absent means follow the theme");
});

check("every study is protected, not a hand-picked few", () => {
  // The old code exempted only bounce-levels; the trader had coloured a dozen.
  const ids = [
    "cumulative-volume-delta", "volume", "big-trades", "big-blocks",
    "ib-levels", "deep-print-footprint", "kwant-profile", "tpo-chart",
  ];
  const chosen = ids.map((id) => instance(id, { useThemeColors: false, plotColor: "#AA00AA" }));
  const linked = linkPaneIndicatorStateToTheme(state(...chosen))["pane-1"];
  for (const entry of linked) {
    assert.equal(
      entry.settings.useThemeColors, false,
      `${entry.indicatorId} lost its colours to a theme change`,
    );
    assert.equal(entry.settings.plotColor, "#AA00AA");
  }
});

check("other panes are carried through untouched", () => {
  const both = {
    "pane-1": [instance("volume", { useThemeColors: false, plotColor: "#111111" })],
    "pane-2": [instance("volume", { useThemeColors: true })],
  };
  const linked = linkPaneIndicatorStateToTheme(both);
  assert.equal(linked["pane-1"][0].settings.plotColor, "#111111");
  assert.equal(linked["pane-2"][0].settings.useThemeColors, true);
});

check("restoring a saved workspace does not relink to the theme", () => {
  // The reported failure: the workspace carries its own colours and its own
  // theme, so passing it through the relink hands back the theme's instead.
  const source = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(
    source,
    /setPaneIndicators\(linkPaneIndicatorStateToTheme\(clonePaneIndicatorState\(preset\.indicators\)\)\)/,
    "applying a preset must restore its indicators exactly as saved",
  );
  assert.match(
    source,
    /setPaneIndicators\(clonePaneIndicatorState\(preset\.indicators\)\)/,
    "the preset's own indicator state is what gets restored",
  );
});

check("the relink is still wired to an actual theme change", () => {
  // Removing it entirely would leave theme switching with no effect on
  // indicators that do follow the theme.
  const source = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(source, /kwantdesk:theme-change/);
  assert.match(source, /linkPaneIndicatorStateToTheme\(current\)/);
});

console.log(`\nworkspace colour persistence: ${passed}/${passed} checks passed`);
