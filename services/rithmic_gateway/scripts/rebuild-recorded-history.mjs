import { readdir, readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FuturesBarArchive, tradeFromRecord } from '../src/futures-bar-archive.mjs';
import { readArchiveRecords } from '../src/archive-reader.mjs';
import { chicagoTradingDate } from '../src/trading-session.mjs';
import { RecordedCashHistory } from '../src/recorded-cash-history.mjs';
import { __test as cashQuotes } from '../src/quantdata-market-snapshot-stream.mjs';

/** Offline recovery from OUR recordings. This module has no history-provider client. */
export async function rebuildRecordedHistory({dir='/recordings',days=9,now=Date.now(),apply=false,rawByteBudget=2*1024**3}={}){
 if(!Number.isInteger(days)||days<1||days>30)throw Error('Recorded recovery window must be 1–30 days');
 const cutoff=new Date(now-days*86400000).toISOString().slice(0,10),receipt={at:new Date(now).toISOString(),source:'VPS live recordings only',futures:[],cashResponses:0,rawBytes:0};
 const maintenance=join(dir,'recording-maintenance'),checkpoint=await readFile(join(maintenance,'checkpoint.json'),'utf8').then(JSON.parse).catch(()=>({}));
 const currentTradingDate=chicagoTradingDate(now);
 const tapeDir=join(dir,'trades'),dates=(await readdir(tapeDir).catch(()=>[])).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d>=cutoff&&d<currentTradingDate).sort();
 for(const date of dates){
  const groups=new Map();for(const name of await readdir(join(tapeDir,date))){const m=name.match(/^([A-Z0-9]+)-([A-Z0-9]+)\.trades(?:\.backfill)?\.ndjson\.gz$/i);if(!m)continue;const key=m[1]+':'+m[2];if(!groups.has(key))groups.set(key,[]);groups.get(key).push(name)}
  for(const[key,names]of groups){const[exchange,symbol]=key.split(':'),file=join(dir,'bars',date,exchange+'-'+symbol+'.json');
   const existing=await readFile(file,'utf8').then(JSON.parse).catch(()=>null);
   const ownedMinutes=new Set(existing&&!/history\s*plant|provider[- ]import/i.test(String(existing.source||''))?(existing.bars||[]).map(b=>b[0]):[]);
   const identity=date+':'+key,sourceStats=await Promise.all(names.sort().map(async name=>{const info=await stat(join(tapeDir,date,name));return[name,info.size,info.mtimeMs]})),fingerprint=JSON.stringify(sourceStats);
   if(ownedMinutes.size&&checkpoint[identity]===fingerprint){receipt.futures.push({date,exchange,symbol,status:'checked-owned-unchanged'});continue}
   const bytes=sourceStats.reduce((n,row)=>n+row[1],0);if(receipt.rawBytes+bytes>rawByteBudget){receipt.futures.push({date,exchange,symbol,status:'recorded-recovery-budget-deferred',bytes});continue}receipt.rawBytes+=bytes;
   const archive=new FuturesBarArchive({dir,enabled:true});let prints=0,breaks=0;
   for(const name of names.sort()){const result=await readArchiveRecords(join(tapeDir,date,name),row=>{if(!Array.isArray(row)||row.length<3)return;const[t,p,q]=row;if(![t,p,q].every(Number.isFinite)||q<=0||p<=0||ownedMinutes.has(Math.floor(t/60000)*60000))return;archive.record({exchange,symbol,payload:{ssboe:Math.floor(t/1000),usecs:(t%1000)*1000,tradePrice:p,tradeSize:q}});prints++});breaks+=result.breaks}
   if(apply&&prints){await mkdir(join(dir,'recorded-history-originals',date),{recursive:true});if(existing)await writeFile(join(dir,'recorded-history-originals',date,exchange+'-'+symbol+'.json'),JSON.stringify(existing));await archive.flush()}
   if(apply&&(prints||ownedMinutes.size))checkpoint[identity]=fingerprint;
   receipt.futures.push({date,exchange,symbol,status:prints?'recovered-owned-tape':ownedMinutes.size?'existing-owned':'no-recorded-prints',prints,breaks});
  }
 }
 // Recover remaining missing exact-contract files from our raw recorder,
 // with a hard byte ceiling and no scans of large already-materialised books.
 for(const date of (await readdir(dir)).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d>=cutoff&&d<currentTradingDate).sort()){
  for(const name of (await readdir(join(dir,date))).sort()){
   const m=name.match(/^([A-Z0-9]+)-([A-Z0-9]+)\.ndjson(?:\.gz)?$/i);if(!m||m[1]==='UNKNOWN')continue;
   const[_,exchange,symbol]=m,file=join(dir,'bars',date,exchange+'-'+symbol+'.json');
   const existing=await readFile(file,'utf8').then(JSON.parse).catch(()=>null);if(existing&&!/history\s*plant/i.test(String(existing.source||'')))continue;
   const raw=join(dir,date,name),bytes=(await stat(raw)).size;
   if(receipt.rawBytes+bytes>rawByteBudget){receipt.futures.push({date,exchange,symbol,status:'raw-recovery-budget-deferred',bytes});continue}
   receipt.rawBytes+=bytes;const archive=new FuturesBarArchive({dir,enabled:true});let prints=0;
   const integrity=await readArchiveRecords(raw,row=>{if(!tradeFromRecord(row))return;archive.record(row);prints++});
   if(apply&&prints)await archive.flush();receipt.futures.push({date,exchange,symbol,status:prints?'recovered-owned-raw':'no-recorded-prints',prints,breaks:integrity.breaks});
  }
 }
 // Cash live responses were already archived by the shared provider boundary.
 // Recover only the observations current when captured, never the historical
 // portion of a provider response or an after-close historical download.
 if(apply){const cash=new RecordedCashHistory({dir}),sessions=new Map(),cashDate=cashQuotes.newYorkSession(now).date;
  const sessionAt=time=>{const bucket=Math.floor(time/60000);if(!sessions.has(bucket))sessions.set(bucket,cashQuotes.newYorkSession(time));return sessions.get(bucket)};
  const quote=(symbol,lastPrice,time,candle=null)=>({symbol,lastPrice,timestamp:time,marketOpen:sessionAt(time).open,...(candle?{candle}:{})});
  for(const date of (await readdir(join(dir,'exposure')).catch(()=>[])).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d>=cutoff&&d<currentTradingDate).sort()){
   for(const name of (await readdir(join(dir,'exposure',date))).filter(n=>/equities-tool-(market-map|stock-price-over-time)\.ndjson(?:\.gz)?$/.test(n)).sort()){
    const file=join(dir,'exposure',date,name),size=(await stat(file)).size;if(receipt.rawBytes+size>rawByteBudget)throw Error('Recorded response recovery byte budget reached');receipt.rawBytes+=size;
    await readArchiveRecords(file,row=>{
     const at=Number(row.ts);if(!Number.isFinite(at)||!row.payload||sessionAt(at).date>=cashDate)return;
     if(row.path?.endsWith('/market-map'))for(const[symbol,value]of Object.entries(row.payload.data||{})){cash.record(quote(symbol,Number(value.currentValue),at),at)}
     else if(row.path?.endsWith('/stock-price-over-time')){const symbol=row.request?.filter?.ticker,latest=cashQuotes.parseLatestCandle(row.payload);if(symbol&&latest)cash.record(quote(symbol,latest.lastPrice,latest.timestamp,latest.candle),at)}
     receipt.cashResponses++;
    });
    await cash.flush();
   }
  }
  await cash.close();
 }
 if(apply){await mkdir(maintenance,{recursive:true});await writeFile(join(maintenance,'checkpoint.json'),JSON.stringify(checkpoint));await writeFile(join(maintenance,'last-recovery.json'),JSON.stringify(receipt,null,2))}
 return receipt;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const result=await rebuildRecordedHistory({dir:process.env.RITHMIC_RECORD_DIR||'/recordings',days:Number(process.argv.find(a=>a.startsWith('--days='))?.slice(7)??9),apply:process.argv.includes('--apply')});console.log(JSON.stringify(result));}
