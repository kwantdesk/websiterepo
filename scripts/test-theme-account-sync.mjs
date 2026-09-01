import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { THEME_STORAGE_KEY } = await import("../src/lib/theme.ts");

const provider = readFileSync(
  new URL("../src/components/ThemeProvider.tsx", import.meta.url), "utf8",
);
const preferences = readFileSync(
  new URL("../src/lib/userPreferences.ts", import.meta.url), "utf8",
);
const theme = readFileSync(new URL("../src/lib/theme.ts", import.meta.url), "utf8");

/**
 * A theme chosen on one machine reaches the next one.
 *
 * It synced the whole time - the key is tracked and a change pushes it - and it
 * still looked like it did not, because nothing ever told the DOCUMENT.
 *
 * The theme is painted before React runs, by the bootstrap script, out of that
 * browser's own localStorage. Account preferences arrive afterwards and write
 * the account's theme into the same key. With no one re-applying it, signing in
 * on a second machine restored the theme into storage and left the page painted
 * in the old one: the charts changed, because the workspace re-reads its own
 * settings on hydration, and the shell around them did not.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the theme is an account preference, not a browser one", () => {
  assert.equal(THEME_STORAGE_KEY, "olisa-theme");
  assert.match(
    preferences,
    new RegExp(`"${THEME_STORAGE_KEY}",`),
    "the theme key is no longer tracked for account sync",
  );
});

check("choosing a theme pushes it", () => {
  // Otherwise it would only leave with the 60-second sweep.
  const save = theme.slice(theme.indexOf("export function saveTheme"));
  assert.match(
    save.slice(0, 700),
    /window\.dispatchEvent\(new CustomEvent\("kwantdesk:preferences-changed"\)\)/,
    "a theme change no longer notifies the preference sync",
  );
});

check("the account's theme is re-applied when it arrives", () => {
  /*
   * The missing half. Everything else in this file was already true while the
   * bug was live.
   */
  assert.match(provider, /PREFERENCES_HYDRATED_EVENT/, "the provider does not listen for hydration");
  assert.match(
    provider,
    /window\.addEventListener\(PREFERENCES_HYDRATED_EVENT, reapply\)/,
    "hydration no longer re-applies the theme",
  );
  assert.match(provider, /const reapply = \(\) => applyTheme\(\);/, "the re-apply no longer re-reads storage");
});

check("another tab's change is picked up too", () => {
  // Two windows on one machine were as out of step as two machines were.
  assert.match(provider, /window\.addEventListener\("storage", onStorage\)/);
  assert.match(provider, /event\.key === THEME_STORAGE_KEY/, "the storage listener hardcodes the key");
});

check("both listeners are removed", () => {
  // A provider that leaks a listener per mount is its own bug.
  assert.match(provider, /window\.removeEventListener\(PREFERENCES_HYDRATED_EVENT, reapply\)/);
  assert.match(provider, /window\.removeEventListener\("storage", onStorage\)/);
});

check("the first paint still comes from the bootstrap script", () => {
  /*
   * The reason the theme is read before React at all: without it the shell
   * paints default colours and then flips, which is worse than a late sync.
   */
  assert.match(theme, /export function themeBootstrapScript\(\)/);
  assert.match(provider, /applyTheme\(\);\n/, "the provider no longer applies on mount");
});

console.log(`\ntheme account sync: ${passed}/${passed} checks passed`);
