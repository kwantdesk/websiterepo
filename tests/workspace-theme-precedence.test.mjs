import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chartSettings = readFileSync(new URL("../src/lib/chartSettings.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const backtesting = readFileSync(new URL("../src/components/backtesting/BacktestingWorkspace.tsx", import.meta.url), "utf8");
const levelz = readFileSync(new URL("../src/components/levelz/LevelzWorkspace.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/components/KwantifySettingsWorkspace.tsx", import.meta.url), "utf8");
const indicatorConfig = readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8");

test("manually customised workspace colours survive later account theme changes", () => {
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
  assert.match(chartSettings, /themeLinked: boolean/);
  assert.match(chartSettings, /if \(!merged\.themeLinked\) return merged/);
  assert.match(chartSettings, /merged\[field\] = active\[field\]/);
  assert.match(workspace, /mergeWorkspaceChartSettingsWithActiveTheme\([\s\S]*?preset\.chartSettings,[\s\S]*?loadStoredChartSettings\(\)/);
  assert.match(workspace, /CHART_WORKSPACE_SETTINGS_STORAGE_KEY = "kwantdesk:chart-workspace-settings:v1"/);
  assert.match(workspace, /themeLinked: false, \[colorPicker\]: normalized/);
  assert.doesNotMatch(workspace, /setChartSettings\(preset\.chartSettings\)/);
  assert.doesNotMatch(workspace, /saveStoredChartSettings\(preset\.chartSettings\)/);
});

test("chart colour templates are shared by Charts and GEX Vue", () => {
  assert.match(workspace, /localStorage\.getItem\(CHART_TEMPLATES_STORAGE_KEY\)/);
  assert.match(workspace, /localStorage\.setItem\(\s*CHART_TEMPLATES_STORAGE_KEY,[\s\S]{0,120}JSON\.stringify\(nextTemplates\)/);
  assert.match(workspace, /savedSettings = normalizeChartSettings\(\{ \.\.\.draftChartSettings, themeLinked: false \}\)/);
  assert.match(workspace, /Link colours to website theme/);
});

test("theme changes repaint every mounted chart surface immediately", () => {
  assert.match(chartSettings, /CHART_SETTINGS_CHANGE_EVENT = "kwantdesk:chart-settings-change"/);
  assert.match(chartSettings, /new CustomEvent<ChartSettings>\(CHART_SETTINGS_CHANGE_EVENT/);
  assert.match(chartSettings, /function applyActiveThemeToWorkspaceChartSettings/);
  assert.match(chartSettings, /merged\.themeLinked = true/);
  assert.match(workspace, /applyActiveThemeToWorkspaceChartSettings\(current, activeThemeSettings\)/);
  assert.match(workspace, /addEventListener\(CHART_SETTINGS_CHANGE_EVENT, syncChartPalette\)/);
  assert.match(backtesting, /addEventListener\(CHART_SETTINGS_CHANGE_EVENT, syncSettings\)/);
  assert.match(levelz, /addEventListener\(CHART_SETTINGS_CHANGE_EVENT, syncSettings\)/);
  assert.match(workspace, /event\.key === CHART_SETTINGS_STORAGE_KEY/);
});

test("account themes override linked indicators and theme-linked chart colours", () => {
  assert.match(settings, /key === "background"[\s\S]*?backgroundColor: color/);
  assert.match(settings, /key === "primary"[\s\S]*?upColor: color/);
  assert.match(settings, /key === "danger"[\s\S]*?downColor: color/);
  assert.match(settings, /linkStoredPaneIndicatorsToTheme\(\)/);
  assert.match(indicatorConfig, /linkPaneIndicatorStateToTheme/);
  assert.match(indicatorConfig, /useThemeColors: true/);
  assert.match(workspace, /addEventListener\("kwantdesk:theme-change", relinkIndicators\)/);
  assert.match(settings, /themeLinked: true,[\s\S]*?backgroundColor: color/);
  assert.match(settings, /const next = \{ \.\.\.current, themeLinked: true, \[key\]: color \}/);
});

test("legacy chart migration never overwrites the selected account palette", () => {
  const migration = workspace.match(/const migrationKey = "kwantdesk:midnight-cockpit-chart:v1";[\s\S]*?\}, \[authChecked\]\);/)?.[0] ?? "";
  assert.match(migration, /localStorage\.setItem\(migrationKey, "applied"\)/);
  assert.doesNotMatch(migration, /upColor:/);
  assert.doesNotMatch(migration, /setChartSettings\(/);
});
