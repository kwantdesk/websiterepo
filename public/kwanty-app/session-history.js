// Shared, bounded restoration per instrument/session. Only a validated provider
// EOD archive is immutable; accepted observations can later gain a full report.
// Expiry is demand-driven, never a new timer or interpolation of missing history.
export function createSessionHistory(request,{now=Date.now}={}){
 const jobs=new Map();
 return {read(ticker,date){
  const key=`${ticker}:${date}`,prior=jobs.get(key);
  if(prior&&prior.until>now())return prior.job;
  const entry={until:Infinity,job:null,rows:prior?.rows??[]};
  entry.job=Promise.resolve().then(()=>request(ticker,date)).then(result=>{
   const rows=Array.isArray(result?.data)?result.data:[];
   if(rows.length)entry.rows=rows;
   const immutable=rows.length>0&&result.source==='provider-eod-archive'&&result.ticker===ticker&&result.sessionDate===date;
   entry.until=immutable?Infinity:now()+(rows.length?300000:30000);
   return entry.rows;
  }).catch(()=>{entry.until=now()+30000;return entry.rows;});
  jobs.delete(key);jobs.set(key,entry);
  while(jobs.size>3)jobs.delete(jobs.keys().next().value);
  return entry.job;
 }};
}
