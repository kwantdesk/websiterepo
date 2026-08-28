import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";

const outDir = mkdtempSync(join(process.cwd(), ".vp-grad-test-"));
const bundle = join(outDir, "gradients.mjs");
execSync(
  `npx esbuild src/lib/volumeProfileGradients.ts --bundle --format=esm --platform=node --alias:@=./src --outfile="${bundle}"`,
  { stdio: "pipe" },
);
const {
  VOLUME_PROFILE_GRADIENTS,
  VOLUME_PROFILE_GRADIENT_OFF,
  resolveVolumeProfileGradient,
  isVolumeProfileGradientActive,
} = await import(`file://${bundle.replaceAll("\\", "/")}`);

// 1. At least the ten schemes originally asked for; more may be added since
//    every check below is per-scheme rather than positional.
assert.ok(
  VOLUME_PROFILE_GRADIENTS.length >= 10,
  `expected at least ten schemes, found ${VOLUME_PROFILE_GRADIENTS.length}`,
);

/*
 * Theme names a scheme is allowed to borrow, read from the presets so a scheme
 * cannot be named after a theme that does not exist or has been renamed.
 */
const themeNames = new Set(
  [...readFileSync(new URL("../src/lib/themePresets.ts", import.meta.url), "utf8")
    .matchAll(/palette\("([^"]+)"/g)].map((match) => match[1]),
);

// 2. Every scheme is a genuine two-colour fade with distinct, valid endpoints.
const HEX = /^#[0-9A-Fa-f]{6}$/;
const ids = new Set();
for (const gradient of VOLUME_PROFILE_GRADIENTS) {
  assert.match(gradient.from, HEX, `${gradient.id} from is not a hex colour`);
  assert.match(gradient.to, HEX, `${gradient.id} to is not a hex colour`);
  assert.notEqual(gradient.from.toLowerCase(), gradient.to.toLowerCase(), `${gradient.id} does not fade`);
  /*
   * A label has to tell a trader what the scheme does. Naming both ends does
   * that, and so does carrying the name of a theme they can actually select -
   * "Chromey Mono" says which look it matches, which is more use than
   * "Red -> Terminal Green". Anything else says nothing.
   */
  assert.ok(
    gradient.label.includes("→") || themeNames.has(gradient.label),
    `${gradient.id} label names neither its endpoints nor a real theme`,
  );
  assert.ok(!ids.has(gradient.id), `duplicate scheme id ${gradient.id}`);
  ids.add(gradient.id);
}

// 3. The named schemes the desk asked for are present.
for (const id of ["pink-blue", "yellow-blue", "orange-green", "red-yellow", "black-white", "pink-purple"]) {
  assert.ok(ids.has(id), `missing requested scheme ${id}`);
}

// 4. Off means off, and unknown values fall back to off rather than throwing.
assert.equal(resolveVolumeProfileGradient(VOLUME_PROFILE_GRADIENT_OFF), null);
assert.equal(resolveVolumeProfileGradient(undefined), null);
assert.equal(resolveVolumeProfileGradient(""), null);
assert.equal(resolveVolumeProfileGradient("not-a-scheme"), null);
assert.equal(isVolumeProfileGradientActive("pink-blue"), true);
assert.equal(isVolumeProfileGradientActive(VOLUME_PROFILE_GRADIENT_OFF), false);

// 5. A resolved scheme round-trips.
const pinkBlue = resolveVolumeProfileGradient("pink-blue");
assert.equal(pinkBlue.id, "pink-blue");
assert.ok(pinkBlue.from && pinkBlue.to);

// 6. The renderer must fade the body across the profile, not per row, and must
//    fall back to the individual colours when no scheme is set.
const primitive = readFileSync("src/lib/nativeVolumeProfilePrimitive.ts", "utf8");
assert.match(primitive, /createLinearGradient\(0, lowY, 0, highY\)/);
assert.match(primitive, /const bodyColor = \(fallback: string\) => bodyGradient \?\? fallback;/);
assert.match(primitive, /bodyColor\(style\.valueAreaColor\)/);
assert.match(primitive, /bodyColor\(style\.outsideValueAreaColor\)/);

// 7. The pickers must be locked while a scheme owns the colours.
const control = readFileSync("src/components/ChartIndicatorsControl.tsx", "utf8");
assert.match(control, /const gradientLocked = \(/);
assert.match(control, /disabled=\{gradientLocked\}/);
// Both profile families share the schemes, so a TPO and a volume profile on
// one chart can be given the same look.
assert.ok(
  /isTpoIndicator\(settingsDefinition\.id\)\s+\) && isVolumeProfileGradientActive/.test(control),
  "TPO must share the gradient schemes with the volume profiles",
);
const tpo = readFileSync("src/lib/tpo/primitive.ts", "utf8");
assert.match(tpo, /resolveVolumeProfileGradient\(settings\.gradientPreset\)/);
assert.match(tpo, /context\.fillStyle = schemeFill \?\? cellColor;/);

rmSync(outDir, { recursive: true, force: true });
console.log("volume profile gradients: 8/8 checks passed");
