import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import test from "node:test";

import {
  contrastRatio,
  legibleSemanticColor,
  parseResolvedColor,
  readableTextOn,
} from "../src/lib/readableContrast.ts";
import { themePresets } from "../src/lib/themePresets.ts";

const globals = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const theme = readFileSync(new URL("../src/lib/theme.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

function ratio(foreground, background) {
  const fg = parseResolvedColor(foreground);
  const bg = parseResolvedColor(background);
  assert.ok(fg && bg, `expected resolvable colours: ${foreground} / ${background}`);
  return contrastRatio(fg, bg);
}

test("every theme derives readable text for solid primary and danger actions", () => {
  for (const preset of themePresets) {
    for (const role of ["primary", "danger"]) {
      const fill = preset.colors[role];
      const text = readableTextOn(fill);
      assert.ok(
        ratio(text, fill) >= 4.5,
        `${preset.name} ${role} action must meet WCAG AA text contrast`,
      );
    }
  }
});

test("Chromey Mono hollow candles cannot erase the Sell action", () => {
  const chromey = themePresets.find((preset) => preset.name === "Chromey Mono");
  assert.ok(chromey);
  const sell = legibleSemanticColor(
    chromey.colors.candleDown,
    chromey.colors.danger,
    chromey.colors.panel,
  );
  assert.notEqual(sell.toLowerCase(), chromey.colors.candleDown.toLowerCase());
  assert.ok(ratio(sell, chromey.colors.panel) >= 4.5);
  assert.ok(ratio(readableTextOn(sell), sell) >= 4.5);
});

test("theme application publishes contrast tokens before the page paints", () => {
  assert.match(globals, /--color-on-primary:\s*var\(--on-primary\)/);
  assert.match(globals, /--color-on-danger:\s*var\(--on-danger\)/);
  assert.match(theme, /r\.style\.setProperty\("--on-primary",q\(t\.primary\)\)/);
  assert.match(theme, /applyContrastTokens\(root, saved\)/);
});

test("solid action fills no longer assume the page background is readable text", () => {
  const repoRoot = new URL("../", import.meta.url);
  const sourceFiles = globSync(["src/**/*.ts", "src/**/*.tsx"], { cwd: repoRoot });
  for (const file of sourceFiles) {
    const source = readFileSync(new URL(file, repoRoot), "utf8");
    assert.doesNotMatch(source, /text-background/, `${file} must use the fill's contrast token`);
  }
  assert.match(workspace, /orderTicketSellColor/);
  assert.match(workspace, /readableTextOn\(orderTicketSellColor\)/);
});
