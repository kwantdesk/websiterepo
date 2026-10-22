// Exact profile rows load in bounded pages; the complete second-resolution
// timeline stays local. No interpolation, downsampling or exposure fabrication.
export function createProfileReplay({api,onChange}){
 const pages=new Map(),pending=new Map(),failed=new Set();let active=0;
 const key=(envelope,page)=>[envelope.ticker,envelope.package,envelope.category,envelope.sessionDate,page].join('/');
 function request(envelope,page){
  const id=key(envelope,page);if(pages.has(id)||pending.has(id)||failed.has(id)||active>=2)return;
  active++;let failure=false;
  const query=new URLSearchParams({ticker:envelope.ticker,package:envelope.package,category:envelope.category,date:envelope.sessionDate,page:String(page)});
  const job=api('history?'+query,AbortSignal.timeout(40000)).then(result=>{
   if(result.ticker!==envelope.ticker||result.package!==envelope.package||result.category!==envelope.category||result.sessionDate!==envelope.sessionDate||result.page!==page||!Array.isArray(result.data)||result.data.some(row=>row.ticker!==envelope.ticker))throw Error('PROFILE_REPLAY_MISMATCH');
   pages.set(id,new Map(result.data.map(row=>[row.timestamp,row])));while(pages.size>12)pages.delete(pages.keys().next().value);
  }).catch(()=>{failure=true;failed.add(id);if(failed.size>128)failed.delete(failed.values().next().value);}).finally(()=>{active--;pending.delete(id);onChange(failure);});pending.set(id,job);
 }
 return {select(envelope,row){
  if(!row||!Array.isArray(envelope?.profilePages)||!Number.isInteger(row.profilePage))return row;
  const id=key(envelope,row.profilePage),page=pages.get(id);
  if(page){pages.delete(id);pages.set(id,page);return page.get(row.timestamp)||row;}
  request(envelope,row.profilePage);return row;
 },retry(){failed.clear();},ready(envelope,row){return !envelope?.profilePages||!Number.isInteger(row?.profilePage)||pages.get(key(envelope,row.profilePage))?.has(row.timestamp)===true;},error(envelope,row){return !!envelope?.profilePages&&failed.has(key(envelope,row?.profilePage));}};
}
