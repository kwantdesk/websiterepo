import React from 'react';
import {createRoot} from 'react-dom/client';
import Chart from '@/components/Chart';
import {defaultChartSettings} from '@/lib/chartSettings';
import {publishChartLivePrice} from '@/lib/liveChartPrice';

const cases=[['NQ','NQZ6','1m',29000,.25],['ES','ESZ6','5m',7400,.25],['GC','GCZ6','1s',4000,.1],['SPY','','1m',740,.01],['QQQ','','200v',650,.01],['NDX','','10r',27000,.01]] as const;
const start=1794200400000;
Object.assign(window,{priceCases:cases,sendChartQuote:(symbol:string,price:number)=>{
  const item=cases.find(c=>c[0]===symbol)!;
  document.querySelector(`[data-watchlist="${symbol}"]`)!.textContent=String(price);
  publishChartLivePrice({key:'price-'+symbol,symbol,contractSymbol:item[1]||undefined,price,sourceTimestampMs:Date.now(),receivedAt:Date.now()});
}});
function Fixture(){const [replay,setReplay]=React.useState<number|null>(null); React.useEffect(()=>{Object.assign(window,{setFixtureReplay:(active:boolean)=>setReplay(active ? start+119*60000 : null)});},[]);return <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',height:'100vh',gridTemplateRows:'repeat(2,minmax(0,1fr))'}}>{cases.map(([symbol,contract,timeframe,base,tick])=><div key={symbol} style={{display:'flex',flexDirection:'column',minWidth:0,minHeight:0,border:'1px solid #333'}}><header style={{height:28,color:'#eee'}}>{symbol} {timeframe} · Watchlist: <span data-watchlist={symbol}>{base}</span></header><div style={{flex:1,minHeight:0}}><Chart replayTimestampMs={replay} instrument={symbol} contractSymbol={contract||undefined} timeframe={timeframe} chartInstanceId={'price-'+symbol} liveCandleEventKey={'price-'+symbol} settings={defaultChartSettings} orderFlowHistoryReady={true} indicators={[]} candles={Array.from({length:120},(_,i)=>({timestamp:start+i*60000,open:base,close:base,high:base+tick*8,low:base-tick*8,volume:100}))}/></div></div>)}</div>}
createRoot(document.getElementById('root')!).render(<Fixture/>);
