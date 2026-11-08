import type { TpoBar, TpoIndicatorSettings, TpoProfileModel, TpoTrade } from "./types";

export type TpoBuildInput = { trades: TpoTrade[]; bars: TpoBar[]; settings: TpoIndicatorSettings; nowMs?: number };
export type PackedTpoBuild = { trades: Float64Array; bars: Float64Array; instruments: string[]; settings: TpoIndicatorSettings; nowMs?: number };

// Transfer numeric columns, not hundreds of thousands of cloned JS objects.
export function packTpoBuild(input: TpoBuildInput): PackedTpoBuild {
  const instruments: string[] = [], ids = new Map<string, number>();
  const id = (value: string) => { let n=ids.get(value);if(n===undefined){n=instruments.length;instruments.push(value);ids.set(value,n);}return n; };
  const trades = new Float64Array(input.trades.length * 6);
  for(let i=0;i<input.trades.length;i++){const t=input.trades[i],o=i*6;trades[o]=t.timestampMs;trades[o+1]=t.price;trades[o+2]=t.size;trades[o+3]=t.tickSize;trades[o+4]=t.aggressorSide==='buy'?1:t.aggressorSide==='sell'?-1:0;trades[o+5]=id(t.instrumentId);}
  const bars = new Float64Array(input.bars.length * 12);
  input.bars.forEach((b,i)=>bars.set([b.startTimeMs,b.endTimeMs,b.open,b.high,b.low,b.close,b.volume??NaN,b.bidVolume??NaN,b.askVolume??NaN,b.tradeCount??NaN,b.tickSize,id(b.instrumentId)],i*12));
  return { trades, bars, instruments, settings: input.settings, nowMs: input.nowMs };
}
export function unpackTpoBuild(input: PackedTpoBuild): TpoBuildInput {
  const trades: TpoTrade[] = [], bars: TpoBar[] = [];
  for(let i=0;i<input.trades.length;i+=6){const t=input.trades;trades.push({timestampMs:t[i],price:t[i+1],size:t[i+2],tickSize:t[i+3],aggressorSide:t[i+4]===1?'buy':t[i+4]===-1?'sell':'unknown',instrumentId:input.instruments[t[i+5]]});}
  for(let i=0;i<input.bars.length;i+=12){const b=input.bars;bars.push({startTimeMs:b[i],endTimeMs:b[i+1],open:b[i+2],high:b[i+3],low:b[i+4],close:b[i+5],...(Number.isNaN(b[i+6])?{}:{volume:b[i+6]}),...(Number.isNaN(b[i+7])?{}:{bidVolume:b[i+7]}),...(Number.isNaN(b[i+8])?{}:{askVolume:b[i+8]}),...(Number.isNaN(b[i+9])?{}:{tradeCount:b[i+9]}),tickSize:b[i+10],instrumentId:input.instruments[b[i+11]]});}
  return {trades,bars,settings:input.settings,nowMs:input.nowMs};
}
export type TpoWorkerReply = { id: number; profiles?: TpoProfileModel[]; error?: string };
