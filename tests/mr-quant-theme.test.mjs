import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const presetPath = new URL("../src/lib/themePresets.ts", import.meta.url);
const settingsPath = new URL("../src/components/KwantifySettingsWorkspace.tsx", import.meta.url);

test("Mr. Quant is a selectable full app and chart theme", async () => {
  const presets = await readFile(presetPath, "utf8");
  const source = await readFile(settingsPath, "utf8");

  assert.match(presets, /palette\("Mr\. Quant"/);
  assert.match(presets, /palette\("Mr\. Quant"[\s\S]*?background: "#000000"/);
  assert.match(presets, /palette\("Mr\. Quant"[\s\S]*?panel: "#050914"/);
  assert.match(presets, /palette\("Mr\. Quant"[\s\S]*?primary: "#47B7FF"/);
  assert.match(presets, /palette\("Mr\. Quant"[\s\S]*?foreground: "#F7FAFF"/);
  assert.match(presets, /palette\("Mr\. Quant"[\s\S]*?candleUp: "#47B7FF"/);
  assert.match(presets, /palette\("Mr\. Quant"[\s\S]*?candleDown: "#F7FAFF"/);
  assert.match(source, /import \{ themePresets \} from "@\/lib\/themePresets"/);
  assert.match(source, /themePresets\.map\(\(preset\)/);
  assert.match(source, /onClick=\{\(\) => applyThemePreset\(preset\.colors\)\}/);
});
