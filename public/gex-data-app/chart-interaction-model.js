import {themePaint} from './site-theme.js?v=1';
import {gexStorage} from './site-runtime.js?v=1';
// Source-backed interaction math. No target bundle is imported or executed.
// market-data 0j3p3hcgafh1-.js module713796 (UTF-16 1235780+),
// useNativeChartZoom (1237k), QDChartZoomSlider (1201700+), and HeatMap (2269k).
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function normalizeWheelDelta(event) {
  return event.wheelDelta ?? -(3 * event.deltaY);
}

export function wheelDeltaToScale(delta) {
  const normalized=delta/120, magnitude=Math.abs(normalized);
  const base=magnitude>3?1.4:magnitude>1?1.2:1.1;
  const scale=Math.max(1/(normalized>0?base:1/base),0);
  return {scale,isZoomIn:scale<1};
}

export function scaleAroundPivot(window,scale,pivot) {
  const center=window.start+pivot*(window.end-window.start);
  return {start:(window.start-center)*scale+center,end:(window.end-center)*scale+center};
}

export function lerpZoomStep(window,target,alpha=.15,epsilon=.1) {
  const start=window.start+(target.start-window.start)*alpha;
  const end=window.end+(target.end-window.end)*alpha;
  const converged=Math.abs(start-target.start)<epsilon&&Math.abs(end-target.end)<epsilon;
  return {next:converged?{...target}:{start,end},converged};
}

// Windows retain fractional endpoints throughout gestures. Round only for data
// lookup / render indices. maxIndex is length-1, NOT length.
export function panZoomWindow(window,fraction,maxIndex) {
  const shift=clamp(-fraction*Math.max(window.end-window.start,0),-window.start,maxIndex-window.end);
  return {start:window.start+shift,end:window.end+shift};
}

export function wheelZoomWindow(window,maxIndex,delta,anchor) {
  if(maxIndex<=0)return {window:{...window},handled:true};
  const {scale,isZoomIn}=wheelDeltaToScale(delta);
  if(!isZoomIn&&window.start<=1e-6&&window.end>=maxIndex-1e-6)
    return {window:{...window},handled:false}; // Delegate outward to home infinite plane.
  const scaled=scaleAroundPivot(window,scale,isZoomIn?anchor:.5);
  if(isZoomIn&&scaled.end-scaled.start<1)return {window:{...window},handled:true};
  const result={start:clamp(scaled.start,0,maxIndex),end:clamp(scaled.end,0,maxIndex)};
  if(!isZoomIn&&result.end-result.start<=window.end-window.start){
    result.start=Math.max(0,Math.round(window.start)-1);
    result.end=Math.min(maxIndex,Math.round(window.end)+1);
  }
  return {window:result,handled:true};
}

export function sliderMinimumSpan(length,override) {
  return override??Math.max(1,Math.round(.01*(length-1)));
}

export function sliderBarWindow(initial,pixelDelta,pixelSize,length,{inverted=false,fractional=false}={}) {
  const maxIndex=length-1;
  let shift=(inverted?-pixelDelta:pixelDelta)/Math.max(pixelSize,1)*maxIndex;
  if(!fractional)shift=Math.round(shift);
  const span=initial.end-initial.start;
  let start=initial.start+shift,end=initial.end+shift;
  if(start<0){start=0;end=span;}
  if(end>maxIndex){end=maxIndex;start=maxIndex-span;}
  return {start:clamp(start,0,maxIndex),end:clamp(end,0,maxIndex)};
}

export function sliderHandleWindow(initial,handle,value,length,{minSpan,fractional=false}={}) {
  const maxIndex=length-1,minimum=sliderMinimumSpan(length,minSpan);
  let position=clamp(value,0,maxIndex);
  if(!fractional)position=Math.round(position);
  if(initial.start===initial.end)handle=position<=initial.start?'start':'end';
  const bound=value=>{const result=clamp(value,0,maxIndex);return fractional?result:Math.round(result);};
  return handle==='start'?{start:bound(Math.min(position,initial.end-minimum)),end:initial.end}
    :{start:initial.start,end:bound(Math.max(position,initial.start+minimum))};
}

export function sliderTrackClick(window,value,length,{fractional=false}={}) {
  const position=fractional?clamp(value,0,length-1):Math.round(clamp(value,0,length-1));
  if(position>=window.start&&position<=window.end)return {window:{...window},handle:null};
  const startDistance=Math.abs(position-window.start),endDistance=Math.abs(position-window.end);
  const handle=startDistance===endDistance?(position>window.start?'end':'start'):startDistance<endDistance?'start':'end';
  return {window:handle==='start'?{start:position,end:window.end}:{start:window.start,end:position},handle};
}

export function heatMapPlainWheel(window,delta,maxIndex) {
  const span=window.end-window.start,shift=delta<0?3:-3;
  let start=window.start+shift,end=window.end+shift;
  if(start<0){start=0;end=Math.min(span,maxIndex);}
  if(end>maxIndex){end=maxIndex;start=Math.max(0,maxIndex-span);}
  return {start,end};
}

export function cursorTooltipPlacement(x,y,width,height,tooltipWidth,tooltipHeight) {
  let left=x+16,top=y+16;
  if(left+tooltipWidth>width)left=Math.max(0,x-tooltipWidth-16);
  if(top+tooltipHeight>height)top=Math.max(0,y-tooltipHeight-16);
  return {left,top};
}

export function chartGestureDistance(start,point) {
  return Math.abs(point.x-start.x)+Math.abs(point.y-start.y);
}
