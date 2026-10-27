import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {VOLUME_PROFILE_GRADIENTS} from '../src/lib/volumeProfileGradients.ts';
import {FOOTPRINT_PALETTES,PALETTES,PALETTE_ACCENTS,paletteLut,paletteCssGradient,paletteRenderKey} from '../public/heatmap-app/src/palettes.js';
import {writeHeatRgba} from '../public/heatmap-app/src/heat-raster.js';
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
test('Liquidity Map and footprint share the complete canonical scheme definitions',()=>{assert.equal(FOOTPRINT_PALETTES.length,12);assert.deepEqual(FOOTPRINT_PALETTES,VOLUME_PROFILE_GRADIENTS);assert.ok(PALETTES.thermal);assert.ok(PALETTES.chromeymono)});
for(const scheme of VOLUME_PROFILE_GRADIENTS)test('actual heat raster renders footprint palette '+scheme.label,()=>{
 const lut=paletteLut(scheme.id);assert.equal(lut.length,768);assert.deepEqual([...lut.slice(51*3,51*3+3)],rgb(scheme.from));assert.deepEqual([...lut.slice(255*3)],rgb(scheme.to));
 assert.deepEqual(PALETTE_ACCENTS[scheme.id].bid,rgb(scheme.to));assert.deepEqual(PALETTE_ACCENTS[scheme.id].ask,rgb(scheme.from));assert.equal(paletteRenderKey(scheme.id),scheme.id);
 const pixels=new Uint8ClampedArray(4);writeHeatRgba({width:1,height:1,intensities:new Uint8Array([255])},lut,0,1,1,pixels);assert.deepEqual([...pixels],[...rgb(scheme.to),255]);assert.match(paletteCssGradient(scheme.id),/linear-gradient/);
});
test('options are populated before the existing styled picker and saved selections are restored',()=>{
 const main=fs.readFileSync(new URL('../public/heatmap-app/src/main.js',import.meta.url),'utf8');assert.ok(main.indexOf("footprintPalettes.label = 'Footprint palettes'")<main.indexOf('this.#enhanceInspectorSelects();'));assert.ok(main.includes('option.value = scheme.id'));assert.ok(main.includes('this.settings.palette = event.target.value'));assert.ok(main.includes("localStorage.setItem(LIQUIDITY_MAP_SETTINGS_KEY, JSON.stringify(saved))"));assert.ok(main.includes('paletteCssGradient(option.value)'));
});

