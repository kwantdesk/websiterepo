/** Read-only audit: all current presets, all configured futures, own recordings. */
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readArchiveRecords} from '../src/archive-reader.mjs';
import {TradeTapeArchive,decodeTrade,sessionTradeFiles,readSessionTradeRecords} from '../src/trade-tape-archive.mjs';
import {createEventBarBuilder} from '../src/event-bar-builder.mjs';
import {chartTimeBucketStartMs} from '../src/chart-time-bucket.mjs';
import {loadEventBarSeed} from '../src/event-bar-seeds.mjs';
import {chicagoTradingDate,cmeSessionBounds} from '../src/trading-session.mjs';
import {basename} from 'node:path';
import {FuturesBarArchive} from '../src/futures-bar-archive.mjs';
const flag=(key,fallback)=>{const i=process.argv.indexOf('--'+key);return i>=0?process.argv[i+1]:fallback};
const root=flag('dir','/recordings'),out=flag('out','/audit/results'),catalog=JSON.parse(await readFile(flag('catalog','/audit/catalog.json'),'utf8')),contracts=JSON.parse(await readFile(flag('contracts','/audit/contracts.json'),'utf8'));
const browser=await import(pathToFileURL(flag('browser','/audit/chart-audit-browser-engine.mjs')).href);
const end=Number(flag('to',String(Date.now()))),start=end-Number(flag('days','10'))*86400000;
const foldStart=cmeSessionBounds(chicagoTradingDate(start)).startMs;
const dates=(await readdir(join(root,'trades'))).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d>=new Date(start-86400000).toISOString().slice(0,10)).sort();
const events=catalog.intervals.filter(r=>!['second','minute','time'].includes(r.kind));
const time=catalog.intervals.filter(r=>['second','minute','time'].includes(r.kind));
const history=new FuturesBarArchive({dir:root,enabled:false});await mkdir(out,{recursive:true});
for(const instrument of catalog.futures){
 const contract=contracts.find(r=>r.exchange===instrument.venue&&r.symbol.replace(/[FGHJKMNQUVXZ]\d{1,2}$/,'')===instrument.root)?.symbol;
 if(!contract)throw Error('No configured contract for '+instrument.root);
 const builders=[];for(const p of events){const seed=await loadEventBarSeed(root,instrument.venue,contract,p.id,chicagoTradingDate(start),true);builders.push({preset:p,builder:createEventBarBuilder(p.id,contract,64,seed)});}
 const seconds=time.map(p=>({preset:p,buckets:new Set()})),tail=[],minutes=new Set();let count=0,classified=0,first=null,last=null,previous=-Infinity,outOfOrder=0;
 const files=[];for(const date of dates)for(const file of sessionTradeFiles(join(root,'trades'),date,instrument.venue,contract,true))files.push(file);
 for(const file of files)await readSessionTradeRecords(file,contract,true,row=>{
  const t=decodeTrade(row);if(!t||t.timestamp<foldStart||t.timestamp>end)return;
  count++;if(t.side)classified++;if(t.timestamp<previous)outOfOrder++;previous=Math.max(previous,t.timestamp);
  first=first===null?t.timestamp:Math.min(first,t.timestamp);last=last===null?t.timestamp:Math.max(last,t.timestamp);minutes.add(Math.floor(t.timestamp/60000)*60000);
  const trade={timestamp:t.timestamp,price:t.price,size:t.size,trades:1,delta:t.side>0?t.size:t.side<0?-t.size:0,contractSymbol:basename(file).slice(instrument.venue.length+1).split('.')[0]};
  for(const {builder}of builders)builder.add(trade);
  for(const p of seconds)p.buckets.add(chartTimeBucketStartMs(t.timestamp,p.preset.id));
  tail.push(trade);if(tail.length>512)tail.shift();
 });
 const owned=await history.load({exchange:instrument.venue,symbol:contract,interval:'1m',fromMs:start,toMs:end,limit:500000});
 const missing=(owned.candles||[]).filter(c=>!minutes.has(c.timestamp));
 const rows=[];
 for(const {preset,builder}of builders){
  const expected=createEventBarBuilder(preset.id,contract,4096);for(const row of tail)expected.add(row);let live=[];
  for(let i=0;i<tail.length;i+=17)live=browser.applyMarketTradesToEventBars(live,tail.slice(i,i+17),preset.id,contract,4096);
  const parity=JSON.stringify(expected.finish())===JSON.stringify(live);
  const valid=builder.finish().every(b=>b.high>=Math.max(b.open,b.close)&&b.low<=Math.min(b.open,b.close)&&b.sourceStartTimestamp<=b.sourceEndTimestamp);
  rows.push({interval:preset.id,kind:preset.kind,barCount:builder.totalBarCount,withinServingLimit:builder.totalBarCount<=500000,historyAccess:builder.totalBarCount>50000?"paged owned tape":"single page",liveContinuationParity:parity,validTailGeometry:valid,classifiedDataAvailable:preset.kind!=='delta'||classified>0});
  if(!parity||!valid)throw Error(instrument.root+' '+preset.id+' parity/geometry failure');
 }
 for(const p of seconds)rows.push({interval:p.preset.id,kind:p.preset.kind,barCount:p.buckets.size,withinServingLimit:p.buckets.size<=500000,bucketSource:'owned executions'});
 const result={instrument:instrument.root,contract,exchange:instrument.venue,requestedStart:start,requestedEnd:end,files:files.length,sourceRecordCount:count,classifiedRecordCount:classified,outOfOrder,availableStart:first,availableEnd:last,ownedMinuteBars:owned.candles.length,executionMinutes:minutes.size,recordedMinutesWithoutCompactTape:missing.length,firstMissingMinute:missing[0]?.timestamp??null,rows};
 await writeFile(join(out,instrument.root+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({root:instrument.root,prints:count,missingTapeMinutes:missing.length,presets:rows.length}));
}
