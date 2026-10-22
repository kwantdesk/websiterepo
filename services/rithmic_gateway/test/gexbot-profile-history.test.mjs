import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {createProfileHistory} from '../src/gexbot-profile-history.mjs';
import {decodeEodRows} from '../src/gexbot-eod-session.mjs';
const selection={ticker:'QQQ',package:'state',category:'gamma_zero',date:'2026-10-21'};
test('streaming JSON rows preserve nested arrays, escapes, Unicode and chunk boundaries',async()=>{
 const rows=[{ticker:'QQQ',timestamp:1792612800,mini_contracts:[[1,2,[3,4]]],name:'"x\\y\nü😀'}, {ticker:'QQQ',timestamp:1792612801,spot:null}];
 const bytes=Buffer.from(JSON.stringify(rows)),result=[];
 for await(const row of decodeEodRows(Readable.from(Array.from(bytes,byte=>Buffer.from([byte])))))result.push(row);
 assert.deepEqual(result,rows);
});
test('streaming JSON rejects truncated, non-array, trailing and malformed documents',async()=>{
 for(const text of ['{}','[{"x":1}', '[{},]', '[{}]{}','[1]','[{bad}]'])await assert.rejects(async()=>{for await(const row of decodeEodRows(Readable.from([Buffer.from(text)])))void row;});
});
test('profile replay pages preserve every original row and full timeline without massive browser payload',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'kwanty-profile-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const rows=Array.from({length:550},(_,i)=>({ticker:'QQQ',timestamp:1792589480+i,spot:700+i/100,major_positive:i,mini_contracts:[[700,1,-2,[i,0,0]]]}));let parses=0;
 const store=createProfileHistory({dir,eod:{archivePath:async()=>'/exact-source.zip'},extract:async(path,selected,{onRow})=>{assert.equal(path,'/exact-source.zip');assert.deepEqual(selected,selection);parses++;for(const row of rows)await onRow(row);}});
 const manifest=await store.read(selection);assert.equal(manifest.data.length,550);assert.equal(manifest.profilePages.length,3);assert.equal(manifest.data[0].mini_contracts,undefined);assert.equal(manifest.data.at(-1).timestamp,rows.at(-1).timestamp);
 const restored=[];for(let page=0;page<3;page++)restored.push(...(await store.read(selection,String(page))).data);assert.deepEqual(restored,rows);assert.equal(parses,1);
 await assert.rejects(store.read(selection,'../1'));await assert.rejects(store.read(selection,'3'));await assert.rejects(store.read({...selection,ticker:'../../secret'}));
});
