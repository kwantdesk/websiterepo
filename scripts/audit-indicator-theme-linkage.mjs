import { writeFileSync } from "node:fs";

const { CHART_INDICATOR_CATALOG } = await import("../src/lib/chartIndicatorCatalog.ts");
const { defaultIndicatorSettings } = await import("../src/lib/chartIndicatorConfig.ts");

/**
 * Which indicators actually follow the chart theme, and which are painted once
 * and never move again.
 *
 * Colours are seeded from the theme when an indicator is CREATED. Whether they
 * follow a later theme change is a separate question, and the answer differs
 * per indicator - so this asks every one of them the same question rather than
 * sampling a few and assuming.
 *
 * The method: build each indicator's defaults under two deliberately opposite
 * themes and compare. A colour key that comes back IDENTICAL under both is
 * hardcoded - it cannot follow any theme, because it did not follow this one.
 */

const LIGHT = {
  upColor: "#22C55E",
  downColor: "#EF4444",
  borderUpColor: "#16A34A",
  borderDownColor: "#DC2626",
  gridColor: "#8A8F98",
  backgroundColor: "#FFFFFF",
};
const DARK = {
  upColor: "#00E5FF",
  downColor: "#FF00AA",
  borderUpColor: "#0088FF",
  borderDownColor: "#CC0088",
  gridColor: "#334155",
  backgroundColor: "#000000",
};

const isColourKey = (key, value) =>
  typeof value === "string"
  && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim());

const rows = [];
for (const definition of CHART_INDICATOR_CATALOG) {
  const id = definition.id;
  let light;
  let dark;
  try {
    light = defaultIndicatorSettings(id, LIGHT) ?? {};
    dark = defaultIndicatorSettings(id, DARK) ?? {};
  } catch (error) {
    rows.push({ id, name: definition.name, threw: String(error?.message ?? error) });
    continue;
  }

  const colourKeys = Object.keys(light).filter((key) => isColourKey(key, light[key]));
  const follows = colourKeys.filter((key) => light[key] !== dark[key]);
  const fixed = colourKeys.filter((key) => light[key] === dark[key]);
  rows.push({
    id,
    name: definition.name,
    colours: colourKeys.length,
    follows: follows.length,
    fixed,
    hasThemeFlag: Object.prototype.hasOwnProperty.call(light, "useThemeColors"),
    themeFlagValue: light.useThemeColors,
  });
}

const withColours = rows.filter((row) => (row.colours ?? 0) > 0);
const fullyLinked = withColours.filter((row) => row.fixed.length === 0);
const partly = withColours.filter((row) => row.fixed.length > 0 && row.follows > 0);
const notLinked = withColours.filter((row) => row.follows === 0);

console.log(`indicators in catalog:            ${rows.length}`);
console.log(`  carrying colour settings:       ${withColours.length}`);
console.log(`  every colour follows the theme: ${fullyLinked.length}`);
console.log(`  SOME colours are hardcoded:     ${partly.length}`);
console.log(`  NO colour follows the theme:    ${notLinked.length}`);
console.log(`  threw while building defaults:  ${rows.filter((row) => row.threw).length}`);

const report = [...partly, ...notLinked]
  .sort((a, b) => b.fixed.length - a.fixed.length)
  .map((row) => `${row.id.padEnd(34)} ${String(row.fixed.length).padStart(3)} fixed / ${String(row.colours).padStart(3)} total  ${row.fixed.slice(0, 6).join(", ")}${row.fixed.length > 6 ? ", ..." : ""}`);

console.log("\nindicators with colours that cannot follow a theme:");
for (const line of report) console.log("  " + line);

writeFileSync(
  new URL("./indicator-theme-linkage.json", import.meta.url),
  JSON.stringify({ generatedFor: "theme linkage audit", rows }, null, 2),
);
console.log("\nfull detail written to scripts/indicator-theme-linkage.json");
