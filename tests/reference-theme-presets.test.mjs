import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {themePresets} from '../src/lib/themePresets.ts';
import {contrastRatio,parseResolvedColor} from '../src/lib/readableContrast.ts';

const references={
  'Deep Sea':['#FFFFFF','#00171F','#003459','#007EA7','#00A8E8'],
  'Blue Lagoon':['#00A6FB','#0582CA','#006494','#003554','#051923'],
  'Sunflower Fields':['#D6D6D6','#FFEE32','#FFD100','#202020','#333533'],
  'Midnight Sky':['#27187E','#758BFD','#AEB8FE','#F1F2F6','#FF8600'],
  'Crimson Fade':['#F50538','#B6042A','#79021C','#3D010E','#000000'],
  'Sunset Sorbet':['#FB6095','#FB878E','#FBAF87','#FBD680','#FBFD79'],
};
const ratio=(a,b)=>contrastRatio(parseResolvedColor(a),parseResolvedColor(b));
function hue(hex){const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),high=Math.max(r,g,b),low=Math.min(r,g,b),d=high-low;return ((high===r?(g-b)/d:high===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360;}

test('six reference strips preserve exact sampled colours and left-to-right order',()=>{
  assert.equal(themePresets.length,33);
  for(const [name,swatches] of Object.entries(references)){
    const preset=themePresets.find(p=>p.name===name);assert.ok(preset,name);
    assert.deepEqual(preset.swatches,swatches,name);
    for(const colour of swatches)assert.ok(Object.values(preset.colors).includes(colour),name+' missing actual theme colour '+colour);
  }
});

test('ten extra palettes use distinct cross-hue accent pairs rather than monochrome copies',()=>{
  const extras=themePresets.slice(23);assert.equal(extras.length,10);
  assert.equal(new Set(extras.flatMap(p=>[p.colors.primary,p.colors.secondary])).size,20);
  assert.equal(new Set(extras.map(p=>p.colors.background)).size,10);
  for(const {name,colors} of extras){const difference=Math.abs(hue(colors.primary)-hue(colors.secondary));assert.ok(Math.min(difference,360-difference)>=35,name);}
});

test('new palette text and candle geometry colours remain readable',()=>{
  for(const {name,colors} of themePresets.slice(17)){
    for(const surface of ['background','panel','surface','card'])assert.ok(ratio(colors.foreground,colors[surface])>=4.5,name+' text on '+surface);
    for(const candle of ['candleUp','candleDown'])assert.ok(ratio(colors[candle],colors.chartBackground)>=3,name+' '+candle);
  }
});

test('the previous seventeen resolved palettes and reset default are unchanged',()=>{
  // Verified against267eab14 before recording this immutable baseline. No Git
  // history dependency, so the guard also runs in shallow clones/exported code.
  const snapshot=themePresets.slice(0,17).map(p=>[p.name,Object.entries(p.colors).sort(([a],[b])=>a.localeCompare(b))]);
  assert.equal(createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),'85cf39809b3154a28d93f68a39ae1a27fb6e6265bdda17b73763231c25a32d1e');
});
