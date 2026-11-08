import {packTpoBuild,type TpoBuildInput,type TpoWorkerReply} from './workerProtocol';
import type {TpoProfileModel} from './types';
type Job={owner:string;scope:string;input:TpoBuildInput;done:(profiles:TpoProfileModel[])=>void;fail:()=>void};
// One shared calculator; one newest pending job per chart study. No tick queues.
const pending=new Map<string,Job>(),scopes=new Map<string,string>();
let worker:Worker|null=null,active:(Job&{id:number})|null=null,revision=0,timer:ReturnType<typeof setTimeout>|null=null;
function stop(){if(timer)clearTimeout(timer);timer=null;worker?.terminate();worker=null;}
function pump(){
  if(active)return;
  const next=pending.values().next().value as Job|undefined;
  if(!next){timer=setTimeout(stop,30000);return;}if(timer)clearTimeout(timer);timer=null;pending.delete(next.owner);
  try{
    if(!worker){worker=new Worker(new URL('./profile.worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=(event:MessageEvent<TpoWorkerReply>)=>{const job=active;if(!job||job.id!==event.data.id)return;if(timer)clearTimeout(timer);timer=null;active=null;if(scopes.get(job.owner)===job.scope){if(event.data.profiles)job.done(event.data.profiles);else job.fail();}pump();};
      worker.onerror=()=>{const job=active;active=null;stop();if(job&&scopes.get(job.owner)===job.scope)job.fail();pump();};
    }
    active={...next,id:++revision};
    const input=packTpoBuild(next.input);
    worker.postMessage({id:revision,input},[input.trades.buffer,input.bars.buffer]);
    timer=setTimeout(()=>{const job=active;active=null;stop();if(job&&scopes.get(job.owner)===job.scope)job.fail();pump();},60000);
  }catch{active=null;stop();if(scopes.get(next.owner)===next.scope)next.fail();pump();}
}
export function requestTpoProfileBuild(job:Job){
  scopes.set(job.owner,job.scope);
  if(active?.owner===job.owner&&active.scope===job.scope&&active.input.trades===job.input.trades&&active.input.bars===job.input.bars)return;
  pending.set(job.owner,job);pump();
}
export function cancelTpoProfileBuild(owner:string){scopes.delete(owner);pending.delete(owner);if(active?.owner===owner&&!pending.size){active=null;stop();}}
