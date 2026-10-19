import assert from "node:assert/strict";
import test from "node:test";
import {themePresets, RETAINED_THEME_NAMES} from "../src/lib/themePresets.ts";
import {defaultTheme} from "../src/lib/theme.ts";
import {parseResolvedColor} from "../src/lib/readableContrast.ts";

test("kept palettes retain complete app and chart colour tokens", () => {
  for(const preset of themePresets){
    assert.deepEqual(Object.keys(preset.colors).sort(),Object.keys(defaultTheme).sort(),preset.name);
    for(const [role,value] of Object.entries(preset.colors)){
      if(role==="crosshairColor") assert.match(value,/^(#[0-9a-f]{8}|rgba?\()/i);
      else assert.ok(parseResolvedColor(value),preset.name+" "+role);
    }
    assert.notEqual(preset.colors.foreground,preset.colors.background);
    assert.notEqual(preset.colors.candleUp,preset.colors.candleDown);
    assert.equal(preset.colors.candleUpBorder,preset.colors.candleUp);
    assert.equal(preset.colors.candleDownBorder,preset.colors.candleDown);
  }
});
test("foundation themes and the existing Mono Protocol reset default remain unchanged", () => {
  assert.deepEqual(themePresets.slice(0,3).map(p=>p.name),[...RETAINED_THEME_NAMES]);
  assert.deepEqual(themePresets.find(p=>p.name==="Mono Protocol").colors,defaultTheme);
});
