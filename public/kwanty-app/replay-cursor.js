// A causal prefix with stable identity between actual observations. Filtering
// a full 23,400-row session on every clock/pointer paint causes visible stalls.
export function createReplayPrefixReader(){
 const cache=new WeakMap();
 return (rows,cutoffMs)=>{
  if(!Array.isArray(rows)||!Number.isFinite(cutoffMs))return [];
  let lo=0,hi=rows.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid].timestamp*1000<=cutoffMs)lo=mid+1;else hi=mid;}
  if(lo===rows.length)return rows;
  const prior=cache.get(rows);if(prior?.end===lo)return prior.rows;
  const prefix=rows.slice(0,lo);cache.set(rows,{end:lo,rows:prefix});return prefix;
 };
}
