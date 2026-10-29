import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {restoreLegacyDisplay,DISPLAY_BACKUP_KEY,DISPLAY_ROLLBACK} from '../public/heatmap-app/src/display-rollback.js';
function storage(initial={}) { const rows=new Map(Object.entries(initial)); return {getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),rows}; }
const defaults={palette:'auto',trails:true,domVisible:true,domRestingSellVisible:true,domRestingBuyVisible:true,circleSize:40};
test('untouched custom settings are never reset to stock display defaults',()=>{
 const saved={palette:'thermal',trails:true,circleSize:87};const store=storage();
 assert.strictEqual(restoreLegacyDisplay(saved,defaults,store,'settings'),saved);assert.equal(store.rows.size,0);
});
test('restore original palette and display choices from backup; preserve later edits and unrelated studies',()=>{
 const backup={palette:'thermal',trails:true,domVisible:true,domRestingSellVisible:true,domRestingBuyVisible:true,circleSize:87,cvdPeriod:12};
 const saved={...defaults,circleSize:55,cvdPeriod:20,displayRollback:'20261029-oct25'};
 const store=storage({[DISPLAY_BACKUP_KEY]:JSON.stringify(backup)});const restored=restoreLegacyDisplay(saved,defaults,store,'settings');
 assert.equal(restored.palette,'thermal');assert.equal(restored.circleSize,55);assert.equal(restored.cvdPeriod,20);
 assert.equal(restored.displayRollback,DISPLAY_ROLLBACK);assert.deepEqual(JSON.parse(store.getItem(DISPLAY_BACKUP_KEY)),backup);
 const edited={...restored,palette:'auto'};assert.strictEqual(restoreLegacyDisplay(edited,defaults,store,'settings'),edited);
});
test('storage refusal, missing/corrupt backup and invalid shapes do not guess original settings',()=>{
 for(const raw of [null,'bad','[]','null']){
  const store=storage(raw?{[DISPLAY_BACKUP_KEY]:raw}:{}),saved={...defaults,displayRollback:'20261029-oct25'};
  assert.strictEqual(restoreLegacyDisplay(saved,defaults,store,'settings'),saved);
 }
 const saved={...defaults,displayRollback:'20261029-oct25'},store=storage({[DISPLAY_BACKUP_KEY]:'{"palette":"thermal"}'});
 store.setItem=()=>{throw Error('quota')};assert.strictEqual(restoreLegacyDisplay(saved,defaults,store,'settings'),saved);
 for(const input of [null,undefined,[],3,'bad'])assert.strictEqual(restoreLegacyDisplay(input,defaults,storage(),'settings'),input);
});
const main=readFileSync(new URL('../public/heatmap-app/src/main.js',import.meta.url),'utf8');
test('saved settings carry rollback receipt so normal user changes are not reset again',()=>{
 assert.ok(main.includes('...this.settings, displayRollback: DISPLAY_ROLLBACK'));
 assert.ok(main.includes('LIQUIDITY_MAP_DISPLAY_DEFAULTS, localStorage, LIQUIDITY_MAP_SETTINGS_KEY'));
});
test('both bid/ask trail painting and complete DOM painter match the 25 October revision',()=>{
 const previous=execFileSync('git',['show','4065cc10:public/heatmap-app/src/renderer.js'],{encoding:'utf8'}).replaceAll('\r\n','\n');
 const current=readFileSync(new URL('../public/heatmap-app/src/renderer.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
 for(const [start,end] of [['  #drawInsideMarket(', '  #drawTrades('],['  #drawPriceAxis(', '  #drawTimeAxis(']]) {
  const section=text=>text.slice(text.indexOf(start),text.indexOf(end));
  assert.ok(previous.includes(start)&&previous.includes(end));assert.equal(section(current),section(previous));
 }
});
test('every original saved footprint palette resolves to its own heat scale rather than a fallback',async()=>{
 const {FOOTPRINT_PALETTES,PALETTES,paletteLut}=await import('../public/heatmap-app/src/palettes.js');
 for(const scheme of FOOTPRINT_PALETTES){
  const store=storage({[DISPLAY_BACKUP_KEY]:JSON.stringify({palette:scheme.id})});
  const restored=restoreLegacyDisplay({...defaults,displayRollback:'20261029-oct25'},defaults,store,'settings');
  assert.equal(restored.palette,scheme.id);assert.ok(PALETTES[restored.palette]);
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  assert.deepEqual([...paletteLut(restored.palette).slice(255*3)],rgb(scheme.to));
 }
});
