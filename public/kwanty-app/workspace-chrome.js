export function mountWorkspaceChrome({onTicker,onAdd,onLayout,onIndicators,layout}){
 const header=document.querySelector('header'),controls=document.querySelector('.chart-top-controls'),sidebar=document.querySelector('#ticker');
 const actions=document.createElement('div');actions.className='workspace-header-actions';header.append(actions);
 const ticker=document.createElement('select');ticker.id='workspaceInstrument';ticker.className='instrument-trigger';ticker.setAttribute('aria-label','Chart instrument');controls.prepend(ticker);
 ticker.addEventListener('change',()=>onTicker(ticker.value));
 const sync=()=>{if(ticker.options.length!==sidebar.options.length||ticker.options[0]?.value!==sidebar.options[0]?.value){ticker.replaceChildren(...[...sidebar.options].map(option=>option.cloneNode(true)));}ticker.value=sidebar.value;};
 const observer=new MutationObserver(sync);observer.observe(sidebar,{childList:true});sync();
 for(const id of ['workspaceReplay','workspaceReplayRetry','toggleSidebar','fullscreen','screenshot']){const button=document.getElementById(id);if(button)actions.append(button);}
 const add=document.createElement('button');add.type='button';add.textContent='+ Add chart';add.onclick=onAdd;actions.append(add);
 const select=document.createElement('select');select.id='workspaceLayout';select.setAttribute('aria-label','Chart layout');
 for(const [value,label]of [['stack','Stack'],['columns','Side by side'],['grid','Grid']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
 select.value=layout;select.onchange=()=>onLayout(select.value);controls.append(select);
 const indicators=document.createElement('button');indicators.type='button';indicators.textContent='Indicators';indicators.setAttribute('aria-label','Chart indicators');indicators.onclick=onIndicators;actions.prepend(indicators);
 return {sync,dispose:()=>observer.disconnect(),layout:value=>select.value=value};
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
