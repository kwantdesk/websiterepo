import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const types = readFileSync("src/lib/tpo/types.ts", "utf8");
const settings = readFileSync("src/lib/tpo/settings.ts", "utf8");
const primitive = readFileSync("src/lib/tpo/primitive.ts", "utf8");
const engine = readFileSync("src/lib/tpo/engine.ts", "utf8");
const control = readFileSync("src/components/ChartIndicatorsControl.tsx", "utf8");
const consumers = primitive + engine;

const block = /export interface TpoIndicatorSettings \{([\s\S]*?)\n\}/.exec(types)[1];
const fields = [...new Set([...block.matchAll(/^\s{2}([a-zA-Z][A-Za-z0-9]*)\??:/gm)].map((m) => m[1]))];

// 1. The overwhelming majority of settings must actually be read. A setting
//    the engine never looks at is a control that silently does nothing.
const unread = fields.filter((f) => !consumers.includes(`settings.${f}`));
assert.ok(fields.length > 100, "the settings surface should be substantial");
assert.ok(
  unread.length / fields.length < 0.2,
  `too many settings are never read: ${unread.length}/${fields.length} — ${unread.slice(0, 8).join(", ")}`,
);

// 2. The controls the trader reaches for most must be wired end to end.
for (const key of ["displayType", "groupingMode", "ticksPerRow", "autoTargetRows", "visualStyle"]) {
  assert.ok(fields.includes(key), `${key} must exist on the settings type`);
  assert.ok(consumers.includes(`settings.${key}`), `${key} must be read by the engine or renderer`);
}

// 3. Manual tick grouping actually drives the row size.
assert.match(engine, /if \(settings\.groupingMode === "manual"\) return Math\.max\(1, Math\.round\(settings\.ticksPerRow\)\)/);

// 4. THE BUG: choosing Letters must show letters. The gate used to demand a
//    block taller than the minimum FONT size, so at ordinary zoom — where rows
//    are a few pixels — it silently fell back to blocks.
assert.match(primitive, /settings\.displayType === "letters"\s*\r?\n?\s*\? size >= 4/);
assert.doesNotMatch(
  primitive,
  /if \(showLetters && size >= settings\.minimumTextSize \+ 1\)/,
  "the absolute letter threshold must not come back",
);

// 5. Appearance matches the volume profile's options and is honoured.
assert.match(types, /visualStyle: "solid" \| "hollow" \| "line";/);
for (const style of ['"solid"', '"hollow"', '"line"']) {
  assert.ok(primitive.includes(`settings.visualStyle === ${style}`) || primitive.includes(`visualStyle !== "line"`),
    `visual style ${style} must be handled`);
}
assert.match(settings, /visualStyle: enumValue\("visualStyle", \["solid", "hollow", "line"\]/);

// 6. It is reachable in the UI, beside Display.
assert.match(control, /\["Appearance", "visualStyle", \[\["solid", "Solid"\], \["hollow", "Hollow"\], \["line", "Line"\]\]\]/);

console.log(`TPO settings wiring: 6/6 checks passed (${fields.length - unread.length}/${fields.length} settings read)`);
