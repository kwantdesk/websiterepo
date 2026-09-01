/**
 * Every volume-profile setting, and whether anything reads it.
 *
 * `numberOfProfiles` and `valueAreaDeveloping` were both stored, migrated
 * across settings versions, given a control in the dialog, and read by nothing.
 * A setting like that survives every review: it persists, it round-trips, and
 * it moves nothing on the chart. The only way to find them is to ask, for each
 * key, whether any code outside the config consumes it — and separately whether
 * the trader has any way to set it.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const { defaultIndicatorSettings } = await import("../src/lib/chartIndicatorConfig.ts");

const root = fileURLToPath(new URL("../src", import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  const full = join(dir, entry);
  return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(full) ? [full] : [];
});

/** Where a setting is DECLARED or merely persisted, rather than acted on. */
const DECLARING = "chartIndicatorConfig.ts";
/** A control proves the trader can set it, not that anything obeys it. */
const DIALOG = "ChartIndicatorsControl.tsx";

const files = walk(root).map((path) => ({
  path: path.slice(path.indexOf("src")).split("\\").join("/"),
  source: readFileSync(path, "utf8"),
}));

const settings = defaultIndicatorSettings("kwant-profile", {
  upColor: "#22C55E", downColor: "#EF4444", borderUpColor: "#16A34A",
  borderDownColor: "#DC2626", gridColor: "#71717A", backgroundColor: "#050607",
});

const rows = [];
for (const key of Object.keys(settings).sort()) {
  const value = settings[key];
  const pattern = new RegExp(`(\\.|\\?\\.|["'\`])${key}\\b`);
  const hits = files.filter(({ path, source }) => !path.endsWith(DECLARING) && pattern.test(source));
  /*
   * The dialog renders booleans and colours from a GENERATED section that
   * iterates the settings object, and the session toggles from
   * DESK_SESSION_SETTING_KEYS - so neither names the key literally. Only
   * numbers and strings need a control written by hand, which is what this is
   * really looking for.
   */
  const generated = typeof value === "boolean" || /colou?r$/i.test(key);
  const sessionToggle = /^session[A-Za-z]+Enabled$/.test(key);
  const dialog = generated || sessionToggle || hits.some(({ path }) => path.endsWith(DIALOG));
  const consumers = hits.filter(({ path }) => !path.endsWith(DIALOG)).map(({ path }) => path);
  rows.push({ key, value: settings[key], dialog, consumers });
}

const inert = rows.filter((row) => !row.consumers.length);
const unreachable = rows.filter((row) => row.consumers.length && !row.dialog);

console.log(`volume profile settings: ${rows.length}`);
console.log(`  something consumes:     ${rows.length - inert.length}`);
console.log(`  NOTHING consumes:       ${inert.length}`);
console.log(`  no control to set them: ${unreachable.length}`);
console.log("");

if (inert.length) {
  console.log("STORED AND INERT — nothing reads these:");
  for (const row of inert) {
    console.log(`  ${row.key.padEnd(30)} = ${JSON.stringify(row.value)}${row.dialog ? "   (but it HAS a control)" : ""}`);
  }
  console.log("");
}

if (unreachable.length) {
  console.log("HONOURED BUT UNREACHABLE — no control in the dialog:");
  for (const row of unreachable) {
    console.log(`  ${row.key.padEnd(30)} = ${JSON.stringify(row.value)}`);
  }
}
