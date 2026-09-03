import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  INDICATOR_NUMERIC_SETTINGS,
  VOLUME_PROFILE_INDICATOR_IDS,
} from "../src/lib/chartIndicatorConfig.ts";
import {
  indicatorSliderModel,
  indicatorValueFromRail,
  normalizeIndicatorNumericValue,
} from "../src/lib/indicatorNumericSlider.ts";

const source = readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
const control = readFileSync(new URL("../src/components/ui/IndicatorNumericSlider.tsx", import.meta.url), "utf8");
const profileWorkspace = readFileSync(new URL("../src/components/profile-workspaces/SingleProfileWorkspace.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("all numeric inputs and rails come from one shared control", () => {
  assert.equal((source.match(/type="number"/g) ?? []).length, 0, "a catalogue number spinner bypasses the shared control");
  assert.equal((source.match(/type="range"/g) ?? []).length, 0, "a catalogue range bypasses the shared control");
  assert.equal((profileWorkspace.match(/type="number"/g) ?? []).length, 0, "a profile workspace number spinner bypasses the shared control");
  assert.equal((profileWorkspace.match(/type="range"/g) ?? []).length, 0, "a profile workspace range bypasses the shared control");
  assert.equal((control.match(/type="number"/g) ?? []).length, 1);
  assert.equal((control.match(/type="range"/g) ?? []).length, 1);
  assert.match(source, /from "@\/components\/ui\/IndicatorNumericSlider"/);
  assert.match(profileWorkspace, /from "@\/components\/ui\/IndicatorNumericSlider"/);
  assert.match(source, /group\.map\(\(setting\)[\s\S]*?<IndicatorNumericSlider/,
    "catalogue-driven indicator settings do not use the shared slider");
});

check("every catalogue limit is finite, ordered and contains its default", () => {
  let definitions = 0;
  for (const [indicatorId, settings] of Object.entries(INDICATOR_NUMERIC_SETTINGS)) {
    for (const setting of settings) {
      definitions += 1;
      assert.ok(Number.isFinite(setting.min) && Number.isFinite(setting.max), `${indicatorId}.${setting.key} has a non-finite bound`);
      assert.ok(setting.max > setting.min, `${indicatorId}.${setting.key} has an invalid range`);
      assert.ok(setting.defaultValue >= setting.min && setting.defaultValue <= setting.max,
        `${indicatorId}.${setting.key} default is outside its rail`);
      assert.ok((setting.step ?? 1) > 0, `${indicatorId}.${setting.key} has an invalid step`);
    }
  }
  assert.ok(definitions > 300, `only ${definitions} numeric settings were audited`);
});

check("purpose-built volume profile pages also use the shared control", () => {
  for (const key of [
    "minTradeVolume", "maxTradeVolume", "autoGroupFactor", "groupTicks",
    "pvSensitivity", "pocLineWidth", "valueAreaLineWidth", "valueAreaPercent",
    "profileWidth", "previousProfileWidth", "currentProfileOffset",
    "previousProfileOffset", "numberOfProfiles", "borderWidth",
  ]) {
    assert.ok(source.includes(key), `volume profile control ${key} disappeared`);
  }
  assert.ok(VOLUME_PROFILE_INDICATOR_IDS.size >= 5, "the profile-family audit narrowed unexpectedly");
  assert.doesNotMatch(source.slice(source.indexOf("volumeProfileTab === \"data\"")), /type="number"/,
    "a profile tab reintroduced native spinner UI");
  assert.ok((profileWorkspace.match(/<IndicatorNumericSlider/g) ?? []).length >= 9,
    "the standalone Volume/TPO workspaces do not use the shared control throughout");
});

check("ordinary rails preserve exact minimum, maximum and step", () => {
  const minimum = indicatorSliderModel(0, 0, 100, 1);
  const maximum = indicatorSliderModel(100, 0, 100, 1);
  assert.equal(minimum.fillPercent, 0);
  assert.equal(maximum.fillPercent, 100);
  assert.equal(indicatorValueFromRail(37, maximum), 37);
  assert.equal(normalizeIndicatorNumericValue(6.24, 1, 0.5, 6, 0.5), 6);
  assert.equal(normalizeIndicatorNumericValue(-500, 1, 0, 100, 1), 0);
  assert.equal(normalizeIndicatorNumericValue(500, 1, 0, 100, 1), 100);
});

check("large institutional thresholds remain adjustable instead of collapsing", () => {
  const model = indicatorSliderModel(1_000_000, 0, 100_000_000_000, 1_000_000);
  assert.equal(model.logarithmic, true);
  assert.equal(indicatorValueFromRail(model.railMin, model), 0);
  assert.equal(indicatorValueFromRail(model.railMax, model), 100_000_000_000);
  const quarter = indicatorValueFromRail(250, model);
  const half = indicatorValueFromRail(500, model);
  const threeQuarter = indicatorValueFromRail(750, model);
  assert.ok(quarter < half && half < threeQuarter, "the logarithmic rail is not monotonic");
  assert.ok(quarter > 0 && threeQuarter < model.max, "the logarithmic rail lost its usable interior");
});

check("large signed thresholds retain precise control around zero", () => {
  const model = indicatorSliderModel(0, -1_000_000, 1_000_000, 1);
  assert.equal(model.symmetricLogarithmic, true);
  assert.equal(model.railValue, 500);
  assert.equal(indicatorValueFromRail(model.railMin, model), -1_000_000);
  assert.equal(indicatorValueFromRail(500, model), 0);
  assert.equal(indicatorValueFromRail(model.railMax, model), 1_000_000);
  assert.ok(indicatorValueFromRail(400, model) < 0);
  assert.ok(indicatorValueFromRail(600, model) > 0);
});

check("typed editing is explicit and spinner arrows are removed", () => {
  assert.match(control, /onDoubleClick=\{\(event\) => event\.currentTarget\.select\(\)\}/);
  assert.match(control, /onBlur=\{commitDraft\}/);
  assert.match(control, /if \(event\.key === "Enter"\) event\.currentTarget\.blur\(\)/);
  assert.match(css, /\.kwant-indicator-number::-webkit-inner-spin-button/);
  assert.match(css, /-moz-appearance: textfield/);
});

check("the rail has a theme-native track, fill, thumb and keyboard focus", () => {
  assert.match(css, /\.kwant-indicator-slider::-webkit-slider-runnable-track/);
  assert.match(css, /var\(--kwant-slider-fill\)/);
  assert.match(css, /\.kwant-indicator-slider::-webkit-slider-thumb/);
  assert.match(css, /\.kwant-indicator-slider::-moz-range-progress/);
  assert.match(css, /\.kwant-indicator-slider:focus-visible::-webkit-slider-thumb/);
  assert.match(css, /var\(--primary\)/);
});

check("disabled settings disable both typed and slider interaction", () => {
  assert.equal((control.match(/disabled=\{disabled\}/g) ?? []).length, 2);
});

console.log(`\nindicator numeric sliders: ${passed}/${passed} checks passed`);
