import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const matrix = readFileSync(
  new URL("../src/components/gex-cal/GexCalendarMatrix.tsx", import.meta.url),
  "utf8",
);

test("GEX CAL highlights the displayed strike nearest the live spot", () => {
  assert.match(matrix, /const currentStrike = useMemo/);
  assert.match(matrix, /Math\.abs\(strike - matrix\.spot!\)/);
  assert.match(matrix, /const isCurrentStrike = strike === currentStrike/);
  assert.match(matrix, /aria-current=\{isCurrentStrike \? "true" : undefined\}/);
});

test("current strike highlight follows the active theme and stays separate from Star cells", () => {
  assert.match(matrix, /border-primary bg-\[color-mix\(in_srgb,var\(--primary\)_24%,var\(--panel\)\)\]/);
  assert.match(matrix, /inset_3px_0_0_var\(--primary\)/);
  assert.match(matrix, /const starKey = matrix\.globalStar/);
  assert.match(matrix, /isStar = showStars/);
});
