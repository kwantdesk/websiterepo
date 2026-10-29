import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {restoreLegacyDisplay,DISPLAY_BACKUP_KEY,DISPLAY_ROLLBACK} from '../public/heatmap-app/src/display-rollback.js';
function storage(initial={}) { const rows=new Map(Object.entries(initial)); return {getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),rows}; }
const defaults={palette:'auto',trails:true,domVisible:true,domRestingSellVisible:true,domRestingBuyVisible:true,circleSize:40};
test('rollback restores display while preserving exact backup and unrelated study values',()=>{
 const saved={palette:'pink-blue',trails:false,domRestingBuyVisible:false,circleSize:87,cvdPeriod:12}; const store=storage();
 const restored=restoreLegacyDisplay(saved,defaults,store,'settings');
 assert.equal(restored.trails,true);assert.equal(restored.domRestingBuyVisible,true);assert.equal(restored.circleSize,40);assert.equal(restored.cvdPeriod,12);
 assert.deepEqual(JSON.parse(store.getItem(DISPLAY_BACKUP_KEY)),saved);assert.deepEqual(JSON.parse(store.getItem('settings')),restored);
 assert.equal(restored.displayRollback,DISPLAY_ROLLBACK);assert.equal(saved.trails,false);
});
test('later deliberate appearance changes survive every subsequent reload',()=>{
 const store=storage();const first=restoreLegacyDisplay({palette:'pink-blue'},defaults,store,'settings');
 const changed={...first,palette:'thermal',trails:false};
 assert.strictEqual(restoreLegacyDisplay(changed,defaults,store,'settings'),changed);
 assert.equal(JSON.parse(store.getItem(DISPLAY_BACKUP_KEY)).palette,'pink-blue');
});
test('storage quota failure preserves existing configuration and backup',()=>{
 const saved={palette:'ocean',trails:false};const store=storage();store.setItem=()=>{throw Error('quota')};
 assert.strictEqual(restoreLegacyDisplay(saved,defaults,store,'settings'),saved);
 const existing=storage({[DISPLAY_BACKUP_KEY]:'{"palette":"mono"}'});
 restoreLegacyDisplay(saved,defaults,existing,'settings');assert.equal(existing.getItem(DISPLAY_BACKUP_KEY),'{"palette":"mono"}');
});
test('empty or corrupt preference shapes are not migrated',()=>{
 const store=storage();for(const saved of [null,undefined,[],3,'bad'])assert.strictEqual(restoreLegacyDisplay(saved,defaults,store,'settings'),saved);
 assert.equal(store.rows.size,0);
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
