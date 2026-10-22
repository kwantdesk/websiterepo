// One restoration per instrument/session, shared by every panel in this iframe.
// No recurring requests and no interpolation of missing positioning history.
export function createSessionHistory(request,{now=Date.now}={}){
 const jobs=new Map();
 return {read(ticker,date){const key=`${ticker}:${date}`,prior=jobs.get(key);if(prior&&prior.until<=now())jobs.delete(key);if(!jobs.has(key)){const entry={until:Infinity,job:null};entry.job=Promise.resolve().then(()=>request(ticker,date)).then(result=>Array.isArray(result.data)?result.data:[]).catch(()=>[]).then(rows=>{if(!rows.length)entry.until=now()+30000;return rows;});jobs.set(key,entry);while(jobs.size>3)jobs.delete(jobs.keys().next().value);}return jobs.get(key).job;}};
}
