import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * No operating-system controls anywhere in the product.
 *
 * A native <select> renders the OS menu — on Windows a grey list in a system
 * font that ignores the theme completely. A native <input type="color"> opens
 * the OS colour picker. Neither can be styled, so every one is a hole in an
 * otherwise consistent interface, and they appear in exactly the places a
 * trader uses most: chart settings, panel colours, replay controls.
 *
 * The replacements already existed — ChartColorField for colour, and the
 * portaled menu GEX Map used, now shared as KwantSelect. This test keeps them
 * from coming back, and carries the remaining <select> count DOWN: the number
 * below is a ratchet, never to be raised.
 */

// fileURLToPath, not .pathname: a percent-encoded space in the path (this
// repository lives under "QUANT DESK") reaches the filesystem literally.
const SRC = fileURLToPath(new URL("../src", import.meta.url));

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(SRC);
const nativeSelects = [];
const nativeColors = [];
for (const file of files) {
  // Comments talk ABOUT native selects (this file's own replacement documents
  // why they are bad), so count code only.
  const source = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const selects = (source.match(/<select[\s>]/g) ?? []).length;
  if (selects) nativeSelects.push({ file: file.slice(file.indexOf("src")), selects });
  if (/type="color"/.test(source)) nativeColors.push(file.slice(file.indexOf("src")));
}

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("no native colour pickers remain", () => {
  assert.deepEqual(nativeColors, [], `native <input type="color"> in: ${nativeColors.join(", ")}`);
});

check("the shared controls exist and are the ones used", () => {
  const select = readFileSync(join(SRC, "components", "KwantSelect.tsx"), "utf8");
  assert.match(select, /export default function KwantSelect<T extends string>/);
  // Portaled, or a menu inside an overflow-hidden panel is clipped away.
  assert.match(select, /createPortal\(/);
  // A menu positioned against a trigger that has since moved is worse than none.
  assert.match(select, /window\.addEventListener\("scroll", closeOnViewportChange, true\)/);
  assert.match(select, /if \(event\.key === "Escape"\)/);

  // GEX Map keeps its old import name but must not own a second copy.
  const map = readFileSync(join(SRC, "components", "gex-map", "GexMapWorkspace.tsx"), "utf8");
  assert.doesNotMatch(map, /export function GexMapDropdown<T extends string>/,
    "GEX Map must re-export the shared menu, not define its own");
  assert.match(map, /from "@\/components\/KwantSelect"/);
});

check("the drawing settings dialog is fully converted", () => {
  // One helper backs every dropdown in that panel, so it converts as a unit.
  const settings = readFileSync(join(SRC, "components", "ChartDrawSettings.tsx"), "utf8");
  assert.doesNotMatch(settings, /<select[\s>]/, "the drawing settings dialog must use the shared menu");
  assert.match(settings, /<KwantSelect/);
  assert.match(settings, /<ChartColorField/);
});

check("the remaining native selects only ever go down", () => {
  // A ratchet, not a target. Lower it as surfaces are converted; never raise it.
  // Remaining, highest first: GexBoxDashboard, Chart (professional drawing
  // panel), SingleProfileWorkspace, TradingPanel, SpoofingDetector, accounts,
  // KwantifyWorkspace, IndicatorTemplateBar, ChartIndicatorsControl.
  const total = nativeSelects.reduce((sum, entry) => sum + entry.selects, 0);
  const CEILING = 46;
  assert.ok(
    total <= CEILING,
    `native <select> count rose to ${total} (ceiling ${CEILING}):\n`
      + nativeSelects.map((entry) => `  ${entry.selects}  ${entry.file}`).join("\n"),
  );
  console.log(`      ${total} native <select> left, in ${nativeSelects.length} files`);
});

console.log(`\nno native controls: ${passed}/${passed} checks passed`);
