import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { calculateVolumeProfileValueArea, volumeProfileBinTick } =
  await import("../src/lib/volumeProfileMath.ts");
const primitive = readFileSync(
  new URL("../src/lib/nativeVolumeProfilePrimitive.ts", import.meta.url), "utf8",
);

/**
 * The value area is measured over the rows that are drawn.
 *
 * POC and VAH matched DeepChart while VAL did not, which is the signature of
 * the edges being measured on a different grid from the one on screen.
 *
 * Two things had drifted apart once profiles began arriving at tick resolution:
 * the display buckets rows by FLOORING to the bin, while this rounded - so the
 * upper half of every bin fell into the next row up - and the value area was
 * being computed at tick resolution rather than at the bin the trader asked
 * for, which made each two-row expansion step cover a quarter of the intended
 * price distance.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const TICK = 0.25;
const BIN = TICK * 4;

check("a level bins to the same row the chart draws it in", () => {
  /*
   * The display path: price -> tick -> volumeProfileBinTick. The value area
   * must land on that same row for every price inside a bin, including the
   * upper half, which rounding sent to the next row up.
   */
  for (const offset of [0, 1, 2, 3]) {
    const price = 20_000 + offset * TICK;
    const displayRow = volumeProfileBinTick(Math.round(price / TICK), 4) * TICK;
    const area = calculateVolumeProfileValueArea([{ price, volume: 100 }], BIN, 70);
    assert.equal(
      area.poc, displayRow,
      `a print at +${offset} ticks measured on row ${area.poc}, drawn on ${displayRow}`,
    );
  }
});

check("an exact bin boundary does not fall a row low", () => {
  // The floating-point half of the same change: 20000 / 1 must not land at
  // 19999.999... and floor a whole row down.
  for (const price of [20_000, 20_001, 20_050, 19_999]) {
    const area = calculateVolumeProfileValueArea([{ price, volume: 100 }], BIN, 70);
    assert.equal(area.poc, price, `${price} measured on row ${area.poc}`);
  }
});

check("the edges sit on row boundaries", () => {
  /*
   * Built so the value area has to expand several rows in both directions: a
   * peak in the middle with symmetric shoulders.
   */
  const levels = [];
  for (let tick = 0; tick < 120; tick += 1) {
    levels.push({ price: 20_000 + tick * TICK, volume: 500 - Math.abs(tick - 60) * 4 });
  }
  const area = calculateVolumeProfileValueArea(levels, BIN, 68);
  for (const [name, value] of [["poc", area.poc], ["vah", area.vah], ["val", area.val]]) {
    assert.ok(value !== null, `${name} was not resolved`);
    const remainder = Math.abs(value / BIN - Math.round(value / BIN));
    assert.ok(remainder < 1e-6, `${name} ${value} is not on a ${BIN} boundary`);
  }
  assert.ok(area.val < area.poc && area.poc < area.vah, "the value area is inverted or empty");
});

check("both edges move with the bin size, not just one", () => {
  /*
   * The asymmetry that was reported. Measuring on a finer grid than the one
   * drawn moved VAL while VAH happened to stay put; the fix is that the grid is
   * the same one, so changing it moves the whole thing coherently.
   */
  const levels = [];
  for (let tick = 0; tick < 120; tick += 1) {
    levels.push({ price: 20_000 + tick * TICK, volume: 500 - Math.abs(tick - 60) * 4 });
  }
  const fine = calculateVolumeProfileValueArea(levels, TICK, 68);
  const coarse = calculateVolumeProfileValueArea(levels, BIN, 68);
  assert.notDeepEqual(
    [fine.vah, fine.val], [coarse.vah, coarse.val],
    "the bin size no longer changes the value area at all, which cannot be right",
  );
});

check("the renderer measures at the trader's bin", () => {
  // Not tick resolution, and not the zoom-dependent display grouping - a value
  // area that moved when you zoomed would be worse than one that is merely off.
  assert.match(
    primitive,
    /valueArea: calculateVolumeProfileValueArea\(\s*\n\s*sourceLevels,\s*\n\s*profile\.tickSize \* requestedTicks,/,
    "the value area is no longer measured at the requested bin",
  );
  assert.ok(
    !/calculateVolumeProfileValueArea\([\s\S]{0,120}?profile\.tickSize \* profile\.groupTicks/.test(primitive),
    "it is measuring at the arrived resolution again",
  );
  assert.ok(
    !/calculateVolumeProfileValueArea\([\s\S]{0,120}?groupedTicks/.test(primitive),
    "it is measuring at the zoom-dependent grouping",
  );
});

console.log(`\nvalue area rows: ${passed}/${passed} checks passed`);
