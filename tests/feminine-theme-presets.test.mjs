import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const settingsPath = new URL("../src/lib/themePresets.ts", import.meta.url);

test("theme catalogue keeps three originals and adds forty distinct palettes", async () => {
  const source = await readFile(settingsPath, "utf8");
  const names = [...source.matchAll(/palette\("([^"]+)"/g)].map((match) => match[1]);

  assert.equal(names.length, 43);
  assert.equal(new Set(names).size, 43);
  assert.deepEqual(names.slice(0, 3), ["Midnight Cockpit", "Kwant Desk", "Mr. Quant"]);

  for (const name of ["Playdough Parade", "Tangerine Terminal", "Creamsicle OS", "Paper & Ink", "Mono Protocol", "Inverted Mono"]) {
    assert.ok(names.includes(name), `${name} should be selectable`);
  }

  for (const retired of ["Kwant Gold", "Onyx Gold", "Carbon Blue", "Blush Pearl", "Midnight Petal"]) {
    assert.ok(!names.includes(retired), `${retired} should be removed from the reshuffled catalogue`);
  }

  const newThemeSource = source.slice(source.indexOf('palette("Solar Flare"'));
  const signatures = [...newThemeSource.matchAll(/palette\("[^"]+", \{[^\n]*?background: "([^"]+)"[^\n]*?primary: "([^"]+)"[^\n]*?secondary: "([^"]+)"/g)]
    .map((match) => `${match[1]}:${match[2]}:${match[3]}`);
  assert.equal(signatures.length, 40);
  assert.equal(new Set(signatures).size, 40);
});
