import {createPriceController} from './price-runtime.js?v=2';
import {mergeSnapshots,historyRecords,sourceDate} from './models.js';
import {trimSnapshotRows} from './retention.js';
import {stateSourceKey,statePanelCategory} from './state-panels.js?v=1';

// One price owner per ticker, one retained positioning source per selector.
// The existing workspace coordinator calls refresh; panels never own timers.
export function createStateSources({api,history,subscribe,onChange,now=Date.now,createPrices=createPriceController}){
 const sources=new Map(),prices=new Map();let options={active:false,date:null,live:true},disposed=false;
 const notify=(kind='snapshot')=>{if(!disposed)onChange(kind);};
 const remove=key=>{sources.get(key)?.controller?.abort();sources.delete(key);};
 const current=source=>!disposed&&sources.get(source.key)===source;
 function reconcile(panels,next){
  options={...options,...next};const wanted=new Map(panels.map(panel=>[stateSourceKey(panel),panel])),tickers=new Set(panels.map(panel=>panel.ticker));let changed=false;
  for(const key of sources.keys())if(!wanted.has(key)){remove(key);changed=true;}
  for(const [ticker,price]of prices)if(!tickers.has(ticker)){price.dispose();prices.delete(ticker);}
  for(const ticker of tickers){
   if(!prices.has(ticker)){prices.set(ticker,createPrices({history,subscribe,onChange:()=>notify('price')}));changed=true;}
   prices.get(ticker).setActive(options.active);prices.get(ticker).select(ticker,{sessionDate:options.date,live:options.live&&!options.date});
  }
  for(const [key,panel]of wanted){let source=sources.get(key);if(!source||source.date!==options.date){if(source)remove(key);source={key,ticker:panel.ticker,category:statePanelCategory(panel),date:options.date,records:[],envelope:null,error:null,pending:null,controller:null,fetched:null};sources.set(key,source);changed=true;}}
  return changed;
 }
 async function read(source,force){
  if(source.pending)return source.pending;
  if(!current(source)||!options.active)return;
  if(!force&&source.fetched!==null&&now()-source.fetched<(source.error?60000:30000))return;
  source.fetched=now();const controller=new AbortController();source.controller=controller;
  const job=(async()=>{try{
   const query=new URLSearchParams({ticker:source.ticker,package:'state',category:source.category});if(source.date)query.set('date',source.date);
   const envelope=await api((source.date?'history?':'snapshot?')+query,controller.signal);
   if(!current(source)||controller.signal.aborted)return;
   if(envelope.data?.category&&envelope.data.category!==source.category)throw Error('PROFILE_DATA_MISMATCH');
   const rows=source.date?historyRecords(envelope.data,source.ticker):mergeSnapshots([],[envelope.data],source.ticker);
   if(!rows.length)throw Error('INSTRUMENT_DATA_MISMATCH');
   if(rows.some(row=>row.category&&row.category!==source.category))throw Error('PROFILE_DATA_MISMATCH');
   if(source.date&&rows.some(row=>sourceDate(row.timestamp)!==source.date))throw Error('HISTORY_SESSION_MISMATCH');
   source.records=trimSnapshotRows(mergeSnapshots(source.records,rows,source.ticker));source.envelope=envelope;source.error=null;notify();
  }catch(error){if(current(source)&&!controller.signal.aborted){source.error=error.message;notify();}}
  finally{if(source.controller===controller){source.pending=null;source.controller=null;}}})();source.pending=job;return job;
 }
 return {
  reconcile,get:panel=>sources.get(stateSourceKey(panel)),prices:ticker=>prices.get(ticker),
  async refresh({force=false}={}){
   if(!options.active)return;
   const queue=[...sources.values()];let index=0;
   await Promise.all(Array.from({length:Math.min(2,queue.length)},async()=>{while(index<queue.length)await read(queue[index++],force);}));
  },
  refreshPrices:()=>Promise.all([...prices.values()].map(price=>price.refresh())),
  cancel(){for(const source of sources.values()){source.controller?.abort();source.controller=null;source.pending=null;source.fetched=null;}},
  dispose(){disposed=true;for(const key of sources.keys())remove(key);for(const price of prices.values())price.dispose();prices.clear();},
 };
}
