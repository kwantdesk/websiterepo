"use client";
import { memo, useEffect, useMemo, useState } from "react";
import type { Candle } from "@/lib/backtester";
import { cmeSessionWindowForDate } from "@/lib/chartHistoryWindow";
import { newYorkSessionTimestamp } from "@/lib/gexVueReplay";
import { createReplayWatchlistCache, prepareReplayWatchlistCandles, replayWatchlistQuote, type ReplayWatchlistPrint } from "@/lib/replayWatchlist";

type Instrument={key:string;symbol:string;broker:string};
export type ReplayWatchlistLoader=(row:Instrument,startMs:number,endMs:number,key:string)=>Promise<Candle[]>;
const cache=createReplayWatchlistCache();
export default memo(function ReplayWatchlistNumbers({row,sessionDate,timestampMs,load,readPrints,format}:{
  row:Instrument;sessionDate:string;timestampMs:number;load:ReplayWatchlistLoader;
  readPrints:(row:Instrument,startMs:number,endMs:number)=>readonly ReplayWatchlistPrint[];
  format:(price:number,symbol:string)=>string;
}){
  const {key:rowKey,symbol,broker}=row;
  const {startMs,endMs}=useMemo(()=>{const window=broker==='Market Index'||broker==='Massive'?null:cmeSessionWindowForDate(sessionDate);
    return {startMs:window?.startMs??newYorkSessionTimestamp(sessionDate,570),endMs:window?window.endMs-3_600_000:newYorkSessionTimestamp(sessionDate,960)};
  },[broker,sessionDate]);
  const key=JSON.stringify([row.broker,row.symbol,sessionDate,startMs,endMs]);
  const [history,setHistory]=useState<{key:string;rows:Candle[]}|null>(null);
  useEffect(()=>{let active=true;const lease=cache.acquire(key,async()=>prepareReplayWatchlistCandles(await load({key:rowKey,symbol,broker},startMs,endMs,key),startMs,endMs));
    void lease.promise.then(rows=>{if(active)setHistory({key,rows});});return()=>{active=false;lease.release();};
  // Identity fields, not a freshly created watchlist row or the replay clock,
  // own loading. Scrubbing only does a binary search of this session cache.
  },[key,load,rowKey,broker,symbol,startMs,endMs]);
  const rows=history?.key===key?history.rows:[],quote=replayWatchlistQuote(rows,readPrints(row,startMs,endMs),timestampMs,startMs,endMs);
  const title=quote?`${quote.resolution==='execution'?'Recorded execution':'Recorded 1m close'} · ${new Date(quote.asOf).toISOString()} · change from session open`:'No recorded price at this replay time';
  const color=quote?.change==null?'var(--muted)':quote.change>=0?'var(--primary)':'var(--danger)';
  return <>
    <span title={title} data-replay-watchlist-price className="text-right font-mono text-[12px] text-foreground">{quote?format(quote.price,row.symbol):'—'}</span>
    <span title={title} className="text-right font-mono text-[11px]" style={{color}}>{quote?.change==null?'—':`${quote.change>0?'+':''}${quote.change.toFixed(2)}`}</span>
    <span title={title} className="text-right font-mono text-[11px]" style={{color}}>{quote?.changePercent==null?'—':`${quote.changePercent>0?'+':''}${quote.changePercent.toFixed(2)}%`}</span>
  </>;
});
