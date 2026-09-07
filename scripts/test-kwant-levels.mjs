import assert from "node:assert/strict";
import {
  kwantLevelColor,
  normalizeKwantLevelsSettings,
  resolveKwantLevelsConversion,
  selectKwantLevels,
} from "../src/lib/kwantLevels.ts";

const theme = { upColor: "#11CC88", downColor: "#EE4477" };

const nq = resolveKwantLevelsConversion("NQ", "AUTO");
assert.equal(nq?.id, "QQQ-NQ", "NQ automatic mode must use the licensed cash-options path");
assert.notEqual(nq?.source, "NQ", "Kwant Levels must never select the retired native provider path");
assert.equal(resolveKwantLevelsConversion("NQ", "NDX-NQ")?.id, "NDX-NQ");
assert.equal(resolveKwantLevelsConversion("ES", "SPX-ES")?.id, "SPX-ES");
assert.equal(resolveKwantLevelsConversion("MES", "NQ-NQ")?.id, "SPY-MES", "an incompatible source must fall back to the correct product");

const normalized = normalizeKwantLevelsSettings({
  maxLevels: 500,
  lineWidth: -2,
  lineStyle: "broken",
  showLabels: false,
}, theme);
assert.equal(normalized.maxLevels, 24);
assert.equal(normalized.lineWidth, 1);
assert.equal(normalized.lineStyle, "dashed");
assert.equal(normalized.showLabels, false);
assert.equal(normalized.dataSource, "GEX_CALL_MINUS_PUT");

const rows = [
  { id: "ranked", kind: "POSITIVE_GEX", label: "K 1", price: 100, value: 50, rank: 1 },
  { id: "wall", kind: "CALL_WALL", label: "Call Wall", price: 110, value: 10, rank: 5 },
  { id: "flip", kind: "ZERO_GAMMA", label: "Zero Gamma", price: 90, value: null, rank: 2 },
  ...Array.from({ length: 30 }, (_, index) => ({
    id: `tail-${index}`,
    kind: "NEGATIVE_GEX",
    label: `K ${index + 2}`,
    price: 80 - index,
    value: index,
    rank: index + 2,
  })),
];
const selected = selectKwantLevels(rows, 4);
assert.equal(selected.length, 4);
assert.deepEqual(selected.slice(0, 2).map((row) => row.id), ["flip", "wall"], "named structural levels must win the display budget");

assert.equal(kwantLevelColor(rows[0].kind, normalized, theme), theme.upColor);
assert.equal(kwantLevelColor(rows[2].kind, normalized, theme), normalized.centreColor);
const custom = normalizeKwantLevelsSettings({
  useThemeColors: false,
  positiveColor: "#123456",
  negativeColor: "#654321",
}, theme);
assert.equal(kwantLevelColor("CALL_WALL", custom, theme), "#123456");
assert.equal(kwantLevelColor("PUT_WALL", custom, theme), "#654321");

console.log("Kwant Levels settings, source selection, ranking, bounds and colours passed.");
