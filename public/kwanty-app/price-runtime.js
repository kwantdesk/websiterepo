import {createPriceSeries} from './price-series.js?v=2';

const canonical=ticker=>ticker==='ES_SPX'?'ES':ticker==='NQ_NDX'?'NQ':ticker==='SPXW'?'SPX':ticker;
// One underlying series per iframe; all its Classic/State/Orderflow panels share
// it. The host shares requests/subscriptions between iframes and normal charts.
export function createPriceController({history,subscribe,onChange,now=Date.now}){
 const series=createPriceSeries(),cache=new Map();
 let ticker=null,date=null,live=true,active=true,stop=null,generation=0,loading=false,error=null,lastHistoryBucket=null,pending=false,queuedRepair=false,disposed=false;
 const changed=()=>{cache.clear();onChange();};
 const restore=async()=>{
  if(!ticker||pending||!active||disposed)return;
  const serial=generation,symbol=canonical(ticker);pending=true;loading=true;
  try{const rows=await history(ticker,date||undefined);if(disposed||serial!==generation)return;if(!series.seed(rows,{symbol,asOf:now()}))throw Error('Invalid price history.');error=null;changed();}
  catch(reason){if(serial===generation){error=reason?.message||'Price history unavailable.';}}
  finally{if(serial===generation){pending=false;loading=false;onChange();if(queuedRepair){queuedRepair=false;void restore();}}}
 };
 const connect=()=>{
  stop?.();stop=null;if(!ticker||!live||!active||disposed)return;
  const serial=generation,symbol=canonical(ticker);
  try{stop=subscribe(ticker,frame=>{
   if(serial!==generation||disposed||!active)return;
   if(frame.symbol!==symbol)return;
   let updated=false;if(frame.candle)updated=series.seed([frame.candle],{symbol,asOf:frame.timestamp});
   const quoted=series.quote(frame);updated=quoted||updated;
   const bucket=Math.floor(frame.timestamp/60000);
   // Quote-only feeds need one shared authoritative OHLC repair at each minute
   // boundary, never per tick. No source OHLC means no fabricated new candle.
   if(quoted&&!frame.candle&&Number.isFinite(bucket)&&(lastHistoryBucket===null||bucket>lastHistoryBucket)){lastHistoryBucket=bucket;if(pending)queuedRepair=true;else void restore();}
   if(updated)changed();
  },reason=>{if(serial===generation){error=reason?.message||'Price stream unavailable.';onChange();}});}catch(reason){error=reason?.message||'Price stream unavailable.';}
 };
 return {
  select(nextTicker,{sessionDate=null,live:nextLive=true}={}){
   if(ticker===nextTicker&&date===sessionDate&&live===nextLive)return;
   const reset=ticker!==nextTicker||date!==sessionDate;
   generation++;pending=false;queuedRepair=false;stop?.();stop=null;ticker=nextTicker;date=sessionDate;live=nextLive;
   if(reset){series.reset({symbol:canonical(ticker)});lastHistoryBucket=null;cache.clear();}
   connect();void restore();
  },
  setActive(value){if(active===value)return;active=value;generation++;pending=false;queuedRepair=false;stop?.();stop=null;if(active){connect();void restore();}},
  snapshot(interval=60000,{cutoffTime=Infinity}={}){
   const key=`${interval}:${cutoffTime}`;let result=cache.get(key);
   if(!result){const candles=series.candles(interval,{cutoffTime}),points=new Map(candles.map(c=>[c.time,{time:c.time,spot:c.close}]));for(const point of series.quoteLine({cutoffTime}))points.set(point.time,point);result={candles,points:[...points.values()].sort((a,b)=>a.time-b.time),latest:cutoffTime===Infinity?series.current:null};cache.set(key,result);if(cache.size>8)cache.delete(cache.keys().next().value);}
   return {...result,loading,error};
  },
  refresh:restore,
  dispose(){disposed=true;generation++;stop?.();stop=null;cache.clear();},
 };
}
