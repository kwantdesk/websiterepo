import type { Candle } from './backtester';
import {exchangeClockParts} from './exchangeClock';
// Optional sixth field retains within-group price variance when live prints are compacted.
export type OptionsVwapEvent=[number,number,number,number,number,number?];
export type OptionsVwapPayload={schemaVersion:1;symbol:string;from:string;to:string;asOf:string;ids:string[];events:OptionsVwapEvent[];coverage:{kind:'observed-options-contracts';complete:false;sessions:string[];missing:string[];truncated:boolean};refreshAfterMs:number};
export const OPTIONS_VWAP_DEFAULTS={side:'both',reset:'session',lineWidth:2,lineColor:'#22D3EE',useThemeColors:true,showCurrentValue:false,envelopeMode:'standard-deviation',lineStyle:'solid',bandLineStyle:'dotted',bandLineWidth:1,band1:1,band2:2,band3:3,band4:4,band5:5,band1Enabled:true,band2Enabled:true,band3Enabled:true,band4Enabled:false,band5Enabled:false,...Object.fromEntries([1,2,3,4,5].flatMap(i=>[['upper'+i+'Color','#22D3EE'],['lower'+i+'Color','#22D3EE']]))};
type CurvePoint={timestamp:number;value:number;deviation:number;bucket:string};
// The same immutable payload is shared by panes. Build its weighted curve only
// once, rather than sorting a week's option tape again on every price tick.
const curves=new WeakMap<readonly OptionsVwapEvent[],{key:string;points:CurvePoint[]}>();
function curve(events:readonly OptionsVwapEvent[],side:number,weekly:boolean,replayAt:number|null){
 const key=`${side}|${weekly}|${replayAt}`;const old=curves.get(events);if(old?.key===key)return old.points;
 const ordered=events.every((e,i)=>i===0||e[0]>=events[i-1][0])?events:[...events].sort((a,b)=>a[0]-b[0]);
 const points:CurvePoint[]=[];let bucket='',weight=0,pv=0,m2=0;
 for(const [time,price,size,type,received,withinVariance=0] of ordered){
  if(!Number.isFinite(time)||!Number.isFinite(price)||price<=0||!Number.isFinite(size)||size<=0||(side!==0&&type!==side)||(type!==1&&type!==-1)||(replayAt!==null&&(time>replayAt||received>replayAt)))continue;
  const p=exchangeClockParts(time,'America/New_York'),day=Date.UTC(p.year,p.month-1,p.day);
  const next=weekly?String(day-((p.weekday+6)%7)*86400000):`${p.year}-${p.month}-${p.day}`;
  if(next!==bucket){bucket=next;weight=0;pv=0;m2=0;}
  const nextWeight=weight+size,delta=price-(weight?pv/weight:price);
  m2+=Math.max(0,withinVariance)*size+delta*delta*weight*size/nextWeight;
  weight=nextWeight;pv+=price*size;points.push({timestamp:time,value:pv/weight,deviation:Math.sqrt(Math.max(0,m2/weight)),bucket});
 }
 curves.set(events,{key,points});return points;
}
/** Exact sum(underlying execution price * option contracts) / sum(contracts).
 * Scope is OWNED OBSERVATIONS, never the entire options market. No futures
 * prices, equity volume, signed net volume or option-premium weights.
 */
export function calculateOptionsVwap(events:readonly OptionsVwapEvent[],candles:readonly Candle[],settings:Record<string,unknown>={},replayAt:number|null=null,lastBarEndMs?:number){
 if(!candles.length)return [];
 const points=curve(events,settings.side==='calls'?1:settings.side==='puts'?-1:0,settings.reset==='week',replayAt);
 let cursor=0,lastOutputBucket='';const out:{time:number;value:number;deviation:number;breakBefore:boolean}[]=[];
 const finalEnd=lastBarEndMs??candles.at(-1)!.timestamp+(candles.length>1?Math.max(1,candles.at(-1)!.timestamp-candles.at(-2)!.timestamp):60000);
 for(let i=0;i<candles.length;i++){
  const start=candles[i].timestamp;if(replayAt!==null&&start>replayAt)break;
  const end=Math.min(candles[i+1]?.timestamp??finalEnd,replayAt===null?Infinity:replayAt+1);
  let latest:CurvePoint|undefined;
  while(cursor<points.length&&points[cursor].timestamp<end){const point=points[cursor++];if(point.timestamp>=start)latest=point;}
  // A missing observation stays absent. Never project unseen volume forward.
  if(latest){out.push({time:start/1000,value:latest.value,deviation:latest.deviation,breakBefore:lastOutputBucket!==''&&lastOutputBucket!==latest.bucket});lastOutputBucket=latest.bucket;}
 }
 return out;
}
