// One restoration per instrument/session, shared by every panel in this iframe.
// No recurring requests and no interpolation of missing positioning history.
export function createSessionHistory(request){
 const jobs=new Map();
 return {read(ticker,date){const key=`${ticker}:${date}`;if(!jobs.has(key)){const job=Promise.resolve().then(()=>request(ticker,date)).then(result=>Array.isArray(result.data)?result.data:[]).catch(()=>[]);jobs.set(key,job);while(jobs.size>3)jobs.delete(jobs.keys().next().value);}return jobs.get(key);}};
}
