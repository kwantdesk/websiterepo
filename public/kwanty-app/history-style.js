// Classic's three major-history trails use an observation-count MA, not a
// seconds/minutes resample. Conversion must already have been applied.
export const CLASSIC_HISTORY_KEYS = Object.freeze(['show_zero_gamma_history','show_call_major_history','show_put_major_history']);
export const HISTORY_DRAW_STYLES = Object.freeze([{value:'scatter',label:'Scatter'},{value:'line',label:'Line (300 MA)'}]);
export function historyDrawStyle(setting) {
 return setting?.drawStyle === undefined || setting.drawStyle === 'line' ? 'line' : 'scatter';
}
export function styledHistoryPoints(points,style='line') {
 if(style !== 'line')return points;
 const window=new Array(300);let sum=0,count=0,cursor=0;
 return points.map(point=>{
  const value=point.spot;
  // Deliberate safety difference from reference Number(null): unknown is not $0.
  // Retain the gap, without consuming a window observation or manufacturing time.
  if(value===null||value===undefined||value===''||!Number.isFinite(Number(value)))return point;
  const numeric=Number(value);
  // Add then evict, matching the reference arithmetic/rounding order.
  sum+=numeric;if(count===300)sum-=window[cursor];else count++;
  window[cursor]=numeric;cursor=(cursor+1)%300;
  return {...point,spot:Number((sum/count).toFixed(2))};
 });
}
