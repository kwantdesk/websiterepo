import assert from "node:assert/strict";
import test from "node:test";
import { saveTheme, resetTheme, defaultTheme } from "../src/lib/theme.ts";
import { themePresets } from "../src/lib/themePresets.ts";
import { CHART_SETTINGS_CHANGE_EVENT, CHART_SETTINGS_STORAGE_KEY, defaultChartSettings, chartSettingsForTheme, mergeChartSettingsIntoTheme } from "../src/lib/chartSettings.ts";
import { resolveCandleSeriesColors } from "../src/lib/candleStyle.ts";
import { hydrateUserPreferences, saveUserPreferences, receiveAccountPreferences, readScopedPreferences } from "../src/lib/userPreferences.ts";

const runtimeKeys = ["kwantdesk:chart-workspace-settings:v1", "kwantdesk:gamma-charting:kwantdesk:chart-workspace-settings:v1"];
function browser() {
  const store = new Map();
  const events = [];
  const localStorage = {
    get length() { return store.size; }, key: (i) => [...store.keys()][i] ?? null,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)), removeItem: (key) => store.delete(key),
  };
  const css = new Map();
  const target = new EventTarget();
  target.localStorage = localStorage;
  target.requestAnimationFrame = (callback) => { callback(); return 1; };
  target.addEventListener(CHART_SETTINGS_CHANGE_EVENT, (event) => events.push({ type: event.type, detail: event.detail }));
  target.addEventListener("kwantdesk:theme-change", (event) => events.push({ type: event.type, detail: event.detail }));
  globalThis.window = target;
  globalThis.localStorage = localStorage;
  globalThis.document = { documentElement: { style: { setProperty: (key, value) => css.set(key, value) }, dataset: {} }, querySelector: () => null };
  return { store, events, css };
}

test("every preset updates mounted chart listeners and both inactive runtimes before the CSS event", () => {
  const { store, events, css } = browser();
  store.set(CHART_SETTINGS_STORAGE_KEY, JSON.stringify({ ...defaultChartSettings, timezone: "UTC", precision: "4" }));
  for (const key of runtimeKeys) store.set(key, JSON.stringify({ ...defaultChartSettings, themeLinked: false }));
  store.set("kwantdesk-chart-workspace-presets", "saved preset untouched");
  let mountedPalette;
  window.addEventListener(CHART_SETTINGS_CHANGE_EVENT, (event) => { mountedPalette = event.detail; });
  for (const preset of themePresets) {
    events.length = 0;
    saveTheme(preset.colors); // No settings-page helper: exercise the missing path.
    assert.deepEqual(events.map((event) => event.type), [CHART_SETTINGS_CHANGE_EVENT, "kwantdesk:theme-change"]);
    assert.equal(mountedPalette.backgroundColor, preset.colors.chartBackground, preset.name);
    assert.equal(mountedPalette.upColor, preset.colors.candleUp, preset.name);
    assert.equal(mountedPalette.borderDownColor, preset.colors.candleDownBorder, preset.name);
    assert.equal(mountedPalette.timezone, "UTC");
    assert.equal(css.get("--chart-background"), mountedPalette.backgroundColor);
    for (const key of runtimeKeys) {
      const runtime = JSON.parse(store.get(key));
      assert.equal(runtime.backgroundColor, mountedPalette.backgroundColor, `${preset.name} ${key}`);
      assert.equal(runtime.themeLinked, true);
    }
  }
  assert.equal(store.get("kwantdesk-chart-workspace-presets"), "saved preset untouched");
});

test("explicit wick/border settings survive the shared commit and custom candle overrides remain custom", () => {
  const { events } = browser();
  const explicit = { ...defaultChartSettings, wickUpColor: "#AABBCC", borderUpColor: "#112233" };
  saveTheme(defaultTheme, explicit);
  assert.equal(events[0].detail.wickUpColor, "#AABBCC");
  assert.equal(events[0].detail.borderUpColor, "#112233");
  assert.equal(mergeChartSettingsIntoTheme(defaultTheme, explicit).candleUpBorder, "#112233");
  const custom = resolveCandleSeriesColors({ useThemeColors: false, candleUpColor: "#ABCDEF" },
    { up: "#00FF00", down: "#FF0000", borderUp: "#00FF00", borderDown: "#FF0000", wickUp: "#00FF00", wickDown: "#FF0000" });
  assert.equal(custom.upColor, "#ABCDEF");
});

test("reset publishes the default chart palette without a page refresh", () => {
  const { events, store } = browser();
  saveTheme(themePresets.at(-1).colors);
  events.length = 0;
  resetTheme();
  assert.equal(events[0].type, CHART_SETTINGS_CHANGE_EVENT);
  assert.equal(events[0].detail.backgroundColor, defaultTheme.chartBackground);
  assert.equal(JSON.parse(store.get(CHART_SETTINGS_STORAGE_KEY)).upColor, defaultTheme.candleUp);
});

function cloudClient(snapshot, wait = Promise.resolve()) {
  return { from(table) { return {
    select() { const chain = { eq() { return chain; }, async maybeSingle() {
      await wait;
      return table === "user_preferences" ? { data: { preferences: snapshot, updated_at: snapshot.updatedAt }, error: null }
        : { data: null, error: null };
    } }; return chain; },
    async upsert() { return { error: null }; },
  }; } };
}

test("a newer account theme replaces an older device theme along with chart settings", async () => {
  const { store } = browser();
  const localTheme = themePresets[1].colors;
  const oldTheme = themePresets[2].colors;
  saveTheme(localTheme);
  store.set("kwantdesk:active-preferences-owner:v1", "owner");
  const cloudChart = { ...chartSettingsForTheme(oldTheme, defaultChartSettings), timezone: "Europe/London" };
  const snapshot = { version: 1, complete: true, updatedAt: "2099-01-01T00:00:00Z", values: {
    "olisa-theme": JSON.stringify(oldTheme), [CHART_SETTINGS_STORAGE_KEY]: JSON.stringify(cloudChart),
    ...Object.fromEntries(runtimeKeys.map((key) => [key, JSON.stringify(cloudChart)])),
  } };
  await hydrateUserPreferences(cloudClient(snapshot), { id: "owner", user_metadata: {} });
  assert.equal(JSON.parse(store.get("olisa-theme")).chartBackground, oldTheme.chartBackground);
  for (const key of [CHART_SETTINGS_STORAGE_KEY, ...runtimeKeys]) {
    const restored = JSON.parse(store.get(key));
    assert.equal(restored.backgroundColor, oldTheme.chartBackground);
    assert.equal(restored.upColor, oldTheme.candleUp);
    assert.equal(restored.timezone, "Europe/London", "non-colour preferences still follow the chosen account snapshot");
  }
});

test("a theme clicked during an in-flight account read cannot be overwritten by old chart colours", async () => {
  const { store } = browser();
  saveTheme(defaultTheme);
  store.set("kwantdesk:active-preferences-owner:v1", "owner");
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  const oldChart = chartSettingsForTheme(defaultTheme, defaultChartSettings);
  const snapshot = { version: 1, complete: true, updatedAt: "2099-01-01T00:00:00Z", values: {
    "olisa-theme": JSON.stringify(defaultTheme), [CHART_SETTINGS_STORAGE_KEY]: JSON.stringify(oldChart),
    ...Object.fromEntries(runtimeKeys.map((key) => [key, JSON.stringify(oldChart)])),
  } };
  const hydration = hydrateUserPreferences(cloudClient(snapshot, wait), { id: "owner", user_metadata: {} });
  const chosen = themePresets.find((preset) => preset.colors.chartBackground !== defaultTheme.chartBackground).colors;
  saveTheme(chosen);
  release();
  await hydration;
  for (const key of [CHART_SETTINGS_STORAGE_KEY, ...runtimeKeys]) {
    assert.equal(JSON.parse(store.get(key)).backgroundColor, chosen.chartBackground, key);
  }
});

test("unsent desktop layout survives restart while a phone theme change is preserved", async () => {
  const { store } = browser();
  const base = { version: 1, complete: true, updatedAt: '2026-10-26T00:00:00Z', values: {
    'olisa-theme': JSON.stringify(defaultTheme), 'olisa-chart-workspace-layout': 'single',
  } };
  const remoteTheme = themePresets[2].colors;
  let cloud = { preferences: { ...base, updatedAt: '2026-10-27T00:00:00Z', values: {
    ...base.values, 'olisa-theme': JSON.stringify(remoteTheme),
  } }, updated_at: '2026-10-27T00:00:00Z' };
  store.set('kwantdesk:active-preferences-owner:v1', 'owner');
  store.set('kwantdesk:user-preferences:owner:v1', JSON.stringify(base));
  for (const [key,value] of Object.entries(base.values)) store.set(key,value);
  store.set('olisa-chart-workspace-layout','quad');
  const client = { from(table) {
    let update; const chain = { select(){return chain}, eq(){return chain}, update(value){update=value;return chain},
      async maybeSingle(){
        if (table !== 'user_preferences') return {data:null,error:null};
        if (update) { cloud = update; return {data:{updated_at:update.updated_at},error:null}; }
        return {data:structuredClone(cloud),error:null};
      } }; return chain;
  } };
  await hydrateUserPreferences(client, { id:'owner', user_metadata:{} });
  assert.equal(store.get('olisa-chart-workspace-layout'),'quad');
  assert.deepEqual(JSON.parse(store.get('olisa-theme')),remoteTheme);
  assert.equal(cloud.preferences.values['olisa-chart-workspace-layout'],'quad');
});

test("an in-flight local edit is not mistaken for a cloud acknowledgement", () => {
  const {store} = browser();store.set('kwantdesk:active-preferences-owner:v1','owner');
  const acknowledged={version:1,complete:true,updatedAt:'2026-10-27T00:00:00Z',values:{'olisa-chart-workspace-layout':'single'}};
  const pending={...acknowledged,values:{'olisa-chart-workspace-layout':'quad'}};
  receiveAccountPreferences('owner',pending,acknowledged);
  assert.equal(store.get('olisa-chart-workspace-layout'),'quad');
  assert.equal(readScopedPreferences('owner').values['olisa-chart-workspace-layout'],'single');
  receiveAccountPreferences('different-owner',acknowledged);
  assert.equal(store.get('olisa-chart-workspace-layout'),'quad');
});

test("failed cloud saves throw and retain the prior acknowledged base", async () => {
  const {store} = browser();
  const base={version:1,complete:true,updatedAt:'2026-10-27T00:00:00Z',values:{'olisa-chart-workspace-layout':'single'}};
  store.set('kwantdesk:user-preferences:owner:v1',JSON.stringify(base));
  const client={from(){const chain={select(){return chain},eq(){return chain},async maybeSingle(){return {data:null,error:{code:'offline'}}}};return chain;}};
  await assert.rejects(saveUserPreferences(client,'owner',{...base,values:{'olisa-chart-workspace-layout':'quad'}}));
  assert.equal(readScopedPreferences('owner').values['olisa-chart-workspace-layout'],'single');
});
