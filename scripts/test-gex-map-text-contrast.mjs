import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const palette = await import("../src/lib/gexMapPalette.ts");
const workspace = readFileSync(
  new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8",
);

/**
 * Every strike row's text can be read on the cell it sits on.
 *
 * The rows painted their text with the THEME foreground while the cell behind
 * it came from the PALETTE - two colours with no relationship to each other.
 * On a theme with a dark foreground the negative nodes went unreadable; on a
 * light palette slot a light foreground did the same. The text was always
 * there and simply could not be seen, and which palette it broke on depended
 * entirely on which theme happened to be selected.
 *
 * Black and white are the only candidates on purpose. A third colour taken
 * from the palette would contrast against some slots of its own scale and not
 * others, which is the failure being fixed rather than a fix for it.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const channels = (hex) => {
  const clean = String(hex).replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
  return [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16));
};

const luminance = (hex) => {
  const rgb = channels(hex);
  if (!rgb) return null;
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return channel(rgb[0]) * 0.2126 + channel(rgb[1]) * 0.7152 + channel(rgb[2]) * 0.0722;
};

const contrast = (a, b) => {
  const left = luminance(a);
  const right = luminance(b);
  if (left === null || right === null) return null;
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
};

/** The same rule the workspace applies. */
const readableTextOn = (background) =>
  (contrast(background, "#000000") ?? 0) >= (contrast(background, "#FFFFFF") ?? 0) ? "#000000" : "#FFFFFF";

/* Every colour every shipped palette can paint a cell. */
const slots = [];
for (const [name, value] of Object.entries(palette)) {
  if (!Array.isArray(value)) continue;
  for (const entry of value) {
    if (typeof entry === "string" && channels(entry)) slots.push({ name, colour: entry });
    else if (entry && typeof entry === "object") {
      for (const inner of Object.values(entry)) {
        if (typeof inner === "string" && channels(inner)) slots.push({ name: entry.name ?? name, colour: inner });
        else if (Array.isArray(inner)) {
          for (const colour of inner) {
            if (typeof colour === "string" && channels(colour)) slots.push({ name: entry.name ?? name, colour });
          }
        }
      }
    }
  }
}

check("there are palette colours to check", () => {
  // If the palettes stop being enumerable, everything below passes vacuously.
  assert.ok(slots.length > 30, `only found ${slots.length} palette colours`);
});

check("black or white is readable on every palette colour", () => {
  /*
   * 4.5:1 is the ordinary-text threshold. The point is not the exact number -
   * it is that one of the two ALWAYS clears it, which is why choosing between
   * them per cell is sufficient and choosing a theme colour never was.
   */
  const unreadable = [];
  for (const { name, colour } of slots) {
    const text = readableTextOn(colour);
    const ratio = contrast(colour, text);
    if (ratio === null || ratio < 4.5) unreadable.push(`${name}: ${colour} with ${text} is ${ratio?.toFixed(2)}:1`);
  }
  assert.deepEqual(
    [...new Set(unreadable)], [],
    `these cells cannot be read with either black or white:\n  ${[...new Set(unreadable)].join("\n  ")}`,
  );
});

check("the darkest slots take white and the brightest take black", () => {
  // The rule stated plainly, so a future change that inverts it is caught.
  assert.equal(readableTextOn("#000000"), "#FFFFFF");
  assert.equal(readableTextOn("#0A0A0A"), "#FFFFFF");
  assert.equal(readableTextOn("#FFFFFF"), "#000000");
  assert.equal(readableTextOn("#FFF200"), "#000000");
});

check("the rows use the cell's colour, not the theme's", () => {
  assert.match(
    workspace,
    /const rowBackground = heatColor\(row\.net, strength, signedScale\);\s*\n\s*const rowText = readableTextOn\(rowBackground\);/,
    "the row no longer derives its text from its own background",
  );
  assert.match(workspace, /"--gex-row-text": rowText,/, "the row colour is not published to its children");
  assert.match(
    workspace,
    /className="truncate text-right font-semibold drop-shadow-sm"\s*\n\s*style=\{\{ color: "var\(--gex-row-text\)" \}\}/,
    "the value column is back on the theme foreground",
  );
});

check("the text shadow follows the text", () => {
  // A dark halo under black text on a bright cell just smears it.
  assert.match(
    workspace,
    /textShadow: rowText === "#000000"\s*\n\s*\? "0 1px 2px rgba\(255,255,255,0\.55\)"/,
    "the shadow is fixed dark again",
  );
});

console.log(`\ngex map text contrast: ${passed}/${passed} checks passed`);
