/** Materialise all requested interval seeds in one pass through owned tape. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {eventSeedInputs,saveEventSeed,eventSeedFile} from '../src/event-bar-seeds.mjs';
import {createEventBarBuilder} from '../src/event-bar-builder.mjs';
import {readArchiveRecords} from '../src/archive-reader.mjs';
import {decodeTrade,readOrderedEventTradeRecords} from '../src/trade-tape-archive.mjs';
import {chicagoTradingDate} from '../src/trading-session.mjs';
const flag=(key,fallback)=>{const i=process.argv.indexOf('--'+key);return i>=0?process.argv[i+1]:fallback};
const dir=flag('dir','/recordings'),catalog=JSON.parse(await readFile(flag('catalog','/audit/catalog.json'),'utf8')),contracts=JSON.parse(await readFile(flag('contracts','/audit/contracts.json'),'utf8'));
const first=flag('anchor',chicagoTradingDate(Date.now()-10*86400000));const second=new Date(Date.parse(first+'T12:00:00Z')+86400000).toISOString().slice(0,10),targets=[first,second];
const intervals=catalog.intervals.filter(r=>!['second','minute','time'].includes(r.kind)).map(r=>r.id);
for(const instrument of catalog.futures){
 const symbol=contracts.find(r=>r.exchange===instrument.venue&&r.symbol.replace(/[FGHJKMNQUVXZ]\d{1,2}$/,'')===instrument.root)?.symbol;if(!symbol)throw Error('Missing contract '+instrument.root);
 const inputByDate=new Map();for(const date of targets)inputByDate.set(date,await eventSeedInputs(dir,instrument.venue,symbol,date,true));
 let already=true;for(const date of targets)for(const interval of intervals){const previous=await readFile(eventSeedFile(dir,instrument.venue,symbol,interval,date,true),'utf8').then(JSON.parse).catch(()=>null);if(previous?.fingerprint!==inputByDate.get(date).fingerprint)already=false}
 if(already){console.log(JSON.stringify({root:instrument.root,status:'already-warm'}));continue}
 const builders=intervals.map(interval=>({interval,builder:createEventBarBuilder(interval,symbol,1)}));let index=0,prints=0;
 const save=async date=>{for(const {interval,builder}of builders)await saveEventSeed(dir,instrument.venue,symbol,interval,date,inputByDate.get(date).fingerprint,builder.finish().at(-1)??null,true)};
 for(const file of inputByDate.get(second).files){const date=file.split(/[\\/]/).at(-2);while(index<targets.length&&targets[index]<=date)await save(targets[index++]);
  const contractSymbol=file.split(/[\\/]/).at(-1).split('.')[0].slice(instrument.venue.length+1);
  await readOrderedEventTradeRecords(file,symbol,true,row=>{const t=decodeTrade(row);if(!t)return;const record={timestamp:t.timestamp,price:t.price,size:t.size,trades:1,delta:t.side>0?t.size:t.side<0?-t.size:0,contractSymbol};for(const {builder}of builders)builder.add(record);prints++});
 }
 while(index<targets.length)await save(targets[index++]);console.log(JSON.stringify({root:instrument.root,prints,intervals:intervals.length,anchors:targets}));
}
