import type { Candle } from './backtester';
import {exchangeClockParts} from './exchangeClock';
import type { CalculatedIndicatorSeries, IndicatorTheme } from './chartIndicatorEngine';
// Optional sixth field retains within-group price variance when live prints are compacted.
export type OptionsVwapEvent=[number,number,number,number,number,number?];
export type OptionsVwapPayload={schemaVersion:1;symbol:string;from:string;to:string;asOf:string;ids:string[];events:OptionsVwapEvent[];coverage:{kind:'observed-options-contracts';complete:false;sessions:string[];missing:string[];truncated:boolean};refreshAfterMs:number};
export const OPTIONS_VWAP_DEFAULTS={side:'both',reset:'session',lineWidth:2,lineColor:'#22D3EE',useThemeColors:true,showCurrentValue:false,showVwapLine:true,showVwapBands:true,envelopeMode:'standard-deviation',lineStyle:'solid',bandLineStyle:'dotted',bandLineWidth:1,band1:1,band2:2,band3:3,band4:4,band5:5,band1Enabled:true,band2Enabled:true,band3Enabled:true,band4Enabled:false,band5Enabled:false,...Object.fromEntries([1,2,3,4,5].flatMap(i=>[['upper'+i+'Color','#22D3EE'],['lower'+i+'Color','#22D3EE']]))};
type CurvePoint={timestamp:number;value:number;deviation:number;bucket:string;day:number};
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
  weight=nextWeight;pv+=price*size;points.push({timestamp:time,value:pv/weight,deviation:Math.sqrt(Math.max(0,m2/weight)),bucket,day});
 }
 curves.set(events,{key,points});return points;
}
/** Exact sum(underlying execution price * option contracts) / sum(contracts).
 * Scope is OWNED OBSERVATIONS, never the entire options market. No futures
 * prices, equity volume, signed net volume or option-premium weights.
 */
export function calculateOptionsVwap(events:readonly OptionsVwapEvent[],candles:readonly Candle[],settings:Record<string,unknown>={},replayAt:number|null=null,lastBarEndMs?:number,barDurationMs?:number){
 if(!candles.length)return [];
 const points=curve(events,settings.side==='calls'?1:settings.side==='puts'?-1:0,settings.reset==='week',replayAt);
 let cursor=0,lastOutputBucket='';
 let latest:CurvePoint|undefined;
 const out:{time:number;value:number;deviation:number;breakBefore:boolean}[]=[];
 const finalEnd=lastBarEndMs??candles.at(-1)!.timestamp+(candles.length>1?Math.max(1,candles.at(-1)!.timestamp-candles.at(-2)!.timestamp):60000);
 for(let i=0;i<candles.length;i++){
  const start=candles[i].timestamp;if(replayAt!==null&&start>replayAt)break;
  const end=Math.min(candles[i+1]?.timestamp??finalEnd,
   barDurationMs ? start+barDurationMs : Infinity,replayAt===null?Infinity:replayAt+1);
  while(cursor<points.length&&points[cursor].timestamp<end)latest=points[cursor++];
  if(!latest)continue;
  // VWAP stays at its last observed value between prints in the same session.
  // Never carry the previous day's observation into a day with no prints.
  const clock=exchangeClockParts(Math.max(start,end-1),'America/New_York');
  const day=Date.UTC(clock.year,clock.month-1,clock.day);
  if(latest.timestamp<start&&latest.day!==day)continue;
  out.push({time:start/1000,value:latest.value,deviation:latest.deviation,breakBefore:lastOutputBucket!==''&&lastOutputBucket!==latest.bucket});
  lastOutputBucket=latest.bucket;
 }
 return out;
}

export function optionsVwapEnvelopeSeries(
  instanceId: string,
  points: ReturnType<typeof calculateOptionsVwap>,
  config: Record<string, unknown>,
  theme: IndicatorTheme,
): CalculatedIndicatorSeries[] {
  if (!points.length) return [];
  const style = (value: unknown) => value === 'dashed' || value === 'dotted' ? value : 'solid';
  const width = (value: unknown, fallback: number) =>
    Math.max(1, Math.min(4, Math.round(Number(value) || fallback))) as 1 | 2 | 3 | 4;
  const base = {
    groupKey: instanceId, kind: 'line', placement: 'overlay',
    lastValueVisible: config.showCurrentValue === true,
    pointMarkersVisible: points.length === 1,
  } as const;
  const useTheme = config.useThemeColors !== false;
  const lines: CalculatedIndicatorSeries[] = [];
  if (config.showVwapLine !== false) {
    lines.push({
      ...base, key: `${instanceId}-options-vwap`, label: 'Options VWAP',
      color: useTheme ? theme.primary : String(config.plotColor ?? config.lineColor ?? OPTIONS_VWAP_DEFAULTS.lineColor),
      lineWidth: width(config.lineWidth, 2), lineStyle: style(config.lineStyle), data: points,
    });
  }
  if (config.showVwapBands === false) return lines;
  const percentage = config.envelopeMode === 'price-percentage';
  for (let band = 1; band <= 5; band++) {
    const enabled = config[`band${band}Enabled`] ?? band <= 3;
    if (enabled !== true) continue;
    const multiplier = Math.max(.1, Math.min(10, Number(config[`band${band}`]) || band));
    for (const direction of [1, -1]) {
      const colorKey = `${direction > 0 ? 'upper' : 'lower'}${band}Color`;
      lines.push({
        ...base, key: `${instanceId}-options-vwap-${colorKey}`,
        label: `Options VWAP ${direction > 0 ? '+' : '−'}${multiplier}${percentage ? '%' : 'σ'}`,
        color: useTheme ? theme.secondary : String(config[colorKey] ?? theme.secondary),
        lineWidth: width(config.bandLineWidth, 1), lineStyle: style(config.bandLineStyle ?? 'dotted'),
        data: points.map(point => ({
          ...point,
          value: point.value + direction * multiplier * (percentage ? point.value / 100 : point.deviation),
        })),
      });
    }
  }
  return lines;
}
