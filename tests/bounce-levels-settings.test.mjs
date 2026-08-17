import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controls = readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const config = readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8");

test("GEX Bounce colour controls reflect the active theme and create a custom override on edit", () => {
  assert.match(controls, /const bounceThemeColours = \(chartSettings: ChartSettings\)/);
  assert.match(controls, /settingsDefinition\.id === "bounce-levels" && settingsInstance\.settings\?\.useThemeColors !== false/);
  assert.match(controls, /\? bounceThemeColours\(chartSettings\)/);
  assert.match(controls, /settingsDefinition\.id === "bounce-levels" \? \{ useThemeColors: false \} : \{\}/);
});

test("rapid GEX Bounce slider input composes against the latest indicator state", () => {
  assert.match(controls, /const indicatorsRef = useRef\(indicators\)/);
  assert.match(controls, /const next = indicatorsRef\.current\.map/);
  assert.match(controls, /indicatorsRef\.current = next/);
});

test("GEX Bounce role toggles filter the exposure field that is actually painted", () => {
  assert.match(chart, /const roleVisibility: Record<string, boolean> =/);
  assert.match(chart, /filterBounceLevelsSnapshot\(/);
  assert.match(chart, /bounceLevelsSnapshot,/);
  assert.match(chart, /roleVisibility,/);
});

test("saved custom GEX Bounce colours survive workspace theme relinking", () => {
  assert.match(config, /const preserveBounceOverride = instance\.indicatorId === "bounce-levels"/);
  assert.match(config, /useThemeColors: preserveBounceOverride \? false : true/);
  assert.match(config, /bounceLevelsSettingsVersion: 4/);
});

test("Bounce Levels exposes every data-shaping dropdown above the settings dialog", () => {
  const select = readFileSync(new URL("../src/components/ui/KwantSelect.tsx", import.meta.url), "utf8");
  assert.match(select, /z-\[12000\]/, "select menus must render above the indicator settings dialog");
  assert.match(controls, /\["Options source", "sourceTicker", "AUTO"/);
  assert.match(controls, /\["Exposure Greek", "greekMode", "GAMMA"/);
  assert.match(controls, /\["Expiration window", "expirationMode", "zero-to-one-dte"/);
  assert.match(controls, /\["Exposure sizing", "visualStrengthBasis", "percent-of-king"/);
  assert.match(controls, /menuLabel="Contract universe"/);
  assert.match(controls, /includeWeeklies: universe === "all-contracts" \|\| universe === "weeklies-only"/);
  assert.match(chart, /visualStrengthBasis: String\(indicatorSettings\.visualStrengthBasis\)/);
  assert.match(config, /visualStrengthBasis: \["absolute-exposure", "percent-of-king", "hybrid"\]/);
});
