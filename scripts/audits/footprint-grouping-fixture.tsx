import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import Chart from '@/components/Chart';
import {defaultChartSettings} from '@/lib/chartSettings';
const start=1793700000000;
const candles=Array.from({length:130},(_,i)=>({timestamp:start+i*60000,open:28300,close:28301,high:28305,low:28295,volume:200}));
const trades=candles.flatMap((c,i)=>Array.from({length:41},(_,j)=>{const p=c.low+j*.25;return {eventId:`${i}:${j}`,recordIndex:i*50+j,timestamp:c.timestamp+j+1,open:p,high:p,low:p,close:p,volume:2,trades:1,bidVolume:j%2?2:0,askVolume:j%2?0:2,delta:j%2?-2:2,aggressor:j%2?'SELL':'BUY'};}));
function App(){const [manual,setManual]=useState<number|null>(null);const [height,setHeight]=useState(620);Object.assign(window,{setManual,setHeight});return <div style={{height,width:800,position:'relative'}}><Chart instrument="NQ" chartInstanceId="grouping" candles={candles} marketTrades={trades as any} settings={defaultChartSettings} timeframe="1m" orderFlowHistoryReady indicators={[{instanceId:'fp',indicatorId:'deep-print-footprint',enabled:true,settings:{groupingMode:manual===null?'automatic':'manual',manualTicks:manual??1,fontSize:13,autoGroupFactor:1,groupMode:'fixed'}}]}/></div>};
createRoot(document.getElementById('root')!).render(<App/>);
