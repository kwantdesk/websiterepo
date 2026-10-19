import assert from "node:assert/strict";
import test from "node:test";
import {themePresets, DEEP_DARK_THEME_NAMES, NEW_THEME_COUNT, RETAINED_THEME_NAMES} from "../src/lib/themePresets.ts";
import {contrastRatio, parseResolvedColor} from "../src/lib/readableContrast.ts";

const added=themePresets.filter(p=>DEEP_DARK_THEME_NAMES.includes(p.name));
const ratio=(a,b)=>contrastRatio(parseResolvedColor(a),parseResolvedColor(b));
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
test("exactly twenty additional selectable palettes retain the original collection",()=>{
  assert.equal(added.length,20);
  assert.equal(new Set(DEEP_DARK_THEME_NAMES).size,20);
  assert.equal(themePresets.length,64);
  assert.equal(NEW_THEME_COUNT,themePresets.length-RETAINED_THEME_NAMES.length);
  assert.deepEqual(added.map(p=>p.name),[...DEEP_DARK_THEME_NAMES]);
  assert.deepEqual(themePresets.slice(0,3).map(p=>p.name),[...RETAINED_THEME_NAMES]);
});

test("deep shells and saturated accents stay readable without pastel or glow effects",()=>{
  for(const {name,colors:c} of added){
    for(const role of ["background","chartBackground","panel","surface","card"]){
      assert.ok(Math.max(...rgb(c[role]))<=.24,`${name} ${role} must remain dark`);
      assert.ok(ratio(c.foreground,c[role])>=7,`${name} ${role} main text`);
      assert.ok(ratio(c.muted,c[role])>=4.5,`${name} ${role} secondary text`);
      for(const accent of ["primary","secondary","danger"])
        assert.ok(ratio(c[accent],c[role])>=4.5,`${name} ${accent} on ${role}: ${ratio(c[accent],c[role])}`);
    }
    for(const role of ["primary","secondary","candleUp","candleDown"]){
      const values=rgb(c[role]);const high=Math.max(...values),low=Math.min(...values);
      const saturation=(high-low)/(1-Math.abs(high+low-1));
      assert.ok(saturation>=.65,`${name} ${role} must be saturated`);
      assert.ok(high>=.75,`${name} ${role} must have vivid highlights`);
    }
    assert.notEqual(c.candleUp,c.candleDown,`${name} candle directions`);
    assert.equal(c.candleUpBorder,c.candleUp);
    assert.equal(c.candleDownBorder,c.candleDown);
  }
});

test("new palettes are not duplicate or near-identical colour triples",()=>{
  const roles=["background","primary","secondary"];
  for(const preset of added){
    for(const other of themePresets){
      if(preset.name===other.name)continue;
      const left=roles.flatMap(k=>rgb(preset.colors[k]));
      const right=roles.flatMap(k=>rgb(other.colors[k]));
      const distance=left.reduce((sum,v,i)=>sum+Math.abs(v-right[i]),0)/left.length;
      assert.ok(distance>.045,`${preset.name} is too close to ${other.name}: ${distance}`);
    }
  }
});
