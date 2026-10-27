import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';import vm from 'node:vm';
const chart=fs.readFileSync(new URL('../src/components/Chart.tsx',import.meta.url),'utf8');
const workspace=fs.readFileSync(new URL('../src/components/KwantifyWorkspace.tsx',import.meta.url),'utf8');
function compile(source,start,end,name,globals={}){const text=source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));const js=ts.transpileModule(text+';globalThis.result='+name,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;const context={...globals};vm.runInNewContext(js,context);return context.result;}
const format=compile(workspace,'function formatPrice(','const LiveWatchlistNumbers','formatPrice',{displayCmeSymbol:s=>s});
const spec=compile(chart,'function getPriceFormat(','function withAlpha(','getPriceFormat');
test('watchlist preserves every ES and NQ quarter tick and gold tenth',()=>{
 for(const symbol of ['ES','MES','NQ','MNQ'])for(const price of [6387,6387.25,6387.5,6387.75])assert.equal(format(price,symbol),price.toFixed(2));
 assert.equal(format(3400.1,'GC'),'3400.1');assert.equal(format(44500,'YM'),'44500');
});
test('normal chart price scales use their own futures tick increments',()=>{
 for(const symbol of ['ES','ESZ6','NQ','MNQ'])assert.equal(spec(symbol).minMove,.25);
 for(const symbol of ['RTY','M2K','GC','MGC'])assert.equal(spec(symbol).minMove,.1);
 assert.equal(spec('YM').minMove,1);
});
