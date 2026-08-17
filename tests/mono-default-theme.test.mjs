import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const themeSource = await readFile(new URL("../src/lib/theme.ts", import.meta.url), "utf8");
const chartSource = await readFile(new URL("../src/lib/chartSettings.ts", import.meta.url), "utf8");

test("fresh accounts and reset state use Mono Protocol", () => {
  assert.match(themeSource, /background: "#000000"/);
  assert.match(themeSource, /primary: "#FFFFFF"/);
  assert.match(themeSource, /panel: "#080808"/);
  assert.match(themeSource, /candleUp: "#FFFFFF"/);
  assert.match(themeSource, /candleDown: "#737373"/);
  assert.match(themeSource, /export function resetTheme\(\)[\s\S]*?applyTheme\(defaultTheme\)/);
});

test("new theme-linked charts inherit the Mono Protocol candle palette", () => {
  assert.match(chartSource, /themeLinked: true/);
  assert.match(chartSource, /upColor: "#FFFFFF"/);
  assert.match(chartSource, /downColor: "#737373"/);
  assert.match(chartSource, /backgroundColor: "#000000"/);
  assert.match(chartSource, /gridColor: "#1F1F1F"/);
});
