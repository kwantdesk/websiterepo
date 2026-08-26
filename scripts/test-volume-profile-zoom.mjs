import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

const outDir = mkdtempSync(join(process.cwd(), ".vp-zoom-test-"));
const bundle = join(outDir, "profile.mjs");
execSync(
  `npx esbuild src/lib/nativeVolumeProfilePrimitive.ts --bundle --format=esm --platform=node --alias:@=./src --outfile="${bundle}"`,
  { stdio: "pipe" },
);
const { zoomScaledVolumeProfileWidth } = await import(`file://${bundle.replaceAll("\\", "/")}`);

const PANE = 1_400;
const REFERENCE_BARS = 80;
const WIDTH_PERCENT = 24;
// Width the profile draws at reference zoom = "100%".
const FULL = PANE * WIDTH_PERCENT / 100;

const widthAt = (visibleBars) => zoomScaledVolumeProfileWidth({
  paneWidth: PANE,
  visibleLogicalFrom: 0,
  visibleLogicalTo: visibleBars,
  referenceLogicalBars: REFERENCE_BARS,
  widthPercent: WIDTH_PERCENT,
});

// 1. At the reference zoom the profile draws at its configured width.
assert.ok(Math.abs(widthAt(REFERENCE_BARS) - FULL) < 1e-9, "reference zoom must be 100%");

// 2. Scrolling out shrinks it, tracking the candles.
const shrinking = [80, 100, 120, 140, 160].map(widthAt);
for (let i = 1; i < shrinking.length; i += 1) {
  assert.ok(shrinking[i] < shrinking[i - 1], "profile must shrink while scrolling out to the floor");
}

// 3. The shrink stops at half width — never below.
const atFloor = widthAt(REFERENCE_BARS * 2);
assert.ok(Math.abs(atFloor - FULL * 0.5) < 1e-9, `floor must be 50% of full width, got ${atFloor / FULL}`);

// 4. Past the floor it turns around and grows back.
const growing = [160, 200, 280, 400, 640].map(widthAt);
for (let i = 1; i < growing.length; i += 1) {
  assert.ok(growing[i] > growing[i - 1], "profile must grow again once past the floor");
}

// 5. It reaches full width again when zoomed right out, and never exceeds it.
const wideOut = widthAt(REFERENCE_BARS * 8);
assert.ok(Math.abs(wideOut - FULL) < 1e-9, `full width at 8x span, got ${wideOut / FULL}`);
for (const bars of [REFERENCE_BARS * 8, REFERENCE_BARS * 20, REFERENCE_BARS * 100]) {
  assert.ok(widthAt(bars) <= FULL + 1e-9, "the rebound must never overshoot full width");
}

// 6. Zooming IN still grows the profile with the candles, bounded by the pane.
assert.ok(widthAt(REFERENCE_BARS / 2) > FULL, "zooming in must still enlarge the profile");
assert.ok(widthAt(1) <= PANE * 0.36 + 1e-9, "the pane fraction ceiling still bounds it");

rmSync(outDir, { recursive: true, force: true });
// A blocker off screen still stops the lines.
//
// Value-area lines stop at the back of the profile in FRONT. That profile's
// position was projected from the last candle, so zooming into a region far
// behind the live edge put the last candle off screen too and the projection
// returned null - exactly when it was needed. With no position for the blocker,
// a week-old profile's lines ran straight through everything to the right edge,
// which looked like the lines releasing on zoom.
//
// The scale is linear in logical space, so ANY resolvable anchor plus the bar
// interval places any time. The last candle when it is visible, otherwise the
// start of whatever is.
{
  const primitive = readFileSync("src/lib/nativeVolumeProfilePrimitive.ts", "utf8");
  assert.match(
    primitive,
    /timeScale\.getVisibleRange\(\)\?\.from \?\? null/,
    "an off-screen last candle must fall back to something that is on screen",
  );
  assert.match(primitive, /const anchorLogical = timeScale\.coordinateToLogical\(anchorCoordinate\);/);
  assert.match(
    primitive,
    /\+ \(timestamp - Number\(anchorTime\)\) \/ model\.intervalSeconds;/,
    "the offset must be measured from the anchor actually used, not always the last candle",
  );
  // The blocker is still projected through the model being drawn, which always
  // has a usable basis, rather than giving up because it could not measure
  // itself.
  assert.match(primitive, /const blockerX = blockerDrawnX \?\? \(blockerStartMs === undefined/);
}

console.log("volume profile zoom curve: 6/6 checks passed");
