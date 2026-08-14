import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chartSettings = readFileSync(new URL("../src/lib/chartSettings.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

test("workspace presets cannot overwrite the active account theme colours", () => {
  for (const field of [
    "upColor",
    "downColor",
    "borderUpColor",
    "borderDownColor",
    "wickUpColor",
    "wickDownColor",
    "backgroundColor",
    "gridColor",
  ]) {
    assert.match(chartSettings, new RegExp(`"${field}"`));
  }
  assert.match(chartSettings, /merged\[field\] = active\[field\]/);
  assert.match(workspace, /mergeWorkspaceChartSettingsWithActiveTheme\([\s\S]*?preset\.chartSettings,[\s\S]*?loadStoredChartSettings\(\)/);
  assert.match(workspace, /saveStoredChartSettings\(nextChartSettings\)/);
  assert.doesNotMatch(workspace, /setChartSettings\(preset\.chartSettings\)/);
  assert.doesNotMatch(workspace, /saveStoredChartSettings\(preset\.chartSettings\)/);
});
