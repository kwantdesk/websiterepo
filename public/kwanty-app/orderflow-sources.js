import {createPriceController} from './price-runtime.js?v=1';
import {mergeSnapshots,historyRecords,sourceDate} from './models.js';
import {trimSnapshotRows} from './retention.js';

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
   if(!source||source.date!==options.date){changed=true;if(source)remove(ticker);source={ticker,date:options.date,records:[],envelope:null,error:null,pending:null,fetched:null,controller:null,restored:new Set(),prices:createPrices({history,subscribe,onChange:notify})};sources.set(ticker,source);}
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
    const envelope=await api((source.date?'history?':'snapshot?')+query,controller.signal);
    if(!current(source)||controller.signal.aborted)return;
    const rows=source.date?historyRecords(envelope.data,source.ticker):mergeSnapshots([], [envelope.data],source.ticker);
    if(!rows.length)throw Error('INSTRUMENT_DATA_MISMATCH');
    source.records=trimSnapshotRows(mergeSnapshots(source.records,rows,source.ticker));source.envelope=envelope;source.error=null;notify();
    const date=sourceDate(rows.at(-1).timestamp);
    if(!source.date&&!source.restored.has(date)){
     source.restored.add(date);
     void sessionHistory.read(source.ticker,date).then(history=>{
      if(!current(source)||sourceDate(source.records.at(-1)?.timestamp)!==date||!history.length)return;
      source.records=trimSnapshotRows(mergeSnapshots(history,source.records,source.ticker));notify();
     });
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
