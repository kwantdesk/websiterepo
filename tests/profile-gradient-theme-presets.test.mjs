import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {themePresets, PROFILE_GRADIENT_THEME_NAMES} from "../src/lib/themePresets.ts";
import {VOLUME_PROFILE_GRADIENTS} from "../src/lib/volumeProfileGradients.ts";
import {contrastRatio, parseResolvedColor} from "../src/lib/readableContrast.ts";
import {defaultTheme} from "../src/lib/theme.ts";

const ratio=(a,b)=>contrastRatio(parseResolvedColor(a),parseResolvedColor(b));
test("every profile colour scheme is selectable as a theme, with no Off or duplicate Chromey Mono",()=>{
  assert.equal(VOLUME_PROFILE_GRADIENTS.length,12);
  assert.equal(themePresets.length,75);
  assert.equal(new Set(themePresets.map(p=>p.name)).size,75);
  assert.equal(themePresets.filter(p=>p.name==="Chromey Mono").length,1);
  assert.ok(!themePresets.some(p=>p.name.toLowerCase()==="off"));
  assert.deepEqual(PROFILE_GRADIENT_THEME_NAMES,VOLUME_PROFILE_GRADIENTS.map(g=>g.label));
  for(const gradient of VOLUME_PROFILE_GRADIENTS){
    const preset=themePresets.find(p=>p.name===gradient.label);
    assert.ok(preset,gradient.label);
    assert.equal(preset.profileGradient,gradient,"preview must use the shared scheme object");
    if(gradient.id==="chromey-mono"){
      assert.equal(preset.colors.primary,gradient.to);
      assert.equal(preset.colors.danger,gradient.from);
    }else{
      assert.equal(preset.colors.candleUp,gradient.to);
      assert.equal(preset.colors.candleDown,gradient.from);
      assert.equal(preset.colors.accent,gradient.from);
      assert.deepEqual(Object.keys(preset.colors).sort(),Object.keys(defaultTheme).sort());
    }
  }
});

test("new gradient themes retain exact chart colours with readable controls and candle outlines",()=>{
  for(const preset of themePresets.filter(p=>p.profileGradient && p.name!=="Chromey Mono")){
    const c=preset.colors;
    for(const role of ["background","chartBackground","panel","card","surface"]){
      assert.ok(ratio(c.foreground,c[role])>=7,`${preset.name} text on ${role}`);
      for(const ink of ["primary","secondary","muted","danger"])
        assert.ok(ratio(c[ink],c[role])>=4.5,`${preset.name} ${ink} on ${role}`);
      for(const outline of ["candleUpBorder","candleDownBorder"])
        assert.ok(ratio(c[outline],c[role])>=3,`${preset.name} ${outline} on ${role}`);
    }
  }
  const mono=themePresets.find(p=>p.name==="Black → White").colors;
  assert.equal(mono.candleDown,"#0A0A0A");
  assert.notEqual(mono.candleDownBorder,mono.candleDown);
});

test("theme picker renders the requested shared gradient strip and retains its existing apply path",()=>{
  const source=readFileSync(new URL("../src/components/KwantifySettingsWorkspace.tsx",import.meta.url),"utf8");
  assert.match(source,/preset\.profileGradient \?/);
  assert.match(source,/linear-gradient\(90deg, \$\{preset\.profileGradient\.from\}, \$\{preset\.profileGradient\.to\}\)/);
  assert.match(source,/onClick=\{\(\) => applyThemePreset\(preset\.colors\)\}/);
});
