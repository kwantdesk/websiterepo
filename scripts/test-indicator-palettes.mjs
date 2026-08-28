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

check("a single-role indicator does not divide by zero", () => {
  const g = { id: "t", label: "t", from: "#abcdef", to: "#ffffff" };
  assert.equal(gradientStop(g, 0, 1), "#abcdef");
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

console.log(`\nindicator palettes: ${passed}/${passed} checks passed`);
