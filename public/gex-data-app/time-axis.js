import {themePaint} from './site-theme.js?v=1';
import {gexStorage} from './site-runtime.js?v=1';
// market-data settled time-axis rules, 0j3p3hcgafh1-.js:
// module90450 at1171630; QDNativeAreaFlowChart at1182000–1185600,
// time-tick painting/8px collision gap at1186200–1188300 (UTF-16 offsets).
const TIME_STEPS=Object.freeze([60000,120000,300000,600000,900000,1200000,1800000,3600000]);
const timestamp=value=>typeof value==='number'?value:value?.time;

export function timeAtIndex(series,index){
  if(!series.length)return NaN;const bounded=Math.max(0,Math.min(series.length-1,index)),low=Math.floor(bounded),high=Math.ceil(bounded),a=timestamp(series[low]),b=timestamp(series[high]);return a+(b-a)*(bounded-low);
}

export function timeDomain(series,start=0,end=series.length-1,{padBars=false}={}) {
  if(!series.length)return null;
  const first=Math.max(0,Math.min(series.length-1,Math.trunc(start)));
  const last=Math.max(first,Math.min(series.length-1,Math.trunc(end??series.length-1)));
  const firstTime=timeAtIndex(series,start),lastTime=timeAtIndex(series,end??series.length-1);
  if(!Number.isFinite(firstTime)||!Number.isFinite(lastTime))return null;
  const span=lastTime-firstTime;
  // Source xAxisMode=time uses30seconds only when endpoints coincide.
  // Its1% fallback belongs to xAxisMode=value, not time charts.
  const padding=span>0?(padBars&&last>first?span/(2*(last-first)):0):30000;
  return {min:firstTime-padding,max:lastTime+padding,first,last,firstTime,lastTime,padding};
}

export function timeX(time,domain,left,right) {
  if(!domain||!Number.isFinite(time))return NaN;
  return left+(time-domain.min)/Math.max(domain.max-domain.min,1e-9)*(right-left);
}

export function nearestTimeIndex(series,time,start=0,end=series.length-1) {
  if(!series.length||!Number.isFinite(time))return null;
  const first=Math.max(0,Math.min(series.length-1,Math.floor(start)));let low=first,high=Math.max(first,Math.min(series.length-1,Math.ceil(end)));
  while(low<high){const middle=Math.floor((low+high)/2);if(timestamp(series[middle])<time)low=middle+1;else high=middle;}
  return low>first&&Math.abs(timestamp(series[low-1])-time)<=Math.abs(timestamp(series[low])-time)?low-1:low;
}

export function timeTicks(start,end,plotWidth,axisFont=13) {
  const span=end-start;if(!Number.isFinite(span)||span<=0||plotWidth<=0)return [];
  const divisor=2*.62*axisFont*8;
  const count=divisor<=0?2:Math.max(2,Math.min(20,Math.floor(plotWidth/divisor)));
  const desired=span/count;
  let step=TIME_STEPS[0],distance=Math.abs(Math.log(desired/step));
  for(const candidate of TIME_STEPS.slice(1)){
    const difference=Math.abs(Math.log(desired/candidate));
    if(difference<distance){step=candidate;distance=difference;}
  }
  const values=[];
  for(let time=Math.ceil(start/step)*step;time<=end;time+=step)values.push(time);
  return values;
}
