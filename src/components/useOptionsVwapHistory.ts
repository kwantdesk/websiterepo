"use client";
import {useEffect,useState} from 'react';
import {subscribeOptionsVwap} from '@/lib/optionsVwapFeed';
import {exchangeClockParts} from '@/lib/exchangeClock';
import {getMarketIndexDefinition} from '@/lib/marketIndices';
import type {OptionsVwapPayload} from '@/lib/optionsVwap';
function date(time:number){const p=exchangeClockParts(time,'America/New_York');return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;}
export function useOptionsVwapHistory(enabled:boolean,symbol:string,first:number,last:number,replay=false){
 const supported=getMarketIndexDefinition(symbol)?.group==='Options Underlyings';
 const to=Number.isFinite(last)?date(last):'',from=Number.isFinite(first)&&Number.isFinite(last)?date(Math.max(first,last-9*86400000)):'';
 const key=`${symbol}|${from}|${to}|${replay}`;const [state,setState]=useState<{key:string;payload:OptionsVwapPayload|null;error:string|null}>({key:'',payload:null,error:null});
 useEffect(()=>{if(!enabled||!supported||!from||!to)return;let active=true;const stop=subscribeOptionsVwap(symbol,from,to,(payload,error)=>{if(active)setState({key,payload,error});},{live:!replay});return()=>{active=false;stop();};},[enabled,supported,symbol,from,to,key,replay]);
 return state.key===key?state:{key,payload:null,error:null};
}
