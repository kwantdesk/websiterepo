import assert from "node:assert/strict";
import test from "node:test";
import {themePresets, KEPT_THEME_NAMES} from "../src/lib/themePresets.ts";

const expected = [
  "Midnight Cockpit", "Kwant Desk", "Mr. Quant", "Retro Terminal", "Inverted Mono",
  "Mono Protocol", "Paper & Ink", "Bubblegum Blueprint", "Sakura Slate", "Vermilion Sky",
  "Cherry Soda", "Orchid Voltage", "Matcha Plum", "Electric Lemon", "Tidepool Glass",
  "Cobalt Clay", "Playdough Parade",
];
test("theme picker contains exactly the owner's seventeen approved presets in request order", () => {
  assert.deepEqual(themePresets.map(p=>p.name), expected);
  assert.deepEqual([...KEPT_THEME_NAMES], expected);
  assert.equal(new Set(themePresets.map(p=>p.name)).size,17);
});
test("unlisted generated and previous presets cannot reappear in the catalogue", () => {
  for(const name of ["Chromey Mono","Velvet Voltage","Solar Flare","Pink → Blue","Red → Lime","Forest Fire"])
    assert.ok(!themePresets.some(p=>p.name===name),name);
});
