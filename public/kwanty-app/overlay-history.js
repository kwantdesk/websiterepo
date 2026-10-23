import {profileHistoryRecords,seekSnapshot,sourceDate} from './models.js?v=2';
import {createProfileReplay} from './profile-replay.js?v=2';

// Session manifests are already ordered and scope-validated. Marker drags must
// not run 23,400 timezone conversions and sort the session on every pointer move.
export function nearestArchivedProfileTime(records,targetMs,ceiling){
 if(!records.length||!Number.isFinite(targetMs)||!Number.isFinite(ceiling))return null;
 const last=seekSnapshot(records,ceiling*1000);if(last<0||records[last].timestamp>ceiling)return null;
 const index=Math.min(last,seekSnapshot(records,targetMs));
 const first=records[index],next=index<last?records[index+1]:null;
 return next&&Math.abs(next.timestamp*1000-targetMs)<Math.abs(first.timestamp*1000-targetMs)?next.timestamp:first.timestamp;
}

// Share exact session summaries and lazily requested profile pages across slots.
// This never polls or downloads every full profile merely to scrub a marker.
export function createOverlayHistory({api,onChange,now=Date.now}){
 const sessions=new Map(),queue=[],controllers=new Set();let active=0,disposed=false;
 const notify=()=>{if(!disposed)onChange();};
 function drain(){
  while(!disposed&&active<2&&queue.length){
   const item=queue.shift();if(item.signal?.aborted){item.reject(item.signal.reason);continue;}
   const controller=new AbortController();controllers.add(controller);active++;
   const signal=item.signal?AbortSignal.any([item.signal,controller.signal]):controller.signal;
   Promise.resolve().then(()=>api(item.path,signal)).then(item.resolve,item.reject).finally(()=>{controllers.delete(controller);active--;drain();});
  }
 }
 function request(path,signal){
  if(disposed)return Promise.reject(Error('OVERLAY_HISTORY_DISPOSED'));
  if(queue.length>=32)return Promise.reject(Error('OVERLAY_HISTORY_BUSY'));
  return new Promise((resolve,reject)=>{queue.push({path,signal,resolve,reject});drain();});
 }
 const replay=createProfileReplay({api:request,onChange:notify});
 function session(selector,date,force=false){
  const key=[selector.ticker,selector.package,selector.category,date].join('/');let entry=sessions.get(key);
  if(!entry){
   if(sessions.size>=6){const candidate=[...sessions].find(([,value])=>!value.pending);if(!candidate)return {selector,date,envelope:null,records:[],pending:null,error:'OVERLAY_HISTORY_BUSY',fetched:now()};sessions.delete(candidate[0]);}
   entry={selector,date,envelope:null,records:[],pending:null,error:null,fetched:null};sessions.set(key,entry);
  }
  sessions.delete(key);sessions.set(key,entry);
  if(!entry.pending&&(force||!entry.envelope&&(!entry.error||now()-entry.fetched>=60000))){
   entry.fetched=now();entry.error=null;
   const query=new URLSearchParams({...selector,date});
   entry.pending=request('history?'+query,AbortSignal.timeout(40000)).then(envelope=>{
    const records=profileHistoryRecords(envelope,{...selector,date});
    if(disposed)return;entry.envelope=envelope;entry.records=records;
   }).catch(error=>{if(!disposed)entry.error=error.message;}).finally(()=>{entry.pending=null;notify();});
  }
  return entry;
 }
 return {
  select(selector,date,timestamp){
   if(disposed||!date||sourceDate(timestamp)!==date)return {payload:null,records:[],pending:false,error:'HISTORY_SESSION_MISMATCH'};
   const entry=session(selector,date),index=seekSnapshot(entry.records,timestamp*1000),row=entry.records[index];
   if(!row||row.timestamp>timestamp)return {...entry,payload:null};
   const payload=replay.select(entry.envelope,row),ready=replay.ready(entry.envelope,row),failed=replay.error(entry.envelope,row);
   // A manifest summary has no strike tuples and must never pretend to be a
   // loaded historical surface while its exact page is still in flight.
   const field=selector.category.startsWith('gex_')?'strikes':'mini_contracts';
   return {...entry,payload:ready&&Array.isArray(payload?.[field])?payload:null,pending:!!entry.pending||!ready&&!failed,error:entry.error||(failed?'PROFILE_REPLAY_UNAVAILABLE':ready&&!Array.isArray(payload?.[field])?'PROFILE_DATA_MISSING':null)};
  },
  retry(selector,date){if(disposed)return;replay.retry();session(selector,date,true);},
  dispose(){disposed=true;for(const controller of controllers)controller.abort();for(const item of queue.splice(0))item.reject(Error('OVERLAY_HISTORY_DISPOSED'));sessions.clear();},
 };
}
