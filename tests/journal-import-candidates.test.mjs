import test from 'node:test';
import assert from 'node:assert/strict';
import {journalImportableTrades} from '../src/lib/journalImportCandidates.ts';

const trade=(id,account,fingerprint=id,extra={})=>({id,account,fingerprint,sourceImportId:'file:'+id,...extra});
test('picker excludes canonical copies and matching file imports already in the destination',()=>{
 const source=trade('original','Source','same-file-trade');
 const existing=trade('different-import-id','Review','same-file-trade');
 assert.deepEqual(journalImportableTrades([source,existing],'Review'),[]);
 const copy=trade('copy-id','Review','old-fingerprint',{journalCopy:{originalTradeId:'original'}});
 assert.deepEqual(journalImportableTrades([source,copy],'Review'),[]);
});
test('duplicate outcomes across source journals are offered once, but other destinations remain independent',()=>{
 const a=trade('one','A','same'),b=trade('two','B','same'),c=trade('three','A','unique');
 assert.deepEqual(journalImportableTrades([a,b,c],'Review').map(t=>t.id),['one','three']);
 assert.deepEqual(journalImportableTrades([a,b,c,trade('existing','Review','same')],'Other').map(t=>t.id),['one','three']);
});
test('legacy empty fingerprints do not collapse unrelated trades, and source records stay unchanged',()=>{
 const trades=[trade('a','Source',''),trade('b','Source',''),trade('c','Review','')];const before=JSON.stringify(trades);
 assert.deepEqual(journalImportableTrades(trades,'Review').map(t=>t.id),['a','b']);assert.equal(JSON.stringify(trades),before);
});
test('receiving an import while the picker is open removes its eligible selection immediately',()=>{
 const source=trade('a','Source','same');let trades=[source];const selected=['a'];
 assert.deepEqual(selected.filter(id=>journalImportableTrades(trades,'Review').some(t=>t.id===id)),['a']);
 trades=[...trades,trade('new-copy','Review','same',{journalCopy:{originalTradeId:'a'}})];
 assert.deepEqual(selected.filter(id=>journalImportableTrades(trades,'Review').some(t=>t.id===id)),[]);
});
