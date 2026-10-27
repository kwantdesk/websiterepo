import {parentLiquidityCatalogRows} from '../public/heatmap-app/src/live-market.js';
import {priceScaleRows, priceWheelFactor, MIN_VISIBLE_PRICE_ROWS} from '../public/heatmap-app/src/price-scale.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SYMBOLS} from '../public/heatmap-app/src/market-simulator.js';
const renderer=fs.readFileSync(new URL('../public/heatmap-app/src/renderer.js',import.meta.url),'utf8');
const begin=renderer.indexOf('    const rowTicks =');
const end=renderer.indexOf(';',renderer.indexOf('    const visibleTickSpan =',begin))+1;
const spanFor=new Function('view','config','priceScaleRows',renderer.slice(begin,end)+';return visibleTickSpan;');
test('ES renderer honors the first price-axis zoom below its 45-row default',()=>{
 const rows=SYMBOLS.ES.defaultVisibleRows*.88;
 assert.equal(spanFor({visibleRows:rows,aggregation:1},SYMBOLS.ES,value=>value),rows);
});

const main=fs.readFileSync(new URL('../public/heatmap-app/src/main.js',import.meta.url),'utf8');
const zoomBody=main.slice(main.indexOf('  #zoom('),main.indexOf('  #keyDown(')).trim().replace('#zoom','function').replaceAll('this.#updatePlaybackUi','this.updatePlaybackUi');
const zoom=new Function('SYMBOLS','priceScaleRows','ABSOLUTE_MIN_TIME_COLUMN_PIXELS','return '+zoomBody)(SYMBOLS,priceScaleRows,.02);
test('actual zoom controller and renderer share tick-scale limits for ES NQ and gold',()=>{
 for(const symbol of ['ES','NQ','GC']){
 const view={visibleRows:SYMBOLS[symbol].defaultVisibleRows,columnPixels:1.24,aggregation:1,centerTick:null};
 const state={symbol,view,settings:{autoCenter:true},renderer:{layout:{dataWidth:600,plotWidth:600,plotHeight:400,tickForY:()=>1000}},requestRender:()=>{}};
 for(let i=0;i<50;i++){
 zoom.call(state,.88,null,{price:true,time:false});
 assert.equal(spanFor(view,SYMBOLS[symbol],priceScaleRows),view.visibleRows);
 assert.equal(view.columnPixels,1.24,'price rail must not alter time density');
 }
 assert.equal(view.visibleRows,MIN_VISIBLE_PRICE_ROWS);
 assert.equal(view.visibleRows*SYMBOLS[symbol].tickSize,symbol==='GC'?.8:2);
 zoom.call(state,1.12,null,{price:true,time:false});assert.ok(view.visibleRows>MIN_VISIBLE_PRICE_ROWS);
 }
});
test('price wheel respects trackpad magnitude and ignores horizontal-only input',()=>{
 assert.equal(priceWheelFactor({deltaY:0,deltaX:100}),1);
 assert.ok(priceWheelFactor({deltaY:-1})>priceWheelFactor({deltaY:-100}));
 assert.equal(priceWheelFactor({deltaY:1,deltaMode:1}),priceWheelFactor({deltaY:16}));
 assert.ok(Math.abs(priceWheelFactor({deltaY:100})*priceWheelFactor({deltaY:-100})-1)<1e-12);
});

test('parent catalog cannot be overwritten by later micro entries or mismatched contracts',()=>{
 const rows=[{root:'ES',contractSymbol:'ESZ6'},{root:'NQ',contractSymbol:'NQZ6'},{root:'GC',contractSymbol:'GCZ6'},
 {root:'MES',contractSymbol:'MESZ6'},{root:'MNQ',contractSymbol:'MNQZ6'},{root:'MGC',contractSymbol:'MGCZ6'},
 {root:'ES',contractSymbol:'MESZ6'}];
 assert.deepEqual(parentLiquidityCatalogRows(rows).map(row=>row.contractSymbol),['ESZ6','NQZ6','GCZ6']);
 assert.deepEqual(parentLiquidityCatalogRows([...rows].reverse()).map(row=>row.contractSymbol),['GCZ6','NQZ6','ESZ6']);
});
