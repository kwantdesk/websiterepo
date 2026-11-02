import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {join} from 'node:path';import {fileURLToPath} from 'node:url';
import {loadConfig} from '../src/config.mjs';
import {RithmicHistoryPlantClient} from '../src/history-plant-client.mjs';
import {chicagoTradingDate,cmeSessionBounds} from '../src/trading-session.mjs';
import {validatedMinute,completedSessions} from './reconcile-recent-candle-history.mjs';
import {selectReferenceContract} from '../src/instrument-resolution.mjs';

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
/** Bounded licensed replay. Closed-session replacements require explicit repair and an original-file backup. */
export async function resolveHistoryContract(instrument,{client,dir='/recordings',now=Date.now(),apply=false}={}){
 const token=process.env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN;
 if(!token)throw Error('Gateway token required for reference fallback');
 const response=await fetch('http://127.0.0.1:8793/v1/market-data/resolve?'+new URLSearchParams({root:instrument.symbol,archiveOnly:'1'}),{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
 const resolved=await response.json();let contract=String(resolved.contractSymbol??'');
 if(!response.ok||resolved.exchange!==instrument.exchange||contract.match(/^([A-Z0-9]+?)[FGHJKMNQUVXZ]\d{1,2}$/)?.[1]!==instrument.symbol)throw Error('No exact-product provider reference contract');
 if(client&&/^rithmic-reference-(expiry|volume)-fallback$/.test(resolved.resolutionSource||'')){
  const ref=await fetch('http://127.0.0.1:8793/v1/market-data/reference-contracts?'+new URLSearchParams({root:instrument.symbol,exchange:instrument.exchange}),{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
  if(!ref.ok)throw Error('Provider reference inventory unavailable');
  const candidates=(await ref.json()).contracts??[],ranked=[];let remaining=[...candidates];
  for(let i=0;i<8;i++){const next=selectReferenceContract(remaining,{exchange:instrument.exchange,root:instrument.symbol,now});if(!next)break;ranked.push(next);remaining=remaining.filter(r=>r.symbol!==next.symbol)}
  const tradingDate=completedSessions(now,1)[0],bounds=cmeSessionBounds(tradingDate),volumes={},before=client.bytesReceived;
  for(const row of ranked){
   if(client.bytesReceived-before>8*1024**2)throw Error('Reference activity replay safety budget reached');
   let volume=0;await client.replayMinuteBars({exchange:instrument.exchange,symbol:row.symbol,startSec:bounds.startMs/1000,finishSec:bounds.endMs/1000,onBar:b=>{validatedMinute(b);volume+=Number(b.volume||0)}});volumes[row.symbol]=volume;
  }
  const selected=selectReferenceContract(candidates,{exchange:instrument.exchange,root:instrument.symbol,now,activityBySymbol:volumes});
  if(selected&&volumes[selected.symbol]>0){
   const file=join(dir,'history-import','reference-contract-activity.json'),data=await readFile(file,'utf8').then(JSON.parse).catch(()=>({entries:{}}));
   data.entries[instrument.exchange+':'+instrument.symbol]={observedAt:new Date(now).toISOString(),tradingDate,source:'Rithmic History Plant completed-session volume',volumes};
   if(apply){await mkdir(join(dir,'history-import'),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(data));await rename(file+'.tmp',file)}contract=selected.symbol;
  }
 }
 return {...instrument,symbol:contract};
}
export async function hydrateFuturesCatalogHistory({roots=null,resolveContract=resolveHistoryContract,dir='/recordings',now=Date.now(),days=7,apply=false,repairAmbiguous=false,repairContract=false,repairAuthoritative=false,config=loadConfig(),client=new RithmicHistoryPlantClient(config,{requestTimeoutMs:45000})}={}){
 if(!Number.isInteger(days)||days<1||days>9)throw Error('History hydration is bounded to 1–9 calendar days');
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
     byDay.clear();replayInstrument=await resolveContract(instrument,{client,dir,now,apply});await replay();
    }
    if(!byDay.size&&replayInstrument.symbol===instrument.symbol){
     replayInstrument=await resolveContract(instrument,{client,dir,now,apply});await replay();
    }
    // A successful bounded replay confirms quiet/closed sessions too. Without
    // this receipt an old subscription snapshot could reappear as a candle.
    for(let dateMs=Date.parse(new Date(startMs).toISOString().slice(0,10)+'T12:00:00Z');dateMs<=endMs;dateMs+=86400000){
     const day=new Date(dateMs).toISOString().slice(0,10),bounds=cmeSessionBounds(day);
     if(bounds.startMs>=startMs&&bounds.endMs<=endMs&&!byDay.has(day))byDay.set(day,[]);
    }
    let added=0,rows=0;const sessions=[],skipped=[];
    for(const [tradingDate,incoming] of byDay){
     // Canonical provider history belongs to the product root. An exact-contract
     // fallback must never share a file with the live collector's partial bars.
     const file=join(dir,'bars',tradingDate,instrument.exchange+'-'+instrument.symbol+'.json');
     const existing=await readFile(file,'utf8').then(JSON.parse).catch(()=>null);
     const bounds=cmeSessionBounds(tradingDate);
     const fullyRequestedSession=bounds.startMs>=startMs&&bounds.endMs<=endMs;
     const completedSession=fullyRequestedSession||Boolean(existing?.completedSession&&existing?.markerConvention==='bar-open'&&existing?.source==='Rithmic History Plant minute bars');
     const ambiguous=Boolean(existing?.bars?.length&&existing.markerConvention!=='bar-open');
     const wrongContract=Boolean(existing?.bars?.length&&existing.sourceContract&&existing.sourceContract!==instrument.symbol&&existing.sourceContract!==replayInstrument.symbol);
     const replaceContract=repairContract&&wrongContract&&fullyRequestedSession;
     const providerBars=missingOnlyBars([],incoming);
     const replaceProvider=repairAuthoritative&&fullyRequestedSession&&Array.isArray(existing?.bars)&&JSON.stringify(existing.bars)!==JSON.stringify(providerBars);
     // Existing archives may use close markers. Do not mix conventions in one file.
     if(ambiguous&&(!repairAmbiguous||!fullyRequestedSession)){skipped.push(tradingDate);continue;}
     if(wrongContract&&!replaceContract){skipped.push(tradingDate);continue;}
     const replacePublished=ambiguous||replaceContract||replaceProvider;
     const merged=replacePublished?providerBars:missingOnlyBars(existing?.bars??[],incoming);rows+=merged.length;added+=Math.max(0,merged.length-(existing?.bars?.length??0));
     sessions.push({tradingDate,providerRows:incoming.length,rows:merged.length,added:Math.max(0,merged.length-(existing?.bars?.length??0)),completedSession,repairedAmbiguous:ambiguous,repairedContract:replaceContract,repairedProvider:replaceProvider});
     if(apply&&(replacePublished||merged.length>(existing?.bars?.length??0)||completedSession!==existing?.completedSession)){
      await mkdir(join(dir,'bars',tradingDate),{recursive:true});
      if(replacePublished&&existing){const backup=join(dir,'history-repairs','catalog-'+new Date(now).toISOString().replace(/[:.]/g,'-'),tradingDate);await mkdir(backup,{recursive:true});await writeFile(join(backup,instrument.exchange+'-'+instrument.symbol+'.json'),await readFile(file));}
      await writeFile(file+'.catalog-hydrate.tmp',JSON.stringify({...existing,tradingDate,...instrument,source:replacePublished?'Rithmic History Plant minute bars':existing?.source??'Rithmic History Plant minute bars',sourceContract:replayInstrument.symbol,markerConvention:'bar-open',completedSession,providerCoveredFromMs:startMs,providerCoveredToMs:endMs,catalogHydratedAt:new Date(now).toISOString(),bars:merged}));
      await rename(file+'.catalog-hydrate.tmp',file);
     }
    }
    receipt.instruments.push({...instrument,contract:replayInstrument.symbol,status:skipped.length?'ambiguous-existing-markers':byDay.size?'verified':'empty-provider-replay',rows,added,sessions,skipped,ms:Date.now()-start});
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
 const receipt=await hydrateFuturesCatalogHistory({dir:process.env.RITHMIC_RECORD_DIR||'/recordings',days:Number(process.argv.find(arg=>arg.startsWith('--days='))?.slice(7)??7),apply:process.argv.includes('--apply'),repairAmbiguous:process.argv.includes('--repair-ambiguous'),repairContract:process.argv.includes('--repair-contract'),repairAuthoritative:process.argv.includes('--repair-authoritative'),roots:process.argv.find(arg=>arg.startsWith('--roots='))?.slice(8).split(',')??null});
 console.log(JSON.stringify(receipt));if(receipt.instruments.some(row=>row.status==='failed'))process.exitCode=1;
}
