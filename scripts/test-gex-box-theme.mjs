import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_GEX_BOX_PALETTE_ID,
  GEX_BOX_PALETTE_IDS,
  gexBoxPanelColors,
  gexBoxThemeVariables,
  resolveGexBoxRoles,
} from "../src/lib/gexBoxTheme.ts";
import { GEX_MAP_PALETTE_PRESETS } from "../src/lib/gexMapPalette.ts";

/**
 * A workspace palette assigns colour by ROLE.
 *
 * A page can hold eighteen panels. If a call is one colour on net flow and
 * another on exposure by expiration, the surface is actively misleading — so
 * the checks that matter are that a role resolves to one colour for the whole
 * workspace, and that headers and strike labels stay readable whatever the
 * scheme does.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const HEX = /^#[0-9a-f]{6}$/i;

const relativeLuminance = (hex) => {
  const int = Number.parseInt(hex.slice(1), 16);
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((int >> 16) & 255)
    + 0.7152 * channel((int >> 8) & 255)
    + 0.0722 * channel(int & 255);
};
// The desk's panel background.
const PANEL_LUMINANCE = relativeLuminance("#12151a");
const contrast = (hex) => {
  const light = Math.max(relativeLuminance(hex), PANEL_LUMINANCE);
  const dark = Math.min(relativeLuminance(hex), PANEL_LUMINANCE);
  return (light + 0.05) / (dark + 0.05);
};

check("the palettes are the GEX Map's, not a second set", () => {
  assert.equal(
    GEX_BOX_PALETTE_IDS.length, GEX_MAP_PALETTE_PRESETS.length,
    "a second list would drift from the map's the moment either gained a scheme",
  );
  assert.ok(GEX_BOX_PALETTE_IDS.length >= 30, `expected the full set, got ${GEX_BOX_PALETTE_IDS.length}`);
});

check("every palette resolves a complete set of roles", () => {
  for (const id of GEX_BOX_PALETTE_IDS) {
    const roles = resolveGexBoxRoles(id);
    for (const role of ["call", "callSoft", "put", "putSoft", "net", "strike", "header"]) {
      assert.match(roles[role], HEX, `${id}.${role} is not a colour`);
    }
    assert.ok(roles.scale.length >= 4, `${id} has too short a scale`);
    for (const stop of roles.scale) assert.match(stop, HEX, `${id} scale stop is not a colour`);
  }
});

check("calls and puts are never the same colour", () => {
  for (const id of GEX_BOX_PALETTE_IDS) {
    const roles = resolveGexBoxRoles(id);
    assert.notEqual(
      roles.call.toLowerCase(), roles.put.toLowerCase(),
      `${id} gives calls and puts one colour, which makes the surface unreadable`,
    );
  }
});

check("headers and strike labels stay legible on every palette", () => {
  // A scheme whose every tone is dark would otherwise render its own column
  // headings invisible.
  const failures = [];
  for (const id of GEX_BOX_PALETTE_IDS) {
    const roles = resolveGexBoxRoles(id);
    for (const role of ["header", "strike"]) {
      const ratio = contrast(roles[role]);
      if (ratio < 3) failures.push(`${id}.${role} contrast ${ratio.toFixed(2)}`);
    }
  }
  assert.deepEqual(failures, [], `unreadable chrome: ${failures.join(", ")}`);
});

check("a palette gives every panel the same call and put", () => {
  const roles = resolveGexBoxRoles("viridis");
  const first = gexBoxPanelColors(roles);
  const second = gexBoxPanelColors(resolveGexBoxRoles("viridis"));
  assert.deepEqual(first, second, "the same palette must resolve identically every time");
  assert.equal(first.color, roles.call);
  assert.equal(first.negativeColor, roles.put);
});

check("an unknown or missing palette falls back rather than throwing", () => {
  for (const id of [undefined, "", "not-a-palette"]) {
    const roles = resolveGexBoxRoles(id);
    assert.equal(roles.id, DEFAULT_GEX_BOX_PALETTE_ID, `"${String(id)}" must fall back`);
  }
});

check("the variables cover every role a panel can ask for", () => {
  const vars = gexBoxThemeVariables(resolveGexBoxRoles("viridis"));
  for (const name of ["--gexbox-call", "--gexbox-put", "--gexbox-strike", "--gexbox-header", "--gexbox-net"]) {
    assert.ok(vars[name], `${name} is missing`);
  }
});

check("the dashboard applies a palette to every panel on every page", () => {
  const source = readFileSync(new URL("../src/components/gexbot/GexBoxDashboard.tsx", import.meta.url), "utf8");
  assert.match(source, /function GexBoxStyleSettings/, "the style dialog must exist");
  assert.match(source, /setShowStyle\(true\)/, "a Settings button must open it");
  assert.match(source, /pages: current\.pages\.map\(\(page\) => \(\{[\s\S]{0,200}panels: page\.panels\.map/,
    "applying must reach every panel on every page, not just the active one");
  assert.match(source, /data-gexbox-themed/, "chrome follows the palette through variables");
});

check("the css that themes chrome is scoped to the dashboard", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\[data-gexbox-themed\] th:not\(\[data-gexbox-role\]\)/, "headers follow the palette");
  assert.match(css, /\[data-gexbox-themed\] \[data-gexbox-role="strike"\]/, "strike labels follow the palette");
  assert.doesNotMatch(css, /\[data-gexbox-themed\][^{]*!important/, "no !important should be needed here");
});

console.log(`\ngex box theme: ${passed}/${passed} checks passed (${GEX_BOX_PALETTE_IDS.length} palettes)`);
