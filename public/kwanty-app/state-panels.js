export const STATE_PROFILES = [
 ['gex_full','GEX · aggregate'],['gex_zero','GEX · latest'],['gex_one','GEX · next'],
 ...['delta','gamma','vanna','charm'].flatMap(name=>['zero','one'].map(expiry=>[name+'_'+expiry,name[0].toUpperCase()+name.slice(1)+' · '+(expiry==='zero'?'latest':'next')]))
];
export function statePanelCategory(panel){return panel?.greek?`${panel.greek}_${panel.greekExpiry==='one'?'one':'zero'}`:['gex_full','gex_zero','gex_one'].includes(panel?.gexCategory)?panel.gexCategory:'gex_full';}
export const statePanelLabel=panel=>STATE_PROFILES.find(([key])=>key===statePanelCategory(panel))?.[1]||'State';
export function selectStateProfile(panel,category){if(!STATE_PROFILES.some(([key])=>key===category))return false;const [family,expiry]=category.split('_');if(family==='gex'){panel.gexCategory=category;panel.greek=null;}else{panel.greek=family;panel.greekExpiry=expiry;}return true;}
export const stateSourceKey=panel=>`${panel.ticker}/${statePanelCategory(panel)}`;
export function restoreStatePanels(saved,{ticker,scope,settings,uuid=()=>crypto.randomUUID()}){
 const ids=new Set(),result=[];
 for(const candidate of Array.isArray(saved)?saved:[]){
  if(!candidate||typeof candidate!=='object')continue;
  const panel={...candidate,id:typeof candidate.id==='string'&&!ids.has(candidate.id)?candidate.id:uuid(),ticker:typeof candidate.ticker==='string'&&/^[A-Z_]{1,12}$/.test(candidate.ticker)?candidate.ticker:ticker};
  if(!['delta','gamma','vanna','charm'].includes(panel.greek))panel.greek=null;
  if(!['gex_full','gex_zero','gex_one'].includes(panel.gexCategory))panel.gexCategory='gex_full';
  panel.greekExpiry=panel.greekExpiry==='one'?'one':'zero';
  panel.settings={...structuredClone(settings),...structuredClone(panel.settings&&typeof panel.settings==='object'&&!Array.isArray(panel.settings)?panel.settings:{})};
  panel.viewportLinked=panel.viewportLinked===true;panel.crosshairLinked=panel.crosshairLinked===true;
  if(['line','candles'].includes(panel.priceViewMode))panel.settings.spotViewMode=panel.priceViewMode;
  panel.height=Number.isFinite(panel.height)&&panel.height>0?panel.height:1;
  ids.add(panel.id);result.push(panel);
 }
 return result.length?result:restoreStatePanels([{id:uuid(),ticker,...scope,settings:structuredClone(settings),height:1}],{ticker,scope,settings,uuid});
}
export function stateControlTargets(panels,id){const active=panels.find(panel=>panel.id===id)||panels[0];return !active?[]:active.viewportLinked?panels.filter(panel=>panel.viewportLinked):[active];}
export function sameStatePriceUnits(a,b){return a?.ticker===b?.ticker&&(Number(a?.settings?.priceMultiplier)||1)===(Number(b?.settings?.priceMultiplier)||1)&&(Number(a?.settings?.priceOffset)||0)===(Number(b?.settings?.priceOffset)||0);}
export function stateViewportUpdates(panels,id,next){
 const source=panels.find(panel=>panel.id===id),updates=new Map([[id,{...next}]]);
 if(source?.viewportLinked)for(const panel of panels)if(panel.id!==id&&panel.viewportLinked){
  const shared={};for(const [low,high]of [['startTime','endTime'],...(sameStatePriceUnits(source,panel)?[['minPrice','maxPrice']]:[])])if(Number.isFinite(next[low])&&Number.isFinite(next[high])&&next[high]>next[low])Object.assign(shared,{[low]:next[low],[high]:next[high]});
  updates.set(panel.id,shared);
 }
 return updates;
}
export function stateCursor(geometry,point){const hit=geometry?.hitTest(point.x,point.y);return hit&&Number.isFinite(hit.time)?{time:hit.time,price:hit.price}:null;}
export function projectStateCursor(geometry,cursor,sharePrice=true){
 if(!geometry||!cursor||cursor.time<geometry.startTime||cursor.time>geometry.endTime)return null;
 const x=geometry.timeX(cursor.time),y=sharePrice&&Number.isFinite(cursor.price)?geometry.priceY(cursor.price):null;
 return {x,time:cursor.time,...(Number.isFinite(y)&&y>=geometry.top&&y<=geometry.bottom?{y}:{})};
}
