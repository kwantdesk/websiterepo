import test from 'node:test';import assert from 'node:assert/strict';
import vm from 'node:vm';
import {scopedFuturesContract,futuresInstrumentRoot} from '../src/lib/futuresInstrumentIdentity.ts';
import {futuresVenue} from '../src/lib/futuresVenue.ts';
import fs from 'node:fs';
const catalogSource=fs.readFileSync(new URL('../src/lib/databento.ts',import.meta.url),'utf8');
const DATABENTO_FUTURES=vm.runInNewContext(catalogSource.match(/export const DATABENTO_FUTURES[^=]*= (\[[\s\S]*?\n\]);/)[1]);
for(const product of DATABENTO_FUTURES)test('product identity remains isolated: '+product.symbol,()=>{
 const root=futuresInstrumentRoot(product.symbol),contract=root+'Z6';
 assert.equal(scopedFuturesContract(product.symbol,contract),contract);
 assert.equal(scopedFuturesContract(product.symbol,root==='NQ'?'GCZ6':'NQZ6'),null);
 assert.equal(futuresVenue(product.symbol),product.venue);
});
test('micro charts do not inherit the parent contract or preceding instrument',()=>{
 assert.equal(scopedFuturesContract('MGC.v.0','GCZ6'),null);assert.equal(scopedFuturesContract('GC.v.0','NQZ6'),null);assert.equal(scopedFuturesContract('NQ.v.0','MNQZ6'),null);
 assert.equal(scopedFuturesContract('GC.v.0','GCZ26'),'GCZ26');assert.equal(scopedFuturesContract('GC.v.0',null),null);
});
test('a reused chart scopes contract state during render and ignores mismatched live callbacks',()=>{
 const source=fs.readFileSync(new URL('../src/components/KwantifyWorkspace.tsx',import.meta.url),'utf8');
 assert.ok(source.includes('const resolvedContractSymbol = scopedFuturesContract(pane.symbol, resolvedContractCandidate)'));
 assert.ok(source.includes('usingDatabentoPaneFeed && price.contractSymbol && !scopedFuturesContract(pane.symbol, price.contractSymbol)'));
 assert.ok(source.includes('!scopedFuturesContract(symbol, contractSymbol) || isEventBasedChartInterval'));
});
