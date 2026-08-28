import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

// The module under test uses the app's "@/" alias, which only Next resolves.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      const target = fileURLToPath(new URL(`../src/${specifier.slice(2)}`, import.meta.url));
      return { url: pathToFileURL(target.endsWith(".ts") ? target : `${target}.ts`).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
});

const {
  resolveIndicatorPalette,
  indicatorColorRoles,
  indicatorSupportsPalette,
  gradientStop,
  INDICATOR_COLOR_ROLES,
  INDICATOR_GRADIENT_KEY,
  INDICATOR_GRADIENTS,
} = await import("../src/lib/indicatorPalettes.ts");

/**
 * One-click colour schemes for every indicator.
 *
 * The volume profile and the footprint each grew a hand-written Colours block
 * against their own option names. Repeating that for every indicator would be
 * one chance per indicator to spell a key differently, so an indicator instead
 * declares the colour ROLES it paints with and a shared resolver does the rest.
 *
 * These checks are about the contract that makes that safe: schemes beat
 * pickers, pickers beat the theme, the theme is always the floor, and the order
 * roles are declared in is the order a scheme is spread across.
 */

const THEME = { up: "#22c55e", down: "#ef4444", neutral: "#888888", accent: "#2962ff", text: "#ffffff" };
let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("an indicator with no roles declared gets no palette", () => {
  // Silence, not an empty scheme: the caller must be able to tell "no palette"
  // from "a palette that happens to be blank".
  assert.deepEqual(resolveIndicatorPalette("not-an-indicator", {}, THEME), {});
  assert.equal(indicatorSupportsPalette("not-an-indicator"), false);
});

check("with nothing chosen every role falls back to the theme", () => {
  /*
   * This is what makes the feature safe to add to an indicator that already
   * looks right: before anyone touches a picker it must paint exactly what it
   * painted before, which means the theme and not a baked-in default.
   */
  const out = resolveIndicatorPalette("big-contracts", {}, THEME);
  assert.equal(out.askColor, THEME.up);
  assert.equal(out.bidColor, THEME.down);
  const other = resolveIndicatorPalette("big-contracts", {}, { ...THEME, up: "#010203", down: "#040506" });
  assert.equal(other.askColor, "#010203", "the fallback is not reading the live theme");
});

check("an explicit colour beats the theme", () => {
  const out = resolveIndicatorPalette("big-contracts", { askColor: "#123456" }, THEME);
  assert.equal(out.askColor, "#123456");
  assert.equal(out.bidColor, THEME.down, "an untouched role must still follow the theme");
});

check("a scheme beats an explicit colour", () => {
  /*
   * A scheme wins outright rather than blending. Letting both apply produces an
   * indicator that half-follows the scheme, which reads as a bug every time -
   * the profiles already learned this and lock their pickers while a scheme is
   * on, so the same rule holds here.
   */
  const scheme = INDICATOR_GRADIENTS[0];
  const out = resolveIndicatorPalette(
    "big-contracts",
    { [INDICATOR_GRADIENT_KEY]: scheme.id, askColor: "#123456", bidColor: "#654321" },
    THEME,
  );
  assert.equal(out.bidColor, scheme.from, "the first role must take the scheme's start");
  assert.equal(out.askColor, scheme.to, "the last role must take the scheme's end");
});

check("a two-role indicator takes the scheme's endpoints exactly", () => {
  // Not two muddy midpoints - that is what makes a scheme on a bid/ask
  // indicator actually look like the scheme the trader picked.
  const g = { id: "t", label: "t", from: "#000000", to: "#ffffff" };
  assert.equal(gradientStop(g, 0, 2), "#000000");
  assert.equal(gradientStop(g, 1, 2), "#ffffff");
});

check("a lone series takes the scheme's finishing colour", () => {
  /*
   * Not its starting one, and not a division by zero. Choosing
   * "Red -> Terminal Green" for a single VWAP line and getting the dark red
   * reads as the wrong scheme entirely - the end of the ramp is what a trader
   * means when they point at a scheme and say "that colour".
   */
  const g = { id: "t", label: "t", from: "#abcdef", to: "#ffffff" };
  assert.equal(gradientStop(g, 0, 1), "#ffffff");
});

check("middle roles are spread across the scheme", () => {
  const g = { id: "t", label: "t", from: "#000000", to: "#ffffff" };
  const middle = gradientStop(g, 1, 3);
  assert.notEqual(middle, "#000000");
  assert.notEqual(middle, "#ffffff");
  // Halfway between black and white, allowing for rounding to whole channels.
  const channel = parseInt(middle.slice(1, 3), 16);
  assert.ok(Math.abs(channel - 128) <= 2, `midpoint channel ${channel} is not halfway`);
});

check("scheme off is the same as no scheme", () => {
  const out = resolveIndicatorPalette("big-contracts", { [INDICATOR_GRADIENT_KEY]: "off" }, THEME);
  assert.equal(out.askColor, THEME.up);
  const bogus = resolveIndicatorPalette("big-contracts", { [INDICATOR_GRADIENT_KEY]: "no-such-scheme" }, THEME);
  assert.equal(bogus.askColor, THEME.up, "an unknown scheme id must not blank the indicator");
});

check("the theme toggle hides explicit colours, but never a scheme", () => {
  /*
   * Big contracts and big blocks shipped with a "Theme colours" toggle long
   * before schemes existed, and while it is on their explicit colours are
   * deliberately ignored. That has to keep working - but a scheme outranks it,
   * because picking one and having it silently do nothing because a toggle is
   * on elsewhere in the dialog is exactly the dead control this replaces.
   */
  const locked = resolveIndicatorPalette("big-contracts", { askColor: "#123456" }, THEME, true);
  assert.equal(locked.askColor, THEME.up, "the theme toggle did not override the picker");

  const scheme = INDICATOR_GRADIENTS[0];
  const withScheme = resolveIndicatorPalette(
    "big-contracts",
    { [INDICATOR_GRADIENT_KEY]: scheme.id, askColor: "#123456" },
    THEME,
    true,
  );
  assert.equal(withScheme.askColor, scheme.to, "the theme toggle swallowed the scheme");
});

check("a malformed stored colour is ignored rather than painted", () => {
  // Workspaces persist these, so anything can come back. A non-colour must fall
  // through to the theme instead of reaching a canvas as a fillStyle.
  for (const bad of ["", "red", "#fff", "#12345g", 42, null, {}]) {
    const out = resolveIndicatorPalette("big-contracts", { askColor: bad }, THEME);
    assert.equal(out.askColor, THEME.up, `accepted ${JSON.stringify(bad)}`);
  }
});

check("every declared role is usable and uniquely keyed", () => {
  /*
   * A duplicated key inside one indicator means two pickers writing over each
   * other, and a role with no fallback means an indicator that paints
   * `undefined` before anyone touches it.
   */
  for (const [id, roles] of Object.entries(INDICATOR_COLOR_ROLES)) {
    assert.ok(roles.length > 0, `${id} declares an empty role list`);
    const keys = roles.map((role) => role.key);
    assert.equal(new Set(keys).size, keys.length, `${id} declares a duplicate role key`);
    for (const role of roles) {
      assert.ok(role.label && role.label.trim(), `${id}.${role.key} has no label`);
      assert.equal(typeof role.fallback, "function", `${id}.${role.key} has no fallback`);
      assert.match(role.fallback(THEME), /^#[0-9a-f]{6}$/i, `${id}.${role.key} fallback is not a colour`);
    }
    // The roles must actually resolve for the indicator that declares them.
    const resolved = resolveIndicatorPalette(id, {}, THEME);
    assert.deepEqual(Object.keys(resolved).sort(), keys.slice().sort(), `${id} resolves different keys`);
    assert.deepEqual(indicatorColorRoles(id), roles);
  }
});

check("the schemes are the same list the profiles offer", () => {
  // The owner asked for the palettes already on the footprint. A second list
  // that drifted from the first would be worse than no list.
  const profiles = readFileSync(new URL("../src/lib/volumeProfileGradients.ts", import.meta.url), "utf8");
  const palettes = readFileSync(new URL("../src/lib/indicatorPalettes.ts", import.meta.url), "utf8");
  assert.match(palettes, /INDICATOR_GRADIENTS = VOLUME_PROFILE_GRADIENTS/, "the scheme list was copied, not shared");
  assert.ok(INDICATOR_GRADIENTS.length >= 10, "the scheme list shrank");
  for (const scheme of INDICATOR_GRADIENTS) {
    assert.ok(profiles.includes(scheme.id), `${scheme.id} is not one of the profile schemes`);
  }
});

const { calculateIndicatorSeries } = await import("../src/lib/chartIndicatorEngine.ts");
const { defaultIndicatorSettings } = await import("../src/lib/chartIndicatorConfig.ts");
const { CHART_INDICATOR_BY_ID } = await import("../src/lib/chartIndicatorCatalog.ts");
const { applyIndicatorPlotColors, INDICATOR_PLOT_COLOR_SLOTS } = await import("../src/lib/indicatorPlotColors.ts");

const ENGINE_THEME = {
  primary: "#22C55E", secondary: "#4ADE80", positive: "#22C55E",
  negative: "#EF4444", muted: "#8A8F98", up: "#22C55E", down: "#EF4444",
  grid: "#8A8F98", text: "#FFFFFF", background: "#000000",
};
const candles = [];
let price = 20_000;
for (let i = 0; i < 300; i += 1) {
  price += Math.sin(i / 7) * 3;
  const open = price;
  const close = price + Math.cos(i / 5) * 2;
  candles.push({
    timestamp: 1_700_000_000_000 + i * 60_000,
    open, high: Math.max(open, close) + 1, low: Math.min(open, close) - 1, close,
    volume: 500 + (i % 97), askVolume: 300, bidVolume: 200, delta: 100,
  });
}
const runEngine = (id, settings) => calculateIndicatorSeries(
  { instanceId: id, indicatorId: id, enabled: true, settings },
  candles, ENGINE_THEME, { instrument: "NQ", tickSize: 0.25 },
);
const plotting = [];
for (const [id] of CHART_INDICATOR_BY_ID) {
  let series = [];
  try { series = runEngine(id, defaultIndicatorSettings(id) ?? {}); } catch { continue; }
  if (series.length) plotting.push([id, series]);
}

check("every study that plots anything offers a palette", () => {
  /*
   * The check that would have caught the half-done job: three studies had
   * schemes and twenty-three did not, because the role list was written by
   * hand beside a registry the engine already had. Roles are generated from
   * that registry now, so this cannot drift again without failing here.
   */
  assert.ok(plotting.length >= 20, `expected the usual studies to plot, got ${plotting.length}`);
  const missing = plotting.map(([id]) => id).filter((id) => !indicatorSupportsPalette(id));
  assert.deepEqual(missing, [], `these studies plot but offer no colour scheme: ${missing.join(", ")}`);
});

check("a scheme recolours every plotted series of every study", () => {
  // Offering the control is not the same as it doing anything.
  const scheme = INDICATOR_GRADIENTS.find((g) => g.id === "chromey-mono") ?? INDICATOR_GRADIENTS[0];
  const untouched = [];
  for (const [id, series] of plotting) {
    if (!INDICATOR_PLOT_COLOR_SLOTS[id]) continue;
    const before = series.map((entry) => entry.color);
    const after = applyIndicatorPlotColors(id, { [INDICATOR_GRADIENT_KEY]: scheme.id }, series);
    if (!after.some((entry, index) => entry.color && entry.color !== before[index])) untouched.push(id);
  }
  assert.deepEqual(untouched, [], `a scheme left these studies unchanged: ${untouched.join(", ")}`);
});

check("a multi-series study is graded across the scheme", () => {
  /*
   * Slots are declared in plot order, so a scheme fades the bands out from the
   * mean rather than each one picking an unrelated colour.
   */
  const envelopes = INDICATOR_PLOT_COLOR_SLOTS["vwap-envelopes"];
  assert.ok(envelopes && envelopes.length > 2, "vwap-envelopes no longer plots bands");
  const scheme = { id: "t", label: "t", from: "#000000", to: "#FFFFFF" };
  const stops = envelopes.map((_, index) => gradientStop(scheme, index, envelopes.length));
  assert.equal(stops[0], "#000000");
  assert.equal(stops[stops.length - 1], "#FFFFFF");
  assert.equal(new Set(stops).size, stops.length, "the bands are not distinct");
});

check("a study that colours its bars individually is recoloured too", () => {
  /*
   * Volume does not take one colour: every bar carries its own, set from the
   * theme's positive or negative to show direction. Setting only the series
   * colour changed nothing a trader could see, so both the picker and the
   * scheme were dead on it - reported as "volume doesn't even work".
   *
   * Direction has to survive the recolour, or the fix trades an invisible
   * control for a histogram that no longer says which way the bar went.
   */
  const perPoint = plotting.filter(([, series]) => series.some((entry) => Array.isArray(entry.data)
    && entry.data.some((point) => typeof point?.color === "string")));
  assert.ok(perPoint.length > 0, "no study colours its bars individually any more");

  /*
   * Driven through the engine rather than by re-applying to series it already
   * coloured. The engine applies a study's colours exactly once, so applying
   * them a second time here would compare against bars that had already been
   * recoloured and report a working study as dead.
   */
  const dead = [];
  for (const [id] of perPoint) {
    const bars = (settings) => new Set(runEngine(id, { ...(defaultIndicatorSettings(id) ?? {}), ...settings })
      .flatMap((entry) => (entry.data ?? []).map((point) => point?.color).filter(Boolean)));
    const before = bars({});
    const after = bars({ [INDICATOR_GRADIENT_KEY]: "chromey-mono" });
    if ([...after].every((colour) => before.has(colour))) dead.push(id);
  }
  assert.deepEqual(dead, [], `a scheme left the bars of these studies unchanged: ${dead.join(", ")}`);

  const volume = plotting.find(([id]) => id === "volume");
  assert.ok(volume, "volume no longer plots");
  const themed = applyIndicatorPlotColors(
    "volume",
    { [INDICATOR_GRADIENT_KEY]: "chromey-mono" },
    // Bars coloured by direction, exactly as the engine emits them.
    [{ key: "volume", kind: "histogram", color: "#8A8F98", data: [
      { time: 1, value: 5, color: ENGINE_THEME.positive },
      { time: 2, value: 4, color: ENGINE_THEME.negative },
    ] }],
    ENGINE_THEME,
  );
  const colours = themed[0].data.map((point) => point.color);
  assert.equal(new Set(colours).size, 2, `direction was flattened: ${colours.join(", ")}`);
});

check("an explicit pick still works when no scheme is on", () => {
  // A scheme is an override, not a replacement for the per-series pickers.
  const out = applyIndicatorPlotColors("vwap", { mainColor: "#123456" }, [{ key: "vwap-main", color: "#ffffff" }]);
  assert.equal(out[0].color, "#123456");
});

console.log(`\nindicator palettes: ${passed}/${passed} checks passed`);
