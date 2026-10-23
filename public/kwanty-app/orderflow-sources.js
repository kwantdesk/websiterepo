import {createPriceController} from './price-runtime.js?v=2';
import {mergeSnapshots,profileHistoryRecords,sourceDate} from './models.js?v=2';
import {trimSnapshotRows} from './retention.js';
// Completed provider sessions contain ~23,400 one-second observations. The
// generic 1,200-row profile budget silently discarded most of that history.
const retainOrderflow=rows=>trimSnapshotRows(rows,40_000_000,30000);

// One owned source per distinct visible ticker, never per chart panel.
export function createOrderflowSources({api,history,subscribe,sessionHistory,onChange,now=Date.now,createPrices=createPriceController}){
 const sources=new Map();let options={date:null,live:true,active:false},disposed=false;
 const notify=()=>{if(!disposed)onChange();};
 function remove(ticker){const source=sources.get(ticker);source?.controller?.abort();source?.prices.dispose();sources.delete(ticker);}
 function reconcile(tickers,next){
  options={...options,...next};const wanted=new Set(tickers);let changed=false;
  for(const ticker of sources.keys())if(!wanted.has(ticker))remove(ticker);
  for(const ticker of wanted){
   let source=sources.get(ticker);
   if(!source||source.date!==options.date){changed=true;if(source)remove(ticker);source={ticker,date:options.date,records:[],envelope:null,error:null,pending:null,fetched:null,controller:null,restored:new Map(),restoring:new Map(),prices:createPrices({history,subscribe,onChange:notify})};sources.set(ticker,source);}
   source.prices.setActive(options.active);
   source.prices.select(ticker,{sessionDate:options.date,live:options.live&&!options.date});
  }
  return changed;
 }
 const current=source=>!disposed&&sources.get(source.ticker)===source;
 async function read(source,force){
  if(source.pending)return source.pending;
  if(!force&&source.fetched!==null&&now()-source.fetched<(source.error?60000:30000))return;
  source.fetched=now();const controller=new AbortController();source.controller=controller;
  const job=(async()=>{
   try{
    const query=new URLSearchParams({ticker:source.ticker,package:'orderflow',category:'orderflow'});if(source.date)query.set('date',source.date);
    let envelope;
    try{envelope=await api((source.date?'history?':'snapshot?')+query,controller.signal);}
    catch(error){
     // Paid historical access can be absent while our accepted observations
     // for this exact session already exist. Reuse those real recordings;
     // never turn a latest snapshot into an invented historical curve.
     if(!source.date||![403,404].includes(error.status)||!current(source)||controller.signal.aborted)throw error;
     const recorded=await sessionHistory.read(source.ticker,source.date);
     if(!current(source)||controller.signal.aborted)return;
     const rows=profileHistoryRecords({data:recorded},{ticker:source.ticker,package:'orderflow',category:'orderflow',date:source.date});
     if(!rows.length)throw error;
     envelope={data:rows,ticker:source.ticker,package:'orderflow',category:'orderflow',sessionDate:source.date,availability:'recorded',coverage:'observations-only',providerAsOf:new Date(rows.at(-1).timestamp*1000).toISOString(),fetchedAt:new Date(now()).toISOString(),freshness:{state:'historical'},historySource:'recorded-session',upstreamHistoryError:error.message};
    }
    if(!current(source)||controller.signal.aborted)return;
    const rows=source.date?profileHistoryRecords(envelope,{ticker:source.ticker,package:'orderflow',category:'orderflow',date:source.date}):mergeSnapshots([], [envelope.data],source.ticker);
    if(!rows.length)throw Error('INSTRUMENT_DATA_MISMATCH');
    source.records=retainOrderflow(mergeSnapshots(source.records,rows,source.ticker));source.envelope=envelope;source.error=null;notify();
    const date=sourceDate(rows.at(-1).timestamp);
    if(!source.date&&!source.restoring.has(date)){
     // Revisit through the existing snapshot coordinator: the shared session
     // cache decides when partial observations may retry. Unchanged immutable
     // arrays do not rebuild the full session on every live refresh.
     const restore=Promise.resolve().then(()=>sessionHistory.read(source.ticker,date)).then(history=>{
      if(!current(source)||sourceDate(source.records.at(-1)?.timestamp)!==date||!history.length||source.restored.get(date)===history)return;
      const rows=profileHistoryRecords({data:history},{ticker:source.ticker,package:'orderflow',category:'orderflow',date});
      source.records=retainOrderflow(mergeSnapshots(rows,source.records,source.ticker));
      source.restored.set(date,history);while(source.restored.size>2)source.restored.delete(source.restored.keys().next().value);notify();
     }).catch(()=>{/* Keep genuine existing observations on a failed refresh. */}).finally(()=>{if(source.restoring.get(date)===restore)source.restoring.delete(date);});
     source.restoring.set(date,restore);
    }
   }catch(error){if(current(source)&&!controller.signal.aborted){source.error=error.message;notify();}}
   finally{if(source.controller===controller){source.pending=null;source.controller=null;}}
  })();source.pending=job;return job;
 }
 return {
  reconcile,get:ticker=>sources.get(ticker),
  refresh:({force=false}={})=>options.active?Promise.all([...sources.values()].map(source=>read(source,force))):Promise.resolve(),
  refreshPrices:()=>Promise.all([...sources.values()].map(source=>source.prices.refresh())),
  cancel(){for(const source of sources.values()){source.controller?.abort();source.controller=null;source.pending=null;source.fetched=null;}},
  dispose(){disposed=true;for(const ticker of sources.keys())remove(ticker);},
 };
}
