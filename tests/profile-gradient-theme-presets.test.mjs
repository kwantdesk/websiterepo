import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {themePresets} from "../src/lib/themePresets.ts";
import {VOLUME_PROFILE_GRADIENTS,resolveVolumeProfileGradient} from "../src/lib/volumeProfileGradients.ts";

test("shared colour catalogue keeps Red to Lime and retires the duplicate Chromey palette",()=>{
  assert.deepEqual(VOLUME_PROFILE_GRADIENTS.map(g=>g.id),[
    "pink-blue","yellow-blue","orange-green","red-yellow","black-white",
    "pink-purple","cyan-magenta","lime-teal","violet-amber","crimson-indigo","red-lime",
  ]);
  for(const g of VOLUME_PROFILE_GRADIENTS)assert.equal(resolveVolumeProfileGradient(g.id),g);
  assert.equal(resolveVolumeProfileGradient("off"),null);
  for (const id of ["chromey-mono", "chromeymono", "chromium-mono"])
    assert.equal(resolveVolumeProfileGradient(id)?.id, "red-lime");
  assert.ok(!themePresets.some(p=>VOLUME_PROFILE_GRADIENTS.some(g=>g.label===p.name)));
});
test("Settings uses only the curated catalogue and retains normal apply/save controls",()=>{
  const source=readFileSync(new URL("../src/components/KwantifySettingsWorkspace.tsx",import.meta.url),"utf8");
  assert.match(source,/themePresets\.map\(\(preset\) =>/);
  assert.match(source,/onClick=\{\(\) => applyThemePreset\(preset\.colors\)\}/);
  assert.doesNotMatch(source,/preset\.profileGradient/);
  assert.match(source,/onClick=\{saveThemeSettings\}/);
});
