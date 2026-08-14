import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const settingsPath = new URL("../src/components/KwantifySettingsWorkspace.tsx", import.meta.url);

test("four baby-pink themes include distinct complementary palettes", async () => {
  const source = await readFile(settingsPath, "utf8");

  for (const name of ["Blush Pearl", "Rosewater Mint", "Velvet Lavender", "Midnight Petal"]) {
    assert.match(source, new RegExp(`name: "${name}"`));
  }

  assert.match(source, /name: "Blush Pearl"[\s\S]*?primary: "#F2B6CE"[\s\S]*?secondary: "#AFC8F4"/);
  assert.match(source, /name: "Rosewater Mint"[\s\S]*?primary: "#F0B1C5"[\s\S]*?secondary: "#83CDB5"/);
  assert.match(source, /name: "Velvet Lavender"[\s\S]*?primary: "#F2B4CC"[\s\S]*?secondary: "#9D91E8"/);
  assert.match(source, /name: "Midnight Petal"[\s\S]*?primary: "#F3B5C8"[\s\S]*?secondary: "#69C5D4"/);
});
