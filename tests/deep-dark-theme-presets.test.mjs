import assert from "node:assert/strict";
import test from "node:test";
import {themePresets, DEEP_DARK_THEME_NAMES, NEW_THEME_COUNT, RETAINED_THEME_NAMES} from "../src/lib/themePresets.ts";
import {contrastRatio, parseResolvedColor} from "../src/lib/readableContrast.ts";

const added=themePresets.filter(p=>DEEP_DARK_THEME_NAMES.includes(p.name));
const ratio=(a,b)=>contrastRatio(parseResolvedColor(a),parseResolvedColor(b));
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const hue=hex=>{
  const [r,g,b]=rgb(hex),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  if(d<.08)return null;
  return ((max===r?(g-b)/d:max===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360;
};
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
      const neutral=(name==="Arctic Chrome" && ["primary","candleUp"].includes(role))
        || (name==="Blood Moon" && ["secondary","candleUp"].includes(role));
      assert.ok(neutral || saturation>=.65,`${name} ${role} must be saturated or intentionally chrome/white`);
      assert.ok(high>=.75,`${name} ${role} must have vivid highlights`);
    }
    assert.notEqual(c.candleUp,c.candleDown,`${name} candle directions`);
    assert.equal(c.candleUpBorder,c.candleUp);
    assert.equal(c.candleDownBorder,c.candleDown);
  }
});

test("only one theme uses purple; the collection spans distinct colour families",()=>{
  const families=new Map();
  for(const {name,colors} of added){
    for(const role of ["background","panel","surface","card","primary","secondary","candleUp","candleDown"]){
      const h=hue(colors[role]);
      if(h!==null && h>=250 && h<=305)assert.equal(name,"Velvet Voltage",`${name} ${role} reintroduces purple`);
    }
    const h=hue(colors.primary),family=h===null?"chrome":Math.floor(h/30);
    families.set(family,(families.get(family)??0)+1);
  }
  assert.ok(families.size>=10,"need a broad colour spectrum, not renamed variants");
  assert.ok(Math.max(...families.values())<=4,"one colour family must not dominate the collection");
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
