import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {join} from 'node:path';import {fileURLToPath} from 'node:url';
import {loadConfig} from '../src/config.mjs';
import {RithmicHistoryPlantClient} from '../src/history-plant-client.mjs';
import {chicagoTradingDate} from '../src/trading-session.mjs';
import {validatedMinute} from './reconcile-recent-candle-history.mjs';

export function missingOnlyBars(existing,incoming){
 const rows=new Map(existing.map(row=>[Number(row[0]),row]));
 for(const row of incoming)if(!rows.has(row[0]))rows.set(row[0],row);
 return [...rows.values()].sort((a,b)=>a[0]-b[0]);
}
export function configuredHistoryRoots(config){
 const roots=new Map();
 for(const row of [...config.allowedRoots,...config.subscriptions]){
  const root=String(row.symbol).toUpperCase().replace(/[FGHJKMNQUVXZ]\d{1,2}$/,'');
  if(!/^[A-Z0-9]{1,4}$/.test(root)||!['CME','COMEX','NYMEX','CBOT'].includes(row.exchange))continue;
  roots.set(row.exchange+':'+root,{exchange:row.exchange,symbol:root});
 }
 if(roots.size>64)throw Error('More than 64 configured roots; refusing unbounded history hydration');
 return [...roots.values()].sort((a,b)=>a.symbol.localeCompare(b.symbol));
}
/** Bounded licensed replay. Never changes an already-published historical row. */
export async function resolveHistoryContract(instrument){
 const token=process.env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN;
 if(!token)throw Error('Gateway token required for reference fallback');
 const response=await fetch('http://127.0.0.1:8793/v1/market-data/resolve?'+new URLSearchParams({root:instrument.symbol}),{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
 const resolved=await response.json(),contract=String(resolved.contractSymbol??'');
 if(!response.ok||resolved.exchange!==instrument.exchange||contract.match(/^([A-Z0-9]+?)[FGHJKMNQUVXZ]\d{1,2}$/)?.[1]!==instrument.symbol)throw Error('No exact-product provider reference contract');
 return {...instrument,symbol:contract};
}
export async function hydrateFuturesCatalogHistory({roots=null,resolveContract=resolveHistoryContract,dir='/recordings',now=Date.now(),days=7,apply=false,config=loadConfig(),client=new RithmicHistoryPlantClient(config,{requestTimeoutMs:45000})}={}){
 if(days<1||days>9)throw Error('History hydration is bounded to 1–9 calendar days');
 const startMs=now-days*86400000,endMs=Math.floor(now/60000)*60000-1;
 const receipt={startedAt:new Date(now).toISOString(),apply,bytes:0,instruments:[]};
 try{
  for(const instrument of configuredHistoryRoots(config).filter(row=>!roots||roots.includes(row.symbol))){
   if(receipt.bytes>=64*1024**2)throw Error('64MiB history hydration safety budget reached');
   const byDay=new Map(),before=client.bytesReceived,start=Date.now();
   try{
    let replayInstrument=instrument;
    const replay=()=>client.replayMinuteBars({...replayInstrument,startSec:Math.floor(startMs/1000),finishSec:Math.floor(endMs/1000),onBar:row=>{
     const bar=validatedMinute(row);if(bar[0]<startMs||bar[0]>endMs)return;
     const day=chicagoTradingDate(bar[0]);if(!byDay.has(day))byDay.set(day,[]);byDay.get(day).push(bar);
    }});
    try{await replay()}catch(error){
     if(!/failed: 7, reference data not available/i.test(error.message))throw error;
     byDay.clear();replayInstrument=await resolveContract(instrument);await replay();
    }
    let added=0,rows=0;
    for(const [tradingDate,incoming] of byDay){
     const file=join(dir,'bars',tradingDate,replayInstrument.exchange+'-'+replayInstrument.symbol+'.json');
     const existing=await readFile(file,'utf8').then(JSON.parse).catch(()=>null);
     // Existing archives may use close markers. Do not mix conventions in one file.
     if(existing?.bars?.length&&existing.markerConvention!=='bar-open')continue;
     const merged=missingOnlyBars(existing?.bars??[],incoming);rows+=merged.length;added+=merged.length-(existing?.bars?.length??0);
     if(apply&&merged.length>(existing?.bars?.length??0)){
      await mkdir(join(dir,'bars',tradingDate),{recursive:true});
      await writeFile(file+'.catalog-hydrate.tmp',JSON.stringify({...existing,tradingDate,...replayInstrument,source:existing?.source??'Rithmic History Plant minute bars',markerConvention:'bar-open',catalogHydratedAt:new Date(now).toISOString(),bars:merged}));
      await rename(file+'.catalog-hydrate.tmp',file);
     }
    }
    receipt.instruments.push({...instrument,contract:replayInstrument.symbol,status:byDay.size?'verified':'empty-provider-replay',rows,added,ms:Date.now()-start});
   }catch(e){receipt.instruments.push({...instrument,status:'failed',error:e.message,ms:Date.now()-start});
    // A rejected symbol does not require another login. A rejected login must
    // stop this run instead of hammering the licensed session boundary.
    if(/login.*rejected|permission denied|not connected|timed out/i.test(e.message))break;
   }
   receipt.bytes+=Math.max(0,client.bytesReceived-before);
  }
 }finally{client.close()}
 if(apply){await mkdir(join(dir,'history-import'),{recursive:true});await writeFile(join(dir,'history-import','catalog-latest-receipt.json'),JSON.stringify(receipt,null,2))}
 return receipt;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const receipt=await hydrateFuturesCatalogHistory({dir:process.env.RITHMIC_RECORD_DIR||'/recordings',apply:process.argv.includes('--apply'),roots:process.argv.find(arg=>arg.startsWith('--roots='))?.slice(8).split(',')??null});
 console.log(JSON.stringify(receipt));if(receipt.instruments.some(row=>row.status==='failed'))process.exitCode=1;
}
