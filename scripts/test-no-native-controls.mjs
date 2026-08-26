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
 * otherwise consistent interface, and they sit in the places a trader uses
 * most: chart settings, panel settings, the trade panel, the accounts page.
 *
 * Both replacements already existed — components/ui/KwantSelect and
 * ChartColorField. The work was simply never finished.
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
  // Comments legitimately talk ABOUT native selects — this test's own
  // replacement documents why they are bad — so count code only.
  const source = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const selects = (source.match(/<select[\s>]/g) ?? []).length;
  if (selects) nativeSelects.push({ file: file.slice(file.indexOf("src")), selects });
  if (/type="color"/.test(source)) nativeColors.push(file.slice(file.indexOf("src")));
}

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("no native <select> remains anywhere", () => {
  // THE POINT. Forty-six were left across nine files, long after the shared
  // component had been written and used in a handful of places.
  assert.deepEqual(
    nativeSelects,
    [],
    "native <select> still in:\n" + nativeSelects.map((entry) => `  ${entry.selects}  ${entry.file}`).join("\n"),
  );
});

check("no native colour pickers remain", () => {
  assert.deepEqual(nativeColors, [], `native <input type="color"> in: ${nativeColors.join(", ")}`);
});

check("the shared select is a drop-in for the native one", () => {
  const select = readFileSync(join(SRC, "components", "ui", "KwantSelect.tsx"), "utf8");
  // Taking native select props and reading <option> children is what makes a
  // call site a tag swap rather than a rewrite, and what stops a conversion
  // silently changing which options a control offers.
  assert.match(select, /Omit<SelectHTMLAttributes<HTMLSelectElement>, "multiple" \| "size">/);
  assert.match(select, /function optionsFromChildren/);
  // Portaled, or a menu inside an overflow-hidden panel is clipped away.
  assert.match(select, /createPortal\(/);
});

check("there is one shared select, plus GEX Map's richer one", () => {
  // GEX Map's own menu carries a detail line under each option, which
  // ui/KwantSelect has no place for. It stays, and stays the only exception —
  // a third would put the product back to guessing which one is live, the same
  // trap as the three drawing toolbars.
  const map = readFileSync(join(SRC, "components", "gex-map", "GexMapWorkspace.tsx"), "utf8");
  assert.match(map, /export function GexMapDropdown<T extends string>/);
  const components = files.filter((file) => /KwantSelect\.tsx$/.test(file));
  assert.deepEqual(
    components.map((file) => file.slice(file.indexOf("src"))),
    [join("src", "components", "ui", "KwantSelect.tsx")],
    "there must be exactly one KwantSelect component",
  );
});

check("the drawing settings dialog uses both", () => {
  const settings = readFileSync(join(SRC, "components", "ChartDrawSettings.tsx"), "utf8");
  assert.match(settings, /<KwantSelect/);
  assert.match(settings, /<ChartColorField/);
  assert.match(settings, /from "@\/components\/ui\/KwantSelect"/);
});

console.log(`\nno native controls: ${passed}/${passed} checks passed`);
