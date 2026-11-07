export function mountWorkspaceChrome({onTicker,onAdd,onLayout,onIndicators,layout}){
 const header=document.querySelector('header'),controls=document.querySelector('.chart-top-controls'),sidebar=document.querySelector('#ticker');
 const actions=document.createElement('div');actions.className='workspace-header-actions';header.append(actions);
 // Keep selectors in the primary row; quick picks get their own wrapping lane.
 // They must never squeeze the centered mode tabs or action buttons off-screen.
 const shortcuts=document.createElement('div');shortcuts.className='chart-quick-controls';shortcuts.setAttribute('role','toolbar');shortcuts.setAttribute('aria-label','Quick chart selections');
 const quickGroup=document.createElement('div');quickGroup.className='chart-quick-picks';
 for(const selector of ['.timeframe-buttons','#tickerFavourites']){const group=controls.querySelector(selector);if(group)quickGroup.append(group);}
 shortcuts.append(quickGroup);header.append(shortcuts);
 const phone=matchMedia('(max-width:767px), (max-height:500px) and (pointer:coarse)');
 const placeShortcuts=()=>{(phone.matches?controls:header).append(shortcuts);};placeShortcuts();phone.addEventListener('change',placeShortcuts);
 const ticker=document.createElement('select');ticker.id='workspaceInstrument';ticker.className='instrument-trigger';ticker.setAttribute('aria-label','Chart instrument');controls.prepend(ticker);
 ticker.addEventListener('change',()=>onTicker(ticker.value));
 const sync=()=>{if(ticker.options.length!==sidebar.options.length||ticker.options[0]?.value!==sidebar.options[0]?.value){ticker.replaceChildren(...[...sidebar.options].map(option=>option.cloneNode(true)));}ticker.value=sidebar.value;};
 const observer=new MutationObserver(sync);observer.observe(sidebar,{childList:true});sync();
 for(const id of ['workspaceReplay','workspaceReplayRetry']) actions.append(document.getElementById(id));
 const add=document.createElement('button');add.type='button';add.className='kwanty-command';
 add.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Add chart</span>';
 add.onclick=onAdd;actions.append(add);
 const utilities=document.createElement('div');utilities.className='kwanty-command-utilities';utilities.setAttribute('role','group');utilities.setAttribute('aria-label','Chart view actions');
 for(const [id,label] of [['toggleSidebar','Settings panel'],['fullscreen','Fullscreen'],['screenshot','Save chart image']]){
  const button=document.getElementById(id);button.classList.add('kwanty-command');
  const text=document.createElement('span');text.textContent=label;button.append(text);utilities.append(button);
 }
 actions.append(utilities);
 const select=document.createElement('select');select.id='workspaceLayout';select.setAttribute('aria-label','Chart layout');
 for(const [value,label]of [['stack','Stack'],['columns','Side by side'],['grid','Grid']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
 select.value=layout;select.onchange=()=>onLayout(select.value);shortcuts.append(select);
 const indicators=document.createElement('button');indicators.type='button';indicators.className='kwanty-command';
 indicators.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3v18h18M8 16v-3m5 3V8m5 8v-5"/></svg><span>Indicators</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';indicators.setAttribute('aria-label','Chart indicators');indicators.onclick=onIndicators;actions.prepend(indicators);
 const panels=document.querySelector('#chartPanels');
 const paintHeaderIcons=()=>{for(const button of panels.querySelectorAll('.panel-tools button,.panel-drag-handle')){
  if(button.dataset.chromeIcon)continue;
  const label=button.getAttribute('aria-label')||'';
  const path=label==='Reset chart scaling'?'M3 12a9 9 0 0 1 15-6l3 3M21 3v6h-6M21 12a9 9 0 0 1-15 6l-3-3M3 21v-6h6':label.startsWith('Close ')?'m18 6-12 12M6 6l12 12':label.startsWith('Settings for ')?'M4 6h4m4 0h8M4 12h10m4 0h2M4 18h2m4 0h10M8 3v6m6 0v6M6 15v6':label.startsWith('Open profile overlay')?'M3 3h18v18H3zM9 3v18M3 9h18':null;
  if(!path)continue;
  button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+path+'"/></svg>';button.dataset.chromeIcon='true';
 }};
 const panelObserver=new MutationObserver(paintHeaderIcons);panelObserver.observe(panels,{childList:true});paintHeaderIcons();
 return {sync,dispose:()=>{observer.disconnect();panelObserver.disconnect();phone.removeEventListener('change',placeShortcuts);},layout:value=>select.value=value};
}

export function arrangeWorkspacePanels(container,panels,layout,onReorder,onResize=()=>{}){
 container.dataset.layout=layout;container.style.setProperty('--workspace-columns',String(layout==='columns'?Math.max(1,panels.length):Math.min(2,Math.max(1,panels.length))));
 const columns=()=>{container.style.gridTemplateColumns=container.dataset.layout==='columns'?panels.map(panel=>`minmax(240px,${Number.isFinite(panel.width)&&panel.width>0?panel.width:1}fr)`).join(' '):'';};columns();
 const wraps=[...container.querySelectorAll('.chart-panel')];
 for(let index=0;index<wraps.length-1;index++){
  const wrap=wraps[index];if(wrap.querySelector('.panel-column-resize'))continue;
  const handle=document.createElement('div');handle.className='panel-column-resize';handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-label','Resize chart columns');handle.setAttribute('aria-orientation','vertical');wrap.append(handle);let start=null;
  const resize=delta=>{const a=wrap.getBoundingClientRect().width,b=wraps[index+1].getBoundingClientRect().width,total=a+b;if(total<480)return;const left=Math.max(240,Math.min(total-240,a+delta)),weight=(panels[index].width||1)+(panels[index+1].width||1);panels[index].width=left/total*weight;panels[index+1].width=(total-left)/total*weight;columns();};
  handle.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();start=event.clientX;handle.setPointerCapture(event.pointerId);});
  handle.addEventListener('pointermove',event=>{if(start===null)return;resize(event.clientX-start);start=event.clientX;});
  handle.addEventListener('pointerup',()=>{start=null;onResize();});handle.addEventListener('pointercancel',()=>{start=null;onResize();});
  handle.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();resize(event.key==='ArrowLeft'?-20:20);onResize();}});
 }
 for(const wrap of container.querySelectorAll('.chart-panel')){
  const header=wrap.querySelector('.panel-header');if(!header||header.querySelector('.panel-drag-handle'))continue;
  const handle=document.createElement('button');handle.type='button';handle.className='panel-drag-handle';handle.textContent='⠿';handle.draggable=true;handle.setAttribute('aria-label','Move chart');handle.title='Drag to reorder · Alt+Left/Right to move';header.prepend(handle);
  handle.addEventListener('dragstart',event=>{event.dataTransfer.setData('application/x-kwanty-panel',wrap.dataset.panelId);event.dataTransfer.effectAllowed='move';});
  handle.addEventListener('keydown',event=>{if(!event.altKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;const index=panels.findIndex(panel=>panel.id===wrap.dataset.panelId),target=panels[index+(event.key==='ArrowLeft'?-1:1)];if(target){event.preventDefault();onReorder(wrap.dataset.panelId,target.id);}});
  wrap.addEventListener('dragover',event=>{if([...event.dataTransfer.types].includes('application/x-kwanty-panel')){event.preventDefault();wrap.dataset.dragOver='true';}});
  wrap.addEventListener('dragleave',()=>delete wrap.dataset.dragOver);
  wrap.addEventListener('drop',event=>{const id=event.dataTransfer.getData('application/x-kwanty-panel');delete wrap.dataset.dragOver;if(id){event.preventDefault();onReorder(id,wrap.dataset.panelId);}});
 }
}

export function reorderWorkspacePanels(panels,id,targetId){
 const from=panels.findIndex(panel=>panel.id===id),to=panels.findIndex(panel=>panel.id===targetId);if(from<0||to<0||from===to)return panels;
 const next=[...panels],item=next.splice(from,1)[0];next.splice(to,0,item);return next;
}
