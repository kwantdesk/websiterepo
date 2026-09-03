import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  chartSettingsFromChangeEvent,
  defaultChartSettings,
} = await import("../src/lib/chartSettings.ts");

const settingsWorkspace = readFileSync(
  new URL("../src/components/KwantifySettingsWorkspace.tsx", import.meta.url),
  "utf8",
);
const chartWorkspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);
const backtesting = readFileSync(
  new URL("../src/components/backtesting/BacktestingWorkspace.tsx", import.meta.url),
  "utf8",
);
const levelz = readFileSync(
  new URL("../src/components/levelz/LevelzWorkspace.tsx", import.meta.url),
  "utf8",
);
const theme = readFileSync(new URL("../src/lib/theme.ts", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
};

check("a same-tab chart event uses its new palette instead of stale storage", () => {
  const selected = {
    ...defaultChartSettings,
    upColor: "#12AB34",
    downColor: "#EF4567",
    backgroundColor: "#020406",
  };
  const resolved = chartSettingsFromChangeEvent({ detail: selected });
  assert.deepEqual(resolved, selected);
});

check("every mounted chart consumer reads the authoritative event payload", () => {
  for (const [name, source] of [
    ["charts", chartWorkspace],
    ["backtesting", backtesting],
    ["levelz", levelz],
  ]) {
    assert.match(
      source,
      /chartSettingsFromChangeEvent\(event\)/,
      `${name} still reloads the previous palette from storage`,
    );
  }
});

check("one appearance commit updates chart payload before the global theme event", () => {
  const commit = settingsWorkspace.match(
    /function commitAppearance[\s\S]*?\n  }\n\n  function commitChartPreference/,
  )?.[0] ?? "";
  assert.match(commit, /saveStoredChartSettings\(normalizedChartSettings\)/);
  assert.match(commit, /saveAppTheme\(nextTheme\)/);
  assert.ok(
    commit.indexOf("saveStoredChartSettings(normalizedChartSettings)")
      < commit.indexOf("saveAppTheme(nextTheme)"),
    "the CSS event can run before canvas charts receive the selected palette",
  );
  assert.match(settingsWorkspace, /function applyThemePreset[\s\S]*?commitAppearance\(theme, nextChartSettings\)/);
});

check("rapid selections derive from refs rather than a stale render closure", () => {
  assert.match(settingsWorkspace, /themeSettingsRef\.current/);
  assert.match(settingsWorkspace, /chartSettingsRef\.current/);
  assert.doesNotMatch(
    settingsWorkspace,
    /useEffect\(\(\) => \{\s*saveAppTheme\(themeSettings\)/,
    "a delayed effect can overwrite the palette selected by the next click",
  );
});

check("custom-colour surfaces are not relinked by an ordinary theme change", () => {
  assert.doesNotMatch(theme, /relinkGexMapPaletteToTheme/);
  assert.match(theme, /explicitly switched to custom colours remains custom/);
});

console.log(`\ntheme first-click sync: ${passed}/${passed} checks passed`);
