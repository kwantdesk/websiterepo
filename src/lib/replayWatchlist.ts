import type { Candle } from "./backtester";

export type ReplayWatchlistPrint = { timestamp: number; close: number; flowOnly?: boolean; footprintSummary?: unknown };
export type ReplayWatchlistQuote = { price: number; asOf: number; resolution: "execution" | "1m"; change: number | null; changePercent: number | null };
function lastBefore<T>(rows: readonly T[], clock: number, time: (row: T) => number) {
  let lo=0,hi=rows.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(time(rows[mid])<=clock)lo=mid+1;else hi=mid;}
  return lo-1;
}
export function prepareReplayWatchlistCandles(rows: readonly Candle[], startMs: number, endMs: number): Candle[] {
  return rows.filter(row => row.timestamp>=startMs && row.timestamp<endMs && Number.isFinite(row.close) && row.close>0)
    .slice().sort((a,b)=>a.timestamp-b.timestamp);
}
/** Final OHLC is observable only at bar close. Never interpolate a tick path. */
export function replayWatchlistQuote(candles: readonly Candle[], prints: readonly ReplayWatchlistPrint[], clock: number, startMs: number, endMs: number): ReplayWatchlistQuote | null {
  if(!Number.isFinite(clock)||clock<startMs||clock>endMs)return null;
  const barIndex=lastBefore(candles,clock,row=>row.timestamp+60_000),bar=candles[barIndex];
  let price=bar?.close,asOf=bar?bar.timestamp+60_000:0,resolution:ReplayWatchlistQuote['resolution']='1m';
  let tickIndex=lastBefore(prints,clock,row=>row.timestamp);
  while(tickIndex>=0){const tick=prints[tickIndex--];if(tick.timestamp<Math.max(startMs,asOf))break;
    if(tick.flowOnly||tick.footprintSummary||!Number.isFinite(tick.close)||tick.close<=0)continue;
    price=tick.close;asOf=tick.timestamp;resolution='execution';break;
  }
  // Missing source intervals are not a frozen current quote or a zero price.
  if(!price||asOf<startMs||asOf>clock||clock-asOf>90_000)return null;
  const first=candles[0],open=first&&first.timestamp<startMs+60_000&&first.timestamp<=clock&&Number.isFinite(first.open)&&first.open>0?first.open:null;
  return {price,asOf,resolution,change:open===null?null:price-open,changePercent:open===null?null:(price-open)/open*100};
}

/** Bounded session cache: two reads at a time, no HTTP on clock ticks, no
 * abandoned queued work after replay exit/date changes. Shared readers lease
 * jobs so one row unmount cannot cancel another row's history. */
export function createReplayWatchlistCache(concurrency=2,capacity=96) {
  type Job={refs:number;running:boolean;done:boolean;until:number;load:()=>Promise<Candle[]>;promise:Promise<Candle[]>;resolve:(rows:Candle[])=>void};
  const jobs=new Map<string,Job>(),queue:Array<[string,Job]>=[];let running=0;
  const trim=()=>{for(const[key,job]of jobs){if(jobs.size<=capacity)break;if(job.done&&!job.refs)jobs.delete(key);}};
  const drain=()=>{while(running<concurrency&&queue.length){const[key,job]=queue.shift()!;
    if(!job.refs){jobs.delete(key);job.resolve([]);continue;}job.running=true;running++;
    void job.load().catch(()=>[]).then(rows=>{job.done=true;job.until=Date.now()+30*60_000;job.resolve(rows);}).finally(()=>{running--;trim();drain();});
  }};
  return {acquire(key:string,load:()=>Promise<Candle[]>){
    let job=jobs.get(key);if(job?.done&&job.until<Date.now()){jobs.delete(key);job=undefined;}
    if(!job){let resolve!:(rows:Candle[])=>void;const promise=new Promise<Candle[]>(done=>resolve=done);job={refs:0,running:false,done:false,until:0,load,promise,resolve};jobs.set(key,job);queue.push([key,job]);}
    job.refs++;drain();let released=false;const owned=job;
    return {promise:job.promise,release(){if(released)return;released=true;owned.refs--;trim();drain();}};
  }};
}
