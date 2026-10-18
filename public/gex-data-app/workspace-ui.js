import {themePaint} from './site-theme.js?v=1';
import {gexStorage} from './site-runtime.js?v=1';
import {createBoardWorkspace,createWorkspace,workspaceAction,workspaceTabsets,workspaceOrientation,workspaceDockLocation,workspaceDockRect,serializeWorkspace,validateTabName} from './workspace-model.js?v=1';
import {TOOL_CONFIGURATION_OPTIONS,sanitizeToolConfiguration,setConfigurationVisibility} from './preferences-model.js?v=1';

const KEYS={layout:'gex-data:workspace:v1',configuration:'gex-data:configuration:v1',page:'gex-data:page-filters:v1',global:'gex-data:global-filters:v1',groups:'gex-data:filter-groups:v1'};
const read=(key,fallback)=>{try{return JSON.parse(gexStorage.getItem(key))??fallback;}catch{return fallback;}};
const write=(key,value)=>{gexStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new CustomEvent('gex-data-preferences'));};
const node=(tag,cls='',text)=>{const el=document.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el;};
const button=(text,action,cls='')=>{const el=node('button',cls,text);el.type='button';el.addEventListener('click',action);return el;};
export const getConfiguration=()=>sanitizeToolConfiguration(read(KEYS.configuration,{}));
export const getFilterOverrides=()=>({page:read(KEYS.page,{}),global:read(KEYS.global,{})});
export const getFilterGroups=()=>read(KEYS.groups,[]).filter(group=>group&&typeof group.id==='string'&&typeof group.name==='string');
export const filterGroupTypeForTool=toolId=>toolId==='equity-prints'?'EQUITY_PRINTS_PROCESSED':toolId==='exchange-notifications'?'EXCHANGE_NOTIFICATIONS':toolId==='order-flow-consolidated'?'OPTION_TRADES_CONSOLIDATED':'OPTION_TRADES_UNCONSOLIDATED';

export function applyDocumentPreferences(){
  const config=getConfiguration();for(const {key} of TOOL_CONFIGURATION_OPTIONS)document.documentElement.classList.toggle(key,config[key]);
  return config;
}

let currentPopup;
function portalWindow(){try{return parent!==window&&parent.location.origin===location.origin&&parent.document.documentElement.classList.contains('has-dock-workspace')?parent:window;}catch{return window;}}
function closePopup(){currentPopup?.remove();currentPopup=null;portalWindow().document.querySelectorAll('.workspace-popup').forEach(el=>el.remove());}
document.addEventListener('pointerdown',event=>{const visible=currentPopup?.isConnected?currentPopup:document.querySelector('.workspace-popup');if(visible&&!visible.contains(event.target)&&!event.target.closest('.top-action,.dock-tab-menu,.dock-add,.dock-overflow'))closePopup();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closePopup();});
export function popup(anchor,title,build){
  closePopup();const el=node('section','workspace-popup');el.setAttribute('role','dialog');el.setAttribute('aria-label',title);el.append(node('h3','',title));
  const owner=portalWindow();el.append(button('×',closePopup,'popup-close'));build(el);owner.document.body.append(el);currentPopup=el;
  const r=anchor?.getBoundingClientRect?.()??{left:innerWidth/2,top:70,bottom:70},offset=owner!==window?window.frameElement.getBoundingClientRect():{left:0,top:0},bounds=el.getBoundingClientRect();
  el.style.left=`${Math.max(8,Math.min(owner.innerWidth-bounds.width-8,r.left+offset.left))}px`;const below=r.bottom+offset.top+6,above=r.top+offset.top-bounds.height-6;
  el.style.top=`${Math.max(8,Math.min(owner.innerHeight-bounds.height-8,below+bounds.height>owner.innerHeight-8&&above>=8?above:below))}px`;
  return el;
}

function dialog(title,build){
  const el=node('dialog','workspace-dialog');el.setAttribute('aria-label',title);const header=node('header');header.append(node('h2','',title),button('×',()=>el.close()));el.append(header);build(el);portalWindow().document.body.append(el);el.addEventListener('close',()=>el.remove());el.showModal();return el;
}
export const showDataDialog=dialog;
export function confirmLocalAction(title,message,action,event){if(event?.shiftKey){action();return;}dialog(title,el=>el.append(node('p','',message),button('Cancel',()=>el.close()),button('Confirm',()=>{action();el.close();})));}

export function showToolConfiguration(anchor){
  popup(anchor,'Tool Configuration',el=>{
    const configuration=getConfiguration();for(const {key,label} of TOOL_CONFIGURATION_OPTIONS){const row=node('label','configuration-row'),input=document.createElement('input');input.type='checkbox';input.setAttribute('role','switch');input.checked=!configuration[key];input.setAttribute('aria-label',label);
      input.addEventListener('change',()=>write(KEYS.configuration,setConfigurationVisibility(getConfiguration(),key,input.checked)));row.append(node('span','',label),input);el.append(row);}
  });
}

function filterCount(filters){return (filters.tickers?.length||0)+(filters.expirationDate?1:0)+(filters.sessionDate?1:0);}
export function showSharedFilters(anchor,scope='page'){
  const key=KEYS[scope],title=scope==='page'?'Page Tool Filters':'Global Tool Filters';
  popup(anchor,title,el=>{
    const initial=read(key,{}),ticker=node('input'),expiry=node('input'),session=node('input');ticker.value=(initial.tickers||[]).join(', ');ticker.placeholder='Tickers · comma separated';ticker.setAttribute('aria-label',title+' tickers');expiry.type=session.type='date';expiry.value=initial.expirationDate||'';session.value=initial.sessionDate||'';
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const update=()=>{const next={tickers:[...new Set(ticker.value.toUpperCase().split(/[,\s]+/).filter(Boolean))],expirationDate:expiry.value,sessionDate:session.value};if(next.tickers.some(value=>! /^[A-Z0-9./^+-]{1,30}$/.test(value)))return;expiry.min=session.value||today;session.max=expiry.value&&expiry.value<today?expiry.value:today;write(key,next);};
    for(const [label,input] of [['Tickers',ticker],['Expiration',expiry],['Session Date',session]]){const field=node('label','workspace-field');field.append(node('span','',label),input);el.append(field);input.addEventListener('change',update);}
    expiry.min=session.value||today;session.max=expiry.value&&expiry.value<today?expiry.value:today;
    el.append(button('Clear filters',()=>{ticker.value=expiry.value=session.value='';update();}));
    el.append(node('p','workspace-note','Page overrides Global; Global overrides individual tool settings. Empty fields fall through. Changes apply to this local GEX DATA only.'));
  });
}

export function showFilterGroups(anchor,{activeIds=[],onChange=()=>{},toolId}={}){
  popup(anchor,'Filter Groups',el=>{
    const list=node('div','filter-group-list');el.append(list);
    const render=()=>{list.replaceChildren();for(const group of getFilterGroups().filter(group=>(group.type||'OPTION_TRADES_UNCONSOLIDATED')===filterGroupTypeForTool(toolId))){const row=node('div','filter-group-row'),input=document.createElement('input');input.type='checkbox';input.checked=activeIds.includes(group.id);input.setAttribute('aria-label','Attach '+group.name);input.addEventListener('change',()=>{activeIds=input.checked?[group.id,...activeIds]:activeIds.filter(id=>id!==group.id);onChange(activeIds);});row.append(input,node('span','',group.name),button('Edit',()=>editFilterGroup(group,render,toolId)));list.append(row);}if(!list.children.length)list.append(node('p','workspace-note','No compatible local filter groups yet.'));};render();
    el.append(button('+ Create Filter Group',()=>editFilterGroup(null,render,toolId)));
    el.append(node('p','workspace-note','These groups filter upstream API results, not only loaded table rows. market-data public-group sharing is not connected.'));
  });
}

async function editFilterGroup(existing,onSaved,toolId){
  const {mountFilterEditor}=await import('./filter-editor.js?v=1');
  dialog(existing?'Edit Filter Group':'Create Filter Group',el=>{
    el.classList.add('filter-group-editor-dialog');const name=node('input'),description=node('textarea');name.maxLength=64;name.placeholder='Filter group name';name.value=existing?.name||'';description.maxLength=1024;description.placeholder='Description';description.value=existing?.description||'';
    for(const [label,input] of [['Name',name],['Description',description]]){const field=node('label','workspace-field');field.append(node('span','',label),input);el.append(field);}
    const editorHost=node('div');el.append(editorHost);const editor=mountFilterEditor(editorHost,{expression:existing?.expression,toolId:existing?.toolId||toolId});el.addEventListener('close',()=>editor.destroy());
    const error=node('p','workspace-error');el.append(error,button('Save Filter Group',()=>{try{if(!name.value.trim())throw new Error('Enter a group name.');const normalized=editor.getExpression();const groups=getFilterGroups(),group={id:existing?.id||crypto.randomUUID(),name:name.value.trim(),description:description.value,toolId:existing?.toolId||toolId,type:existing?.type||filterGroupTypeForTool(toolId),expression:normalized};write(KEYS.groups,[...groups.filter(item=>item.id!==group.id),group]);onSaved?.();el.close();}catch(e){error.textContent=e.message;}}));
  });
}

export function toolLink(tab,{embedded=false}={}){
  const url=new URL(embedded?'/gex-data-app/index.html':'/gex-data',location.origin);if(embedded){url.searchParams.set('embed','1');url.searchParams.set('instance',tab.id);}else{url.searchParams.set('instance',tab.id);url.searchParams.set('gexTool',tab.tool);}
  for(const [key,value] of Object.entries(tab.controls||{}))if(value!==null&&value!==undefined&&value!=='')url.searchParams.set('c_'+key,String(value));
  if(tab.minute!=null)url.searchParams.set('snapshot',String(tab.minute));if(embedded)url.hash='tool='+tab.tool;return url.href;
}

export function bootWorkspace({tools,showBoard,openTool}){
  if(new URLSearchParams(location.search).get('embed')==='1')return null;
  const root=document.querySelector('#dashboard');root.replaceChildren();root.classList.add('dock-workspace');document.documentElement.classList.add('has-dock-workspace');
  if(gexStorage.getItem(KEYS.page)===null)gexStorage.setItem(KEYS.page,JSON.stringify({tickers:[],expirationDate:'',sessionDate:''}));
  const definitions=new Map(tools.map(tool=>[tool.id,tool]));
  const common={mode:'latest',date:'',expiry:'',greek:'GAMMA',representation:'PER_ONE_PERCENT_MOVE'};
  const defaultTabs=[
    {id:'exposure-qqq',name:'Exposure by Strike',tool:'exposure-by-strike',controls:{...common,ticker:'QQQ',exposureOrientation:'VERTICAL',exposureDisplay:'NET'}},
    {id:'interval-spx',name:'Interval Map',tool:'interval-map',controls:{...common,ticker:'SPX',period:'1m',strikePadding:'1'}},
    {id:'interval-ndx',name:'Interval Map',tool:'interval-map',controls:{...common,ticker:'NDX',period:'1m',strikePadding:'3'}},
    ...['QQQ','SPX','NDX'].map(ticker=>({id:'drift-'+ticker.toLowerCase(),name:'Net Drift '+ticker,tool:'net-drift',controls:{...common,ticker,moneyType:'OTM',period:'1m'}}))
  ];
  const defaults=()=>{let state=createBoardWorkspace(defaultTabs,{topWeights:[1,1,1],bottomWeights:[1,1,1]});
    for(const tab of [{id:'stock-qqq',name:'QQQ',tool:'stock-price-over-time',controls:{...common,ticker:'QQQ',period:'1m'}},{id:'forecast-qqq',name:'Exposure Forecast',tool:'exposure-forecast',controls:{...common,ticker:'QQQ'}}])state=workspaceAction(state,{type:'add',tabsetId:'set-exposure-qqq',tab});state=workspaceAction(state,{type:'move',tabId:'stock-qqq',targetTabsetId:'set-exposure-qqq',location:'center',index:0});return workspaceAction(state,{type:'select',tabId:'exposure-qqq'});};
  let state;
  try{const saved=read(KEYS.layout,null);state=saved?createWorkspace([],saved):defaults();const sets=workspaceTabsets(state);if(sets.length>16||sets.flatMap(set=>set.children).length>32||sets.some(set=>set.children.some(tab=>typeof tab.id!=='string'||!definitions.has(tab.tool))))throw new Error('Invalid saved layout');}catch{state=defaults();}
  const layout=node('div','dock-layout'),contents=node('div','dock-contents'),glass=node('div','dock-drag-glass'),outline=node('div','dock-drop-outline');glass.hidden=outline.hidden=true;root.append(layout,contents,glass,outline);
  const frames=new Map();let bodyRects=new Map(),drag=null,popouts=new Map();
  const presetsKey='gex-data:saved-workspaces:v1';
  function validateSnapshot(values){if(!values||typeof values!=='object'||!values[KEYS.layout])throw Error('Choose a GEX DATA workspace export.');const candidate=createWorkspace([],JSON.parse(values[KEYS.layout])),sets=workspaceTabsets(candidate);if(sets.length>16||sets.flatMap(set=>set.children).length>32||sets.some(set=>set.children.some(tab=>!definitions.has(tab.tool))))throw Error('The workspace contains unsupported tools or too many panels.');return values;}
  function restoreSnapshot(values){gexStorage.restore(validateSnapshot(values));location.reload();}
  function workspaceMenu(anchor){popup(anchor,'Workspaces',el=>{
    const saved=read(presetsKey,[]);
    el.append(button('Save workspace as…',()=>dialog('Save workspace',d=>{const input=node('input');input.placeholder='Workspace name';input.maxLength=64;input.setAttribute('aria-label','Workspace name');const error=node('p','workspace-error');d.append(input,error,button('Save',()=>{try{const name=input.value.trim();if(!name)throw Error('Enter a workspace name.');const list=read(presetsKey,[]).filter(p=>p.name!==name);if(list.length>=12)throw Error('Remove a saved workspace before adding another.');gexStorage.setItem(presetsKey,JSON.stringify([{name,values:gexStorage.snapshot()},...list]));d.close();closePopup();}catch(e){error.textContent=e.message;}}));})),button('Export workspace',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({format:'kwantdesk-gex-data',version:1,values:gexStorage.snapshot()},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='kwantdesk-gex-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}),button('Import workspace…',()=>{const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.addEventListener('change',async()=>{try{const file=input.files?.[0];if(!file)return;if(file.size>1500000)throw Error('The workspace file is too large.');const data=JSON.parse(await file.text());if(data.format!=='kwantdesk-gex-data'||data.version!==1)throw Error('Choose a KwantDesk GEX DATA export.');validateSnapshot(data.values);confirmLocalAction('Import workspace','Replace this page with the imported workspace?',()=>restoreSnapshot(data.values));}catch(e){notify(e.message);}});input.click();}));
    for(const preset of saved){const row=node('div','filter-group-row');row.append(button(preset.name,()=>confirmLocalAction('Load workspace',`Load “${preset.name}”?`,()=>restoreSnapshot(preset.values))),button('Remove',()=>confirmLocalAction('Remove saved workspace',`Remove “${preset.name}” from your saved workspaces?`,()=>{gexStorage.setItem(presetsKey,JSON.stringify(saved.filter(p=>p.name!==preset.name)));closePopup();})));el.append(row);}
  });}
  const workspacesButton=button('Workspaces',event=>workspaceMenu(event.currentTarget),'top-action wide');workspacesButton.setAttribute('aria-label','GEX DATA workspaces');document.querySelector('.top-actions').append(workspacesButton);
  const persist=()=>{try{gexStorage.setItem(KEYS.layout,JSON.stringify(serializeWorkspace(state)));}catch{}};
  const act=action=>{try{if(action.type==='duplicate'){action={...action,newId:crypto.randomUUID()};const original=workspaceTabsets(state).flatMap(set=>set.children).find(tab=>tab.id===action.tabId);const oldFrame=frames.get(action.tabId);if(original&&oldFrame)oldFrame.contentWindow?.postMessage({type:'gex-data-save-state'},location.origin);for(const key of [`gex-data-tool-groups:${action.tabId}`,`gex-data-chart-windows:${action.tabId}`,`gex-data-market-map-camera:${action.tabId}`]){const value=gexStorage.getItem(key);if(value!==null)gexStorage.setItem(key.replace(action.tabId,action.newId),value);}}
    const next=workspaceAction(state,action),sets=workspaceTabsets(next);if(sets.length>16||sets.flatMap(set=>set.children).length>32)throw Error('This workspace supports up to 16 panes and 32 tools.');state=next;persist();render();}catch(error){notify(error.message);}};
  function notify(message){popup(document.querySelector('#openLibrary'),'GEX DATA',el=>el.append(node('p','',message)));}
  function send(frame,type,data={}){frame.contentWindow?.postMessage({type,...data},location.origin);}
  function getFrame(tab){
    let frame=frames.get(tab.id);if(!frame){frame=node('iframe','dock-tool-frame');frame.title=tab.name;frame.dataset.instance=tab.id;frame.src=toolLink(tab,{embedded:true});frame.setAttribute('allow','fullscreen');contents.append(frame);frames.set(tab.id,frame);frame.addEventListener('load',()=>{send(frame,'gex-data-preferences');send(frame,'gex-data-visibility',{visible:!frame.hidden});});}return frame;
  }
  function syncFrames(){
    const rr=root.getBoundingClientRect(),visible=new Set();bodyRects=new Map();
    for(const set of workspaceTabsets(state)){const body=layout.querySelector(`[data-body="${CSS.escape(set.id)}"]`);if(!body)continue;const rect=body.getBoundingClientRect();bodyRects.set(set.id,rect);const tab=set.children[set.selected??0];if(!tab||!rect.width||!rect.height||popouts.has(tab.id))continue;
      const frame=getFrame(tab);frame.title=tab.name;visible.add(tab.id);const old=frame.hidden;frame.hidden=false;Object.assign(frame.style,{left:`${rect.left-rr.left}px`,top:`${rect.top-rr.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});if(old)send(frame,'gex-data-visibility',{visible:true});}
    for(const [id,frame] of frames){if(!visible.has(id)){if(!frame.hidden)send(frame,'gex-data-visibility',{visible:false});frame.hidden=true;}if(!workspaceTabsets(state).some(set=>set.children.some(tab=>tab.id===id))){frame.remove();frames.delete(id);}}
  }
  function render(){
    layout.replaceChildren();const max=state.maximizedTabsetId;const visit=(item,depth=0)=>{
      if(item.type==='tabset')return renderSet(item);
      const row=node('div','dock-row '+(workspaceOrientation(depth)==='horizontal'?'dock-horizontal':'dock-vertical'));row.dataset.node=item.id;
      item.children.forEach((child,index)=>{const element=visit(child,depth+1);element.style.flex=`${Math.max(0,Number(child.weight??100))} 1 0px`;row.append(element);if(index<item.children.length-1){const splitter=node('div','dock-splitter');splitter.setAttribute('role','separator');splitter.tabIndex=0;splitter.setAttribute('aria-label','Resize workspace panes');splitter.setAttribute('aria-orientation',workspaceOrientation(depth)==='horizontal'?'vertical':'horizontal');
          splitter.addEventListener('pointerdown',event=>resizeStart(event,splitter,row,child,item.children[index+1],workspaceOrientation(depth)));splitter.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const a=element.getBoundingClientRect(),b=row.children[index*2+2]?.getBoundingClientRect(),horizontal=workspaceOrientation(depth)==='horizontal',delta=['ArrowLeft','ArrowUp'].includes(event.key)?-10:10;act({type:'resize',firstId:child.id,secondId:item.children[index+1].id,firstPixels:Math.max(0,(horizontal?a.width:a.height)+delta),secondPixels:Math.max(0,(horizontal?b.width:b.height)-delta)});});row.append(splitter);}});return row;};
    if(max){const set=workspaceTabsets(state).find(set=>set.id===max);if(set)layout.append(renderSet(set));else layout.append(visit(state.layout));}else layout.append(visit(state.layout));
    requestAnimationFrame(syncFrames);updateBadges();
  }
  function renderSet(set){
    const pane=node('section','dock-tabset');pane.dataset.tabset=set.id;const strip=node('div','dock-tabs');strip.setAttribute('role','tablist');const scroll=node('div','dock-tabs-scroll');strip.append(scroll);
    for(const [index,tab] of set.children.entries()){
      const item=node('div','dock-tab');item.setAttribute('role','tab');item.tabIndex=index===set.selected?0:-1;item.setAttribute('aria-selected',String(index===set.selected));item.setAttribute('aria-label',tab.name);item.dataset.tab=tab.id;
      const title=node('span','dock-tab-name',tab.name);title.addEventListener('dblclick',()=>renameTab(tab));item.append(node('i','dock-status'),title);
      item.append(button('⋮',event=>{event.stopPropagation();tabMenu(event.currentTarget,tab,set);},'dock-tab-menu'));item.addEventListener('contextmenu',event=>{event.preventDefault();tabMenu(item,tab,set);});
      item.addEventListener('click',()=>{if(!drag)act({type:'select',tabId:tab.id});});item.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')act({type:'select',tabId:tab.id});});item.addEventListener('pointerdown',event=>tabDragStart(event,item,tab));scroll.append(item);
    }
    strip.append(button('+',event=>addDialog(event.currentTarget,set.id),'dock-add'));const overflow=button('⌄',event=>popup(event.currentTarget,'Tabs',el=>{for(const tab of set.children)el.append(button(tab.name,()=>{closePopup();act({type:'select',tabId:tab.id});}));}),'dock-overflow');overflow.setAttribute('aria-label','All tabs');strip.append(overflow);
    const body=node('div','dock-body');body.dataset.body=set.id;const selected=set.children[set.selected??0];if(!selected)body.append(button('+ Add Tool',event=>addDialog(event.currentTarget,set.id)));else if(popouts.has(selected.id))body.append(button('Bring it back',()=>{popouts.get(selected.id)?.close?.();popouts.delete(selected.id);render();}));
    pane.append(strip,body);return pane;
  }
  function renameTab(tab){dialog('Edit Tab Name',el=>{const input=node('input');input.value=tab.name;input.setAttribute('aria-label','Tab name');input.maxLength=64;const error=node('p','workspace-error');el.append(input,error,button('Save',()=>{const result=validateTabName(input.value);if(!result.valid){error.textContent=result.error;return;}act({type:'rename',tabId:tab.id,name:input.value});el.close();}));input.focus();input.select();});}
  function tabMenu(anchor,tab,set){popup(anchor,tab.name,el=>{
    el.setAttribute('role','menu');el.append(button('Duplicate Tab',()=>{closePopup();act({type:'duplicate',tabId:tab.id});}),button('Edit Tab Name',()=>{closePopup();renameTab(tab);}));
    if(set.children[set.selected]?.id===tab.id)el.append(button(state.maximizedTabsetId===set.id?'Minimize':'Maximize',()=>{closePopup();act({type:'maximize',tabsetId:set.id});}));
    el.append(button('Pop Out Tool',()=>{closePopup();const child=window.open(toolLink(tab),'_blank','popup,width=1100,height=800');if(child){popouts.set(tab.id,child);render();}else notify('The browser blocked the pop-out. Allow pop-ups for this local page.');}),button('Share',()=>{closePopup();dialog('Share Tool',d=>{const input=node('input');input.value=toolLink(tab);input.readOnly=true;input.setAttribute('aria-label','Local tool link');d.append(input,node('p','workspace-note','Local view link only. It requires this KwantDesk server and does not include your API key.'),button('Copy link',async event=>{try{await navigator.clipboard.writeText(input.value);event.currentTarget.textContent='Copied';}catch{input.select();}}));});}),button('Delete Tab',event=>{closePopup();const remove=()=>act({type:'delete',tabId:tab.id});if(event.shiftKey)remove();else dialog('Delete Tab',d=>d.append(node('p','',`Delete “${tab.name}” from this local layout?`),button('Cancel',()=>d.close()),button('Delete Tab',()=>{remove();d.close();},'danger-button')));}));
  });}
  function addDialog(anchor,setId){dialog("Add Tool",el=>{el.classList.add("add-tool-dialog");const groups=["Equities","Order Flow","Exposure"],tabs=node("div","picker-groups"),content=node("div","picker-content"),left=node("div","picker-search-pane"),search=node("input"),list=node("div","picker-tool-list"),preview=node("div","picker-preview");search.type="search";search.placeholder="Search tools";search.setAttribute("aria-label","Search tools to add");let group=gexStorage.getItem("gex-data-add-tool-tab")||"Equities",selected=null;const showPreview=tool=>{selected=tool;preview.replaceChildren();if(!tool)return;preview.append(node("h2","",tool.title),node("p","",tool.description),button("Add Tool",()=>{act({type:"add",tabsetId:setId,tab:{id:crypto.randomUUID(),name:tool.title,tool:tool.id,controls:{}}});el.close();showBoard();}));};const draw=()=>{list.replaceChildren();const entries=tools.filter(tool=>tool.group===group&&tool.title.toLowerCase().includes(search.value.toLowerCase()));for(const tool of entries){const entry=button(tool.title,()=>showPreview(tool),"picker-tool");entry.append(node("small","",tool.description));list.append(entry);}showPreview(entries.find(tool=>tool.id===selected?.id)||entries[0]);for(const b of tabs.children)b.setAttribute("aria-selected",String(b.textContent===group));};for(const name of groups){const b=button(name,()=>{group=name;gexStorage.setItem("gex-data-add-tool-tab",group);draw();});b.setAttribute("role","tab");tabs.append(b);}tabs.setAttribute("role","tablist");search.addEventListener("input",draw);left.append(search,list);content.append(left,preview);el.append(tabs,content);draw();search.focus();});}
  function resizeStart(event,handle,row,first,second,orientation){
    if(event.button!==0)return;event.preventDefault();const children=[...row.children],a=children.find(el=>el.dataset.node===first.id||el.dataset.tabset===first.id),b=children.find(el=>el.dataset.node===second.id||el.dataset.tabset===second.id);if(!a||!b)return;const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect(),horizontal=orientation==='horizontal',start=horizontal?event.clientX:event.clientY,as=horizontal?ra.width:ra.height,bs=horizontal?rb.width:rb.height;glass.hidden=false;glass.style.cursor=horizontal?'col-resize':'row-resize';handle.setPointerCapture(event.pointerId);
    const move=e=>{const delta=(horizontal?e.clientX:e.clientY)-start,firstPixels=Math.max(0,Math.min(as+bs,as+delta)),secondPixels=as+bs-firstPixels;state=workspaceAction(state,{type:'resize',firstId:first.id,secondId:second.id,firstPixels,secondPixels});const combined=Number(first.weight??100)+Number(second.weight??100);a.style.flexGrow=String(firstPixels/(as+bs)*combined);b.style.flexGrow=String(secondPixels/(as+bs)*combined);syncFrames();};
    const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);glass.hidden=true;persist();render();};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
  }
  function tabDragStart(event,item,tab){
    if(event.button!==0||event.target.closest('button'))return;let started=false,drop=null;const start={x:event.clientX,y:event.clientY};item.setPointerCapture(event.pointerId);
    const move=e=>{if(!started&&Math.abs(e.clientX-start.x)+Math.abs(e.clientY-start.y)<=5)return;started=true;drag={tabId:tab.id};glass.hidden=false;glass.style.cursor='grabbing';drop=null;for(const [id,rect] of bodyRects){if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top-28||e.clientY>rect.bottom)continue;const overStrip=e.clientY<rect.top,location=overStrip?'center':workspaceDockLocation({x:rect.left,y:rect.top,width:rect.width,height:rect.height},e.clientX,e.clientY,{maximized:!!state.maximizedTabsetId});let index=-1;if(overStrip){const tabs=[...layout.querySelector(`[data-tabset="${CSS.escape(id)}"]`).querySelectorAll('.dock-tab')];index=tabs.findIndex(t=>e.clientX<t.getBoundingClientRect().left+t.getBoundingClientRect().width/2);if(index<0)index=tabs.length;}
        drop={type:'move',tabId:tab.id,targetTabsetId:id,location,index};const rr=root.getBoundingClientRect(),box=workspaceDockRect({x:rect.left,y:rect.top,width:rect.width,height:rect.height},location);Object.assign(outline.style,{left:`${box.x-rr.left}px`,top:`${box.y-rr.top}px`,width:`${box.width}px`,height:`${box.height}px`});outline.hidden=false;break;}};
    const end=e=>{item.removeEventListener('pointermove',move);item.removeEventListener('pointerup',end);item.removeEventListener('pointercancel',cancel);document.removeEventListener('keydown',escape);glass.hidden=outline.hidden=true;if(started){e.preventDefault();if(drop)act(drop);setTimeout(()=>{drag=null;},0);}else drag=null;};
    const cancel=e=>{drop=null;end(e);};const escape=e=>{if(e.key==='Escape')cancel(e);};item.addEventListener('pointermove',move);item.addEventListener('pointerup',end);item.addEventListener('pointercancel',cancel);document.addEventListener('keydown',escape);
  }
  function updateBadges(){const count=filterCount(read(KEYS.page,{}));const badge=document.querySelector('.filter-action sup');if(badge){badge.textContent=String(count);badge.hidden=!count;}}
  const top=(old,title,action)=>{const el=[...document.querySelectorAll('.top-action')].find(b=>b.title===old);if(el){el.title=title;el.setAttribute('aria-label',title);el.addEventListener('click',event=>action(event.currentTarget));}};
  top('Dashboard layout','Page Layout',anchor=>popup(anchor,'Page Layout',el=>{el.append(button('Overview',()=>{closePopup();showBoard();}),button('Restore Overview',()=>dialog('Restore Overview',d=>d.append(node('p','','Restore the original overview arrangement? Existing tool tabs remain in the saved layout until you confirm.'),button('Cancel',()=>d.close()),button('Restore',()=>{state=defaults();persist();render();showBoard();d.close();closePopup();})))),node('p','workspace-note','Drag tabs to stack or split panes. Drag dividers to resize. Layout changes save automatically on this device.'));}));
  top('Filters','Page Tool Filters',anchor=>showSharedFilters(anchor,'page'));top('Market','Global Tool Filters',anchor=>showSharedFilters(anchor,'global'));top('Edit','Tool Configuration',showToolConfiguration);
  top('Help','Help',anchor=>popup(anchor,'Workspace Help',el=>el.append(node('p','','Drag a tab into the center of a pane to stack it, or to an edge to split it. Right-click a tab for actions; double-click its name to rename. Resize dividers with mouse or arrow keys. Charts have their own zoom navigators. Heat Map: plain wheel steps strikes, Ctrl/⌘ wheel zooms.'),node('p','workspace-note','Only licensed connected feeds are shown. Forecast, private sharing and provider-only services cannot be fabricated.'))));
  top('Settings','Settings',showToolConfiguration);top('Remove layout','Clear Page',()=>dialog('Clear Page',d=>d.append(node('p','','Remove every tool from this local page? This does not change the market-data website.'),button('Cancel',()=>d.close()),button('Clear Page',()=>{state=createWorkspace();persist();render();d.close();},'danger-button'))));
  window.addEventListener('message',event=>{if(event.origin!==location.origin)return;const pair=[...frames].find(([,frame])=>frame.contentWindow===event.source);if(!pair)return;const [id,frame]=pair;
    if(event.data?.type==='gex-data-tool-state'){const tab=workspaceTabsets(state).flatMap(set=>set.children).find(tab=>tab.id===id);if(tab){tab.controls=event.data.controls;persist();}}
    if(event.data?.type==='gex-data-minute'){const tab=workspaceTabsets(state).flatMap(set=>set.children).find(tab=>tab.id===id);if(tab){tab.minute=event.data.minute;persist();}}
    if(event.data?.type==='gex-data-status'){const marker=layout.querySelector(`[data-tab="${CSS.escape(id)}"] .dock-status`);if(marker){marker.classList.toggle('paused',event.data.paused===true);marker.classList.toggle('failed',event.data.failed===true);marker.title=event.data.message||'Licensed connection';}}
    if(event.data?.type==='gex-data-escape')closePopup();
    if(event.data?.type==='gex-data-tab-menu'){const set=workspaceTabsets(state).find(set=>set.children.some(tab=>tab.id===id)),tab=set?.children.find(tab=>tab.id===id);if(tab)tabMenu(frame,tab,set);}
  });
  const preferencesChanged=()=>{applyDocumentPreferences();updateBadges();for(const frame of frames.values())send(frame,'gex-data-preferences');};window.addEventListener('gex-data-preferences',preferencesChanged);window.addEventListener('storage',preferencesChanged);
  const observer=new ResizeObserver(()=>requestAnimationFrame(syncFrames));observer.observe(root);window.addEventListener('resize',syncFrames);
  const popoutTimer=setInterval(()=>{for(const [id,child] of popouts)if(child.closed){popouts.delete(id);render();}},500);
  window.addEventListener('pagehide',()=>{clearInterval(popoutTimer);for(const child of popouts.values())child.close?.();});
  document.querySelector('#refreshAll').addEventListener('click',()=>{for(const frame of frames.values())send(frame,'gex-data-refresh');});
  applyDocumentPreferences();render();
  return {addTool:anchor=>addDialog(anchor,state.activeTabsetId),refresh:()=>{for(const frame of frames.values())send(frame,'gex-data-refresh');},visibility:visible=>{document.documentElement.classList.toggle('workspace-home',visible);for(const frame of frames.values())send(frame,'gex-data-visibility',{visible:visible&&!frame.hidden});if(visible)requestAnimationFrame(syncFrames);}};
}
