import { chartTimeBucketStartMs } from './chart-time-bucket.mjs';
import { readFileSync } from 'node:fs';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { parseIntervalMs, resampleBars } from './futures-bar-archive.mjs';

const CASH_SYMBOLS = new Set(["SPX","SPY","NDX","QQQ","IWM","AAPL","NVDA","TSLA","MSFT","AMZN","META","AMD","VIX","VXN"]);

/** Cash history consists only of live quote/candle observations captured here. */
export class RecordedCashHistory {
 constructor({dir,now=()=>Date.now(),flushMs=5000}={}){this.dir=join(dir||'/recordings','recorded-cash');this.now=now;this.flushMs=flushMs;this.pending=Promise.resolve();this.last=new Map();this.days=new Map();this.dirty=new Set();this.written=0;this.lastError=null;this.timer=null;}
 record(snapshot,receivedAt=this.now()){
  const symbol=String(snapshot?.symbol||'').toUpperCase(),time=Number(snapshot?.timestamp),price=Number(snapshot?.lastPrice);
  if(!CASH_SYMBOLS.has(symbol)||symbol==='SPXW'||!Number.isFinite(time)||time<=0||!Number.isFinite(price)||price<=0)return;
  const previous=this.last.get(symbol);this.last.set(symbol,{price,time});
  // Idle closing quotes are raw-recorded, but cannot create weekend candles.
  if(Math.abs(receivedAt-time)>15*60000||snapshot.marketOpen===false&&(!previous||previous.price===price))return;
  const day=new Date(time).toISOString().slice(0,10),key=day+'/'+symbol;
  let bars=this.days.get(key);if(!bars){let stored;try{stored=JSON.parse(readFileSync(join(this.dir,day,symbol+'.json'),'utf8'))}catch{}bars=new Map(stored?.source==='VPS recorded live quotes'?stored.candles.map(b=>[b.timestamp,b]):[]);this.days.set(key,bars)}
  const bucket=Math.floor(time/60000)*60000;let bar=bars.get(bucket);const candle=snapshot.candle;
  const valid=candle&&Number(candle.time)===bucket&&[candle.open,candle.high,candle.low,candle.close].every(Number.isFinite)&&candle.high>=Math.max(candle.open,candle.close)&&candle.low<=Math.min(candle.open,candle.close);
  if(valid){if(bar&&receivedAt<(bar.lastCaptureAt??bar.lastObservation??bucket))return;bar={timestamp:bucket,open:candle.open,high:candle.high,low:candle.low,close:candle.close,volume:0,lastCaptureAt:receivedAt};}
  else if(!bar)bar={timestamp:bucket,open:price,high:price,low:price,close:price,volume:0,firstObservation:time,lastObservation:time};
  else{bar.high=Math.max(bar.high,price);bar.low=Math.min(bar.low,price);if(time<(bar.firstObservation??bucket)){bar.open=price;bar.firstObservation=time}if(time>=(bar.lastObservation??bucket)){bar.close=price;bar.lastObservation=time}}
  bars.set(bucket,bar);this.dirty.add(key);
  if(!this.timer){this.timer=setInterval(()=>void this.flush(),this.flushMs);this.timer.unref?.()}
 }
 flush(){this.pending=this.pending.then(async()=>{
  const dirty=[...this.dirty];this.dirty.clear();
  for(const key of dirty){const[day,symbol]=key.split('/'),folder=join(this.dir,day),file=join(folder,symbol+'.json');try{await mkdir(folder,{recursive:true});await writeFile(file+'.tmp',JSON.stringify({symbol,day,source:'VPS recorded live quotes',volumeKind:'not provided by quote feed',candles:[...this.days.get(key).values()].sort((a,b)=>a.timestamp-b.timestamp)}));await rename(file+'.tmp',file);this.written++}catch(error){this.lastError=error.message;this.dirty.add(key)}}
  if(this.days.size>256)for(const key of this.days.keys()){if(this.days.size<=128)break;if(!this.dirty.has(key))this.days.delete(key)}
 }).catch(error=>{this.lastError=error.message});return this.pending}
 async load({symbol,timeframe='1m',from,to}){
  symbol=String(symbol||'').toUpperCase();if(symbol==='SPXW')symbol='SPX';
  if(!/^[A-Z0-9]{1,10}$/.test(symbol))throw Error('Invalid recorded cash symbol');
  from=Number(from);to=Number(to);if(!Number.isFinite(from)||!Number.isFinite(to)||to<from||to-from>730*86400000)throw Error('Invalid recorded history window');
  from=chartTimeBucketStartMs(from,timeframe);
  await this.flush();const rows=[];
  for(let d=Date.parse(new Date(from).toISOString().slice(0,10)+'T00:00:00Z');d<=to;d+=86400000){const stored=await readFile(join(this.dir,new Date(d).toISOString().slice(0,10),symbol+'.json'),'utf8').then(JSON.parse).catch(()=>null);if(stored?.source==='VPS recorded live quotes')rows.push(...stored.candles.filter(b=>b.timestamp>=from&&b.timestamp<=to));}
  const candles=resampleBars(rows.sort((a,b)=>a.timestamp-b.timestamp).map(b=>({t:b.timestamp,o:b.open,h:b.high,l:b.low,c:b.close,v:0})),parseIntervalMs(timeframe),timeframe).map(b=>({timestamp:b.t,open:b.o,high:b.h,low:b.l,close:b.c,volume:0}));
  return{symbol,from,to,source:'VPS recorded live quotes',candles,recordedOnly:true,volumeKind:'not provided by quote feed'};
 }
 async close(){clearInterval(this.timer);this.timer=null;await this.flush()}
 status(){return{source:'VPS recorded live quotes',written:this.written,pendingFiles:this.dirty.size,lastError:this.lastError}}
}
