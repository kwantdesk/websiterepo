import {themePaint} from './site-theme.js';
import {botStorage,botFetch} from './site-runtime.js';
// Independently implemented from captured 783.de20bf0d.chunk.js 31900–39100
// and main.f5205cc4.js module19953. No vendor code/runtime is loaded.
const validCategories=new Set(['gex_full','gex_zero','gex_one',...['delta','gamma','vanna','charm'].flatMap(f=>[`${f}_zero`,`${f}_one`])]);
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const ms=v=>{const n=finite(v);if(n!==null)return Math.abs(n)<1e11?n*1000:n;const d=typeof v==='string'?Date.parse(v):NaN;return Number.isFinite(d)?d:null;};
const bounded=(v,min,max,fallback)=>{const n=finite(v);return n===null?fallback:Math.max(min,Math.min(max,n));};
const displayed=(settings,key)=>typeof settings[key]==='object'?settings[key]?.display!==false:settings[key]!==false;
const palette=(settings,key,fallback)=>settings[key]?.color?.trim()||fallback;
export function defaultProfileSlots(){return Array.from({length:3},()=>({show:false,source:'state',category:'gex_zero',showVolume:true,showOI:false,alignment:'center',widthPercent:25,originPercent:50,barWidthPercent:85,opacity:100,verticalOffset:0,anchorToPrice:false,time:null}));}
export function normalizeProfileSlot(slot={}){return {...defaultProfileSlots()[0],...slot,show:slot.show===true,source:slot.source==='classic'?'classic':'state',category:validCategories.has(slot.category)?slot.category:'gex_zero',alignment:['left','center','right'].includes(slot.alignment)?slot.alignment:'center',widthPercent:bounded(slot.widthPercent,0,100,25),originPercent:bounded(slot.originPercent,0,100,50),barWidthPercent:bounded(slot.barWidthPercent,0,100,85),opacity:bounded(slot.opacity??slot.opacityPercent,0,100,100),verticalOffset:bounded(slot.verticalOffset,-100,100,0)};}
function nativePayload(input,category,source,selectedTime,warnings){
 if(!input)return null;const envelope=input.data&&typeof input.data==='object'?input:null,data=envelope?input.data:input;
 if((envelope?.category&&envelope.category!==category)||(envelope?.package&&envelope.package!==source)){warnings.push('Profile payload scope does not match its category/source.');return null;}
 const timestamp=ms(data.timestamp??envelope?.providerAsOf);if(selectedTime!==null&&timestamp!==null&&timestamp>selectedTime){warnings.push('Future profile snapshot excluded from selected time.');return null;}
 return {data,timestamp,providerAsOf:envelope?.providerAsOf??(timestamp===null?null:new Date(timestamp).toISOString())};
}
function colorsFor(category,type,settings){
 const state=settings.stateSettings??settings.state??settings,classic=settings.classicSettings??settings.classic??settings,greek=settings.liveContractSettings??settings.greeks??settings;
 if(type==='openInterest')return {positive:palette(classic,'gex_oi',themePaint("#00942A")),negative:palette(classic,'gex_oi_neg',themePaint("#940D0D"))};
 if(category.startsWith('gex_'))return {positive:palette(state,'gex_vol',themePaint("#2BE05C")),negative:palette(state,'gex_vol_neg',themePaint("red"))};
 const family=category.split('_')[0],positive={get delta(){return themePaint("#4CAF50");},get gamma(){return themePaint("#00FFFF");},get vanna(){return themePaint("#3682f0");},get charm(){return themePaint("#DAA520");}}[family];return {positive:palette(greek,family,positive),negative:palette(greek,`${family}_neg`,themePaint("#ae4ad5"))};
}
export function extractOverlayEntries(payload,{category='gex_zero',type='volume',settings={}}={}){
 const data=payload?.data??payload??{},gex=category.startsWith('gex_'),state=settings.stateSettings??settings.state??settings,greeks=settings.liveContractSettings??settings.greeks??settings,colors=colorsFor(category,type,settings),bars=[],priors=[];
 if(!validCategories.has(category))return {bars,priors};
 const tuples=gex?data.strikes:data.mini_contracts;if(!Array.isArray(tuples))return {bars,priors};
 for(const row of tuples){if(!Array.isArray(row))continue;const strike=finite(row[0]);if(strike===null)continue;const value=finite(row[gex?(type==='openInterest'?2:1):3]);if(value!==null&&value!==0&&(!gex||type==='openInterest'||displayed(state,'gex_vol')))bars.push({kind:'bar',strike,value,color:value<0?colors.negative:colors.positive,type});
  if(type==='openInterest')continue;const nativePriors=row[gex?3:4];if(!Array.isArray(nativePriors))continue;
  const minutes=gex?[1,5,10,15,30]:[5,15,30],keys=gex?['one','five','ten','fifteen','thirty']:['five','fifteen','thirty'].map(t=>`${category.split('_')[0]}_${t}`);
  for(let i=0;i<minutes.length;i++){const prior=finite(nativePriors[i]),style=gex?state:greeks;if(prior===null||prior===0||!displayed(style,keys[i]))continue;const c=gex?palette(state,keys[i],[themePaint("#add8e6"),themePaint("#5dd6f5"),themePaint("#00a2de"),themePaint("#006cc0"),themePaint("#003494")][i]):prior<0?colors.negative:colors.positive;
   priors.push({kind:'prior',strike,value:prior,color:c,type,minutes:minutes[i],size:gex?bounded(style[keys[i]]?.size,0,100,1):1,borderColor:gex?themePaint("#ffffff"):c,borderWidth:gex?.01:.5});
  }
 }
 return {bars,priors};
}
export function buildProfileOverlayLayout(geometry,{slots=[],settings={}}={}){
 const {left,right,top,bottom}=geometry,width=right-left,height=bottom-top,layers=[],warnings=[];
 if(!(width>0&&height>0)||typeof geometry.spotY!=='function')return {layers,warnings:['A valid independent spot-price scale is required.'],hitTest:()=>null};
 for(const [slotIndex,input]of slots.slice(0,3).entries()){
  const slot=normalizeProfileSlot(input);if(!slot.show||slot.widthPercent===0)continue;if(input.category&&!validCategories.has(input.category)){warnings.push('Unsupported profile category; no classified volume split is inferred.');continue;}
  const selectedTime=ms(slot.time),isGex=slot.category.startsWith('gex_'),sources=[];
  if(isGex){if(slot.showVolume!==false){const inputPayload=slot.payloadVolume??(!slot.showOI?slot.payload:null);const p=nativePayload(inputPayload,slot.category,'state',selectedTime,warnings);if(p)sources.push({...p,type:'volume'});}if(slot.showOI===true){const p=nativePayload(slot.payloadOI??(slot.showVolume===false?slot.payload:null),slot.category,'classic',selectedTime,warnings);if(p)sources.push({...p,type:'openInterest'});}}
  else {const p=nativePayload(slot.payload,slot.category,'state',selectedTime,warnings);if(p)sources.push({...p,type:'volume'});}
  if(!sources.length){warnings.push(`Profile ${slotIndex+1} has no matching native payload.`);continue;}
  if(isGex&&slot.showVolume!==false&&slot.showOI===true)warnings.push('Combined volume/OI in one slot is an extension; the source selector is exclusive.');
  const timestamps=[...new Set(sources.map(s=>s.timestamp).filter(t=>t!==null))];if(timestamps.length>1){warnings.push(`Profile ${slotIndex+1} contains unmatched source timestamps.`);continue;}
  const transform=slot.priceTransform??settings.priceTransform??{},multiplier=finite(transform.multiplier??settings.priceMultiplier)??1,additive=finite(transform.additive??settings.priceOffset)??0;
  if(!(multiplier>0)){warnings.push('Profile price multiplier must be positive.');continue;}
  const entries=sources.map(source=>({...source,...extractOverlayEntries(source.data,{category:slot.category,type:source.type,settings})})),bars=entries.flatMap(p=>p.bars),priors=entries.flatMap(p=>p.priors),all=[...bars,...priors],normalizer=Math.max(0,...all.map(e=>Math.abs(e.value)));if(!(normalizer>0))continue;
  const timestamp=timestamps[0]??null,markerTime=selectedTime??timestamp,markerX=markerTime!==null&&typeof geometry.timeX==='function'?geometry.timeX(markerTime):null,origin=slot.anchorToPrice&&Number.isFinite(markerX)?markerX:left+width*slot.originPercent/100,profileWidth=width*slot.widthPercent/100;
  const priceY=strike=>geometry.spotY(strike*multiplier+additive)-slot.verticalOffset,positions=[...new Set(all.map(e=>e.strike))].map(priceY).filter(y=>Number.isFinite(y)&&y>=top&&y<=bottom).sort((a,b)=>a-b);let spacing=Infinity;for(let i=1;i<positions.length;i++)spacing=Math.min(spacing,positions[i]-positions[i-1]);
  const baseHeight=Number.isFinite(spacing)?Math.min(7,.72*spacing):4,barHeight=Math.max(1,baseHeight*slot.barWidthPercent/100),endX=value=>{const length=Math.abs(value)/normalizer*profileWidth;return slot.alignment==='left'?origin-length:slot.alignment==='right'?origin+length:origin+(value<0?-length:length);};
  const grouped=new Map;for(const entry of bars){const list=grouped.get(entry.strike)??[];list.push(entry);grouped.set(entry.strike,list);}
  const drawnBars=[];for(const [strike,group]of grouped){const y=priceY(strike);if(!Number.isFinite(y)||y<top-barHeight||y>bottom+barHeight)continue;const chunk=barHeight/group.length;for(const [i,e]of group.entries()){const end=endX(e.value);drawnBars.push({...e,slotIndex,convertedStrike:strike*multiplier+additive,x:Math.min(origin,end),y:y-barHeight/2+i*chunk,width:Math.max(1,Math.abs(end-origin)),height:Math.max(1,chunk)});}}
  const drawnPriors=priors.map(e=>({...e,slotIndex,convertedStrike:e.strike*multiplier+additive,x:endX(e.value),y:priceY(e.strike),radius:Math.max(1,barHeight/2.5*e.size)})).filter(e=>Number.isFinite(e.y)&&e.y>=top-barHeight&&e.y<=bottom+barHeight);
  layers.push({slotIndex,slot,normalizer,origin,profileWidth,barHeight,timestamp,markerTime,markerX,providerAsOf:entries[0].providerAsOf,bars:drawnBars,priors:drawnPriors});
 }
 const hitTest=(x,y)=>{if(x<left||x>right||y<top||y>bottom)return null;for(const layer of layers.slice().reverse()){for(const p of layer.priors.slice().reverse())if(Math.hypot(p.x-x,p.y-y)<=Math.max(5,p.radius))return {...p,category:layer.slot.category,providerAsOf:layer.providerAsOf};for(const b of layer.bars.slice().reverse())if(x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height)return {...b,category:layer.slot.category,providerAsOf:layer.providerAsOf};}return null;};
 return {layers,warnings,hitTest};
}
export function drawProfileOverlay(ctx,geometry,options={}){
 const layout=buildProfileOverlayLayout(geometry,options),{left,right,top,bottom}=geometry;
 for(const layer of layout.layers){ctx.save();ctx.globalAlpha=layer.slot.opacity/100;ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();for(const b of layer.bars){ctx.fillStyle=b.color;ctx.fillRect(b.x,b.y,b.width,b.height);}for(const p of layer.priors){ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,2*Math.PI);ctx.fillStyle=p.color;ctx.fill();if(p.borderWidth>0){ctx.lineWidth=p.borderWidth;ctx.strokeStyle=p.borderColor;ctx.stroke();}}ctx.restore();}
 const markerStyle=options.settings?.time_marker??{};if(markerStyle.display!==false){for(const layer of layout.layers){const x=layer.markerX;if(!Number.isFinite(x)||x<left||x>right)continue;const y=bottom-1-7*layer.slotIndex,color=markerStyle.color||themePaint("#ff9800"),opacity=bounded(markerStyle.opacity,0,1,1);ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=bounded(markerStyle.size,1,10,1);if(markerStyle.showVerticalLine!==false){ctx.globalAlpha=.5*opacity;ctx.setLineDash(markerStyle.lineType==='solid'?[]:markerStyle.lineType==='dotted'?[2,3]:markerStyle.lineType==='simple-dashed'?[6,2]:[8,4]);ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,y-7);ctx.stroke();}ctx.globalAlpha=opacity;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-5,y-7);ctx.lineTo(x+5,y-7);ctx.closePath();ctx.fill();ctx.restore();}}
 return layout;
}
