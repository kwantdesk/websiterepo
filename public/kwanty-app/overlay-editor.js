import {themePaint} from './site-theme.js';
import {showWorkspaceLoading} from '../workspace-loading.js?v=1';
import {botStorage,botFetch} from './site-runtime.js';
import {trimSnapshotRows} from './retention.js';
import {snapshotInterval} from './cadence.js';
import {defaultProfileSlots,drawProfileOverlay} from './profile-overlay.js';
import {sourceDate,sourceTime,finite} from './models.js?v=2';
import {createOverlayHistory,nearestArchivedProfileTime} from './overlay-history.js?v=1';

export const PROFILE_CATEGORIES=['gex_full','gex_zero','gex_one',...['delta','gamma','vanna','charm'].flatMap(key=>[key+'_zero',key+'_one'])];
export function profileSelector(slot,ticker){const category=PROFILE_CATEGORIES.includes(slot.category)?slot.category:'gex_zero',oi=category.startsWith('gex_')&&(slot.gexDataType==='oi'||slot.showOI);return {ticker,package:oi?'classic':'state',category};}
export function profileAtOrBefore(records,timestamp,ticker){return records.filter(r=>r.ticker===ticker&&finite(r.timestamp)!==null&&r.timestamp<=timestamp&&sourceDate(r.timestamp)===sourceDate(timestamp)).sort((a,b)=>a.timestamp-b.timestamp).at(-1)||null;}
export function profileSelectionTime(pin,target){const timestamp=finite(target),requested=finite(pin);if(timestamp===null)return null;return requested===null||sourceDate(requested)!==sourceDate(timestamp)?timestamp:Math.min(requested,timestamp);}
// Live Orderflow and profile snapshots are independent observations. A profile
// fetched a second later must not disappear until Orderflow's next refresh (or
// forever after the close). Historical, paused and explicitly pinned selections
// retain the strict no-future cutoff; latest never means backfilled history.
export function selectProfileSnapshot(records,{ticker,targetTimestamp,pinnedTimestamp=null,live=false}){
 const target=finite(targetTimestamp);if(target===null)return {payload:null,time:null};
 const pin=finite(pinnedTimestamp),sameSession=records.filter(row=>row.ticker===ticker&&finite(row.timestamp)!==null&&sourceDate(row.timestamp)===sourceDate(target));
 const pinnedToSession=pin!==null&&sourceDate(pin)===sourceDate(target);
 if(live&&!pinnedToSession){const payload=sameSession.sort((a,b)=>a.timestamp-b.timestamp).at(-1)||null;return {payload,time:payload?.timestamp??target};}
 const time=profileSelectionTime(pin,target);return {payload:profileAtOrBefore(sameSession,time,ticker),time};
}
export function nearestActualProfileTime(records,targetMs,ceiling,ticker){const candidates=records.filter(r=>r.ticker===ticker&&r.timestamp<=ceiling&&sourceDate(r.timestamp)===sourceDate(ceiling));if(!candidates.length)return null;return candidates.reduce((best,r)=>Math.abs(r.timestamp*1000-targetMs)<Math.abs(best.timestamp*1000-targetMs)?r:best).timestamp;}
export function shiftedProfileOffset(value,delta){return delta===null?0:Math.max(-100,Math.min(100,(finite(value)??0)+(finite(delta)??0)));}

// All visible profile slots share one source per exact ticker/package/category.
// Existing workspace paints drive eligibility; this pool owns no timers, price
// subscriptions or history requests, and reserves a bounded live request budget.
export function createLiveOverlaySources({api,onChange=()=>{},canRead=()=>true,now=Date.now}){
 const caches=new Map(),queue=[];let active=0,disposed=false;
 const keyFor=selector=>new URLSearchParams({ticker:selector.ticker,package:selector.package,category:selector.category}).toString();
 const current=source=>!disposed&&caches.get(source.key)===source;
 const pump=()=>{while(!disposed&&active<2&&queue.length){
  const source=queue.shift(),controller=source.controller;
  if(!current(source)||!canRead()){controller.abort();source.pending=null;source.controller=null;source.fetched=null;source.finish();continue;}active++;
  void Promise.resolve().then(()=>{if(!current(source)||!canRead()){controller.abort();source.fetched=null;throw new DOMException('Aborted','AbortError');}return api('snapshot?'+source.key,controller.signal);}).then(envelope=>{
   if(!current(source)||controller.signal.aborted)return;
   const payload=envelope?.data,selector=source.selector;
   if(payload?.ticker!==selector.ticker)throw Error('PROFILE_INSTRUMENT_MISMATCH');
   if(payload.category&&payload.category!==selector.category||envelope.package&&envelope.package!==selector.package||envelope.category&&envelope.category!==selector.category)throw Error('PROFILE_DATA_MISMATCH');
   if(finite(payload.timestamp)===null)throw Error('PROFILE_TIMESTAMP_MISSING');
   source.records=source.records.filter(row=>row.timestamp!==payload.timestamp&&sourceDate(row.timestamp)===sourceDate(payload.timestamp));
   source.records.push(payload);source.records.sort((a,b)=>a.timestamp-b.timestamp);trimSnapshotRows(source.records,1000000,1200);
   source.error=null;source.retryAfterSeconds=null;
  }).catch(error=>{if(current(source)&&!controller.signal.aborted){source.error=error.message;source.retryAfterSeconds=error.retryAfterSeconds;}}).finally(()=>{
   active--;source.pending=null;source.controller=null;source.finish();pump();if(current(source)&&!controller.signal.aborted)onChange();
  });
 }};
 return {get(selector,{active:enabled=true}={}){
  const key=keyFor(selector);let source=caches.get(key);
  if(!source){if(caches.size>=12){const candidate=[...caches].find(([,entry])=>!entry.pending);if(candidate)caches.delete(candidate[0]);}source={key,selector:{...selector},records:[],fetched:null,pending:null,error:null,retryAfterSeconds:null,controller:null,finish:()=>{}};caches.set(key,source);}
  if(disposed||!enabled||!canRead()||source.pending||source.fetched!==null&&now()-source.fetched<snapshotInterval(source))return source;
  source.fetched=now();source.controller=new AbortController();source.pending=new Promise(resolve=>{source.finish=resolve;});queue.push(source);pump();return source;
 },peek:selector=>caches.get(keyFor(selector)),dispose(){disposed=true;for(const source of caches.values()){source.controller?.abort();source.finish();}queue.length=0;caches.clear();}};
}

export function createOverlayEditor({state,api,persist,redraw,message,selectedPayload}){
 const $=s=>document.querySelector(s),make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};let panel=null,active=0;
 const liveSelection=()=>state.auto===true&&!state.historyMode&&state.replayIndex===null;
 const liveSources=createLiveOverlaySources({api,canRead:()=>state.package==='orderflow'&&liveSelection()&&window.__kwantyActive!==false&&!document.hidden,onChange:()=>{redraw();if(panel&&dialog.open)renderStatus();}});
 const dialog=make('dialog');dialog.id='profileOverlayDialog';dialog.setAttribute('aria-label','Profile overlay settings');document.body.append(dialog);
 const archive=createOverlayHistory({api,onChange:()=>{redraw();if(panel&&dialog.open)renderStatus();}});
 function slots(p){return p.profileSlots??=defaultProfileSlots();}
 const tickerFor=p=>p?.ticker||state.ticker;
 function ensure(slot,p){return liveSources.get(profileSelector(slot,tickerFor(p)));}
 function selection(slot,p,records){
  const target=selectedPayload(p)?.timestamp,pin=finite(slot.time);
  if((state.historyMode||state.replayIndex!==null||pin!==null&&sourceDate(pin)===sourceDate(target))&&finite(target)!==null){
   const time=profileSelectionTime(slot.time,target),result=archive.select(profileSelector(slot,tickerFor(p)),sourceDate(target),time),observed=selectProfileSnapshot(records,{ticker:tickerFor(p),targetTimestamp:target,pinnedTimestamp:slot.time,live:false}).payload;
   // Genuine observations collected in this browser remain usable while a
   // completed-session archive/page is unavailable. Never borrow a later row.
   const payload=observed&&(!result.payload||observed.timestamp>result.payload.timestamp)?observed:result.payload;
   return {...result,payload,error:payload?null:result.error,time:payload?.timestamp??time,records:result.records?.length?result.records:records,historical:true};
  }
  return {...selectProfileSnapshot(records,{ticker:tickerFor(p),targetTimestamp:target,pinnedTimestamp:slot.time,live:liveSelection()}),records};
 }
 function renderStatus(){const status=dialog.querySelector('.profile-source-status');if(!status||!panel)return;const slot=slots(panel)[active],cache=liveSources.peek(profileSelector(slot,tickerFor(panel))),selected=slot.show?selection(slot,panel,cache?.records||[]):{},picked=selected.payload,error=selected.historical?selected.error:cache?.error;if(slot.show&&!error&&!picked&&(selected.pending||cache?.pending)){showWorkspaceLoading(status,'Loading profile');return;}status.textContent=!slot.show?'Profile hidden':error?'Profile unavailable: '+error:picked?`Native ${profileSelector(slot,tickerFor(panel)).package}/${slot.category} · source ${sourceTime(picked.timestamp,state.settings.orderflow.timeZone)}`:'No actual same-session profile at or before this time. Historical profiles are not fabricated.';}
 function changed(rebuild=false){persist();redraw();if(rebuild)render();else renderStatus();}
 function render(){
  if(!panel)return;dialog.replaceChildren();const head=make('div');head.className='dialog-head';head.append(make('h2','profiles'));const close=make('button','×');close.type='button';close.setAttribute('aria-label','Close profile settings');close.onclick=()=>dialog.close();head.append(close);dialog.append(head);
  const tabs=make('div');tabs.className='profile-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Profile slots');slots(panel).forEach((slot,i)=>{const group=make('div'),button=make('button','profile '+(i+1));button.type='button';button.setAttribute('role','tab');button.setAttribute('aria-selected',String(i===active));button.onclick=()=>{active=i;render();};const show=make('input');show.type='checkbox';show.checked=slot.show;show.setAttribute('aria-label','Profile '+(i+1)+' visibility');show.onchange=()=>{slot.show=show.checked;changed(true);};group.append(button,show);tabs.append(group);});dialog.append(tabs);
  const slot=slots(panel)[active],section=(title)=>{const d=make('details');d.open=true;d.append(make('summary',title));dialog.append(d);return d;};
  const source=section('profile'),categoryLabel=make('label','Profile category'),category=make('select');category.setAttribute('aria-label','Profile category');for(const value of PROFILE_CATEGORIES){const o=make('option',value==='gex_full'?'90d agg':value==='gex_zero'?'latest GEX':value==='gex_one'?'next GEX':value.replace('_zero',' · latest').replace('_one',' · next'));o.value=value;category.append(o);}category.value=slot.category;category.onchange=()=>{slot.category=category.value;changed(true);};categoryLabel.append(category);source.append(categoryLabel);
  if(slot.category.startsWith('gex_'))for(const [value,label]of [['volume','gex by volume'],['oi','gex by oi']]){const l=make('label',label),input=make('input');input.type='checkbox';input.checked=(slot.gexDataType||(slot.showOI?'oi':'volume'))===value;input.disabled=!slot.show;input.setAttribute('aria-label',label);input.onchange=()=>{slot.gexDataType=value;slot.showVolume=value==='volume';slot.showOI=value==='oi';changed(true);};l.prepend(input);source.append(l);}
  const draw=section('draw'),align=make('label','profile alignment'),select=make('select');select.setAttribute('aria-label','Profile alignment');for(const value of ['left','center','right']){const o=make('option',value);o.value=value;select.append(o);}select.value=slot.alignment;select.onchange=()=>{slot.alignment=select.value;changed();};align.append(select);draw.append(align);
  for(const [key,label,min,max]of [['widthPercent','Profile width',1,100],['originPercent','Profile origin',0,100],['opacity','Profile opacity',0,100],['barWidthPercent','Profile bar width',1,100],['verticalOffset','Profile vertical offset',-100,100]]){const l=make('label',label),input=make('input'),out=make('output',String(slot[key]));input.type='range';input.min=min;input.max=max;input.step=1;input.value=slot[key];input.setAttribute('aria-label',label);input.oninput=()=>{slot[key]=Number(input.value);out.value=input.value;changed();};l.append(input,out);draw.append(l);}
  const offsetSteps=make('div');offsetSteps.className='profile-offset-steps';offsetSteps.setAttribute('role','group');offsetSteps.setAttribute('aria-label','Profile vertical offset steps');for(const delta of [-10,-5,-1,null,1,5,10]){const text=delta===null?'reset':delta>0?'+'+delta:String(delta),button=make('button',text);button.type='button';button.setAttribute('aria-label',delta===null?'Reset profile vertical offset':`Move profile vertical offset ${delta>0?'+':''}${delta} pixels`);button.onclick=()=>{slot.verticalOffset=shiftedProfileOffset(slot.verticalOffset,delta);changed(true);};offsetSteps.append(button);}draw.append(offsetSteps);
  const anchor=make('label','anchor to price'),anchorInput=make('input');anchorInput.type='checkbox';anchorInput.checked=slot.anchorToPrice;anchorInput.setAttribute('aria-label','Anchor profile origin to price');anchorInput.title='As in the source, anchors horizontal origin to the actual profile timestamp';anchorInput.onchange=()=>{slot.anchorToPrice=anchorInput.checked;changed();};anchor.prepend(anchorInput);draw.append(anchor);
  const layout=section('layout');for(const [label,disabled,action]of [['sync profiles',state.panels.length<2,()=>{for(const p of state.panels)if(p!==panel)p.profileSlots=structuredClone(slots(panel));}],['reset profiles',false,()=>{panel.profileSlots=defaultProfileSlots();}],['save as default',false,()=>{state.settings.orderflow.profileDefaults=structuredClone(slots(panel));}],['load defaults',!state.settings.orderflow.profileDefaults,()=>{panel.profileSlots=structuredClone(state.settings.orderflow.profileDefaults);} ]]){const button=make('button',label);button.type='button';button.disabled=disabled;button.onclick=()=>{action();changed(true);};layout.append(button);}
  const today=make('button','load session');today.type='button';today.disabled=!selectedPayload(panel);today.title='Load recorded profiles for this chart’s selected session';today.onclick=()=>{const target=selectedPayload(panel)?.timestamp;if(finite(target)===null)return;slot.time=target;archive.retry(profileSelector(slot,tickerFor(panel)),sourceDate(target));changed();};dialog.append(today);const status=make('p');status.className='small-note profile-source-status';dialog.append(status);dialog.append(make('p','Historical profiles use exact recorded observations. Missing sessions and timestamps are never invented.'));renderStatus();
 }
 function paint(ctx,geometry,p){if(!geometry)return;const target=selectedPayload(p);if(!target)return;const painted=slots(p).map(slot=>{if(!slot.show)return slot;const cache=ensure(slot,p),{time,payload}=selection(slot,p,cache.records);return {...slot,time,payload};});return drawProfileOverlay(ctx,geometry,{slots:painted,settings:{...state.settings.orderflow,stateSettings:state.settings.state,classicSettings:state.settings.classic,liveContractSettings:state.settings.state}});}
 function markerAt(p,layout,point,geometry){if(!layout||point.y<geometry.bottom-32||point.y>geometry.bottom+8)return null;const layer=layout.layers.slice().reverse().find(l=>Math.abs(l.markerX-point.x)<=8);if(!layer)return null;const slot=slots(p)[layer.slotIndex],cache=liveSources.peek(profileSelector(slot,tickerFor(p))),picked=selection(slot,p,cache?.records||[]);return {slotIndex:layer.slotIndex,available:(picked.records?.length||0)>1};}
 function dragTo(p,index,timeMs){const slot=slots(p)[index],cache=liveSources.peek(profileSelector(slot,tickerFor(p))),target=selectedPayload(p);if(!target)return;const picked=selection(slot,p,cache?.records||[]),timestamp=picked.historical?nearestArchivedProfileTime(picked.records||[],timeMs,target.timestamp):nearestActualProfileTime(picked.records||[],timeMs,target.timestamp,tickerFor(p));if(timestamp!==null){slot.time=timestamp;persist();}}
 function frameReady(p,timestamp){let pending=false;for(const slot of slots(p)){if(!slot.show)continue;const time=profileSelectionTime(slot.time,timestamp);if(time===null)continue;const result=archive.select(profileSelector(slot,tickerFor(p)),sourceDate(timestamp),time);if(result.error)return {pending:false,error:result.error};pending=pending||!!result.pending;}return {pending,error:null};}
 function open(p){panel=p;active=0;render();dialog.show();}
 function retryHistory(date){const seen=new Set();for(const p of state.panels){for(const slot of slots(p)){if(!slot.show)continue;const selector=profileSelector(slot,tickerFor(p)),key=JSON.stringify(selector);if(seen.has(key))continue;seen.add(key);archive.retry(selector,date);}}}
 return {paint,open,markerAt,dragTo,frameReady,retryHistory,close:()=>dialog.close(),dispose:()=>{liveSources.dispose();archive.dispose();dialog.remove();}};
}
