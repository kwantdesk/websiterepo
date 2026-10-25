/** Shared provider-confirmed rollover watcher. No calendar-derived contracts. */
export function watchFrontMonth(resolve:()=>Promise<string>,onContract:(contract:string)=>void,onError?:(error:Error)=>void,intervalMs=600_000){
  let closed=false,pending=false,current:string|null=null;
  const refresh=async()=>{if(closed||pending)return;pending=true;try{const next=await resolve();if(!closed&&next&&next!==current){current=next;onContract(next);}}catch(error){if(!closed)onError?.(error instanceof Error?error:new Error(String(error)));}finally{pending=false;}};
  const timer=setInterval(()=>{if(typeof document==='undefined'||document.visibilityState==='visible')void refresh();},intervalMs);
  if(typeof timer==='object'&&'unref' in timer)timer.unref();
  const visible=()=>{if(typeof document==='undefined'||document.visibilityState==='visible')void refresh();};
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',visible);
  if(typeof window!=='undefined')window.addEventListener('online',visible);
  void refresh();
  return {refresh,dispose(){closed=true;clearInterval(timer);if(typeof document!=='undefined')document.removeEventListener('visibilitychange',visible);if(typeof window!=='undefined')window.removeEventListener('online',visible);}};
}
