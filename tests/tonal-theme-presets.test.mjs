import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {themePresets} from '../src/lib/themePresets.ts';

const names=['Molten Copper','Amber Vault','Acid Gold','Lime Obsidian','Emerald Depths','Jade Current','Arctic Cyan','Indigo Night','Violet Noir','Magenta Ink'];
const hue=hex=>{
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const high=Math.max(r,g,b),low=Math.min(r,g,b),delta=high-low;
  assert.ok(delta>0,'tonal palette must be chromatic');
  return ((high===r?(g-b)/delta:high===g?(b-r)/delta+2:(r-g)/delta+4)*60+360)%360;
};
const distance=(a,b)=>Math.min(Math.abs(a-b),360-Math.abs(a-b));

test('ten single-family themes are appended without replacing the previous catalogue',()=>{
  assert.equal(themePresets.length,43);
  assert.deepEqual(themePresets.slice(33).map(p=>p.name),names);
  assert.equal(createHash('sha256').update(JSON.stringify(themePresets.slice(0,33))).digest('hex'),'eb6df934441c19c001b7f6d40a92e3754bd0803a52894a581873714505db6a2f');
});

test('each tonal theme uses one hue for shell, controls, candles and its five swatches',()=>{
  const extras=themePresets.slice(33);
  for(const {name,colors,swatches} of extras){
    assert.equal(swatches.length,5,name);
    const anchor=hue(colors.primary);
    for(const key of ['background','panel','surface','card','foreground','secondary','accent','muted','border','danger','gridColor','candleUp','candleDown']){
      assert.ok(distance(anchor,hue(colors[key]))<8,`${name} ${key} must stay in its own colour family`);
    }
    for(const swatch of swatches)assert.ok(distance(anchor,hue(swatch))<8,name);
    assert.notEqual(colors.candleUp,colors.candleDown,name);
  }
  for(let i=0;i<extras.length;i++)for(let j=i+1;j<extras.length;j++){
    assert.ok(distance(hue(extras[i].colors.primary),hue(extras[j].colors.primary))>=17,'each new theme needs a distinct dominant hue');
  }
});
