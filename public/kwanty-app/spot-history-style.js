// Fresh Gexbot95850 base spot-history trace, distinct from major trails' 300 MA.
// Observation count is preserved; there is no time resampling or candle rewrite.
export function spotHistoryMovingAverage(points,window=30){
 if(!Number.isInteger(window)||window<1||window>10000)throw Error('Invalid spot-history window.');
 if(window<=1)return points;
 const result=[];
 for(let index=10;index<points.length;index++){
  const start=Math.max(0,index-window+1),values=points.slice(start,index+1),valid=values.every(point=>typeof point.spot==='number'&&Number.isFinite(point.spot));
  result.push({...points[index],spot:valid?Number((values.reduce((sum,point)=>sum+point.spot,0)/values.length).toFixed(2)):null});
 }
 return result;
}
