import {botStorage} from './site-runtime.js';
const stateKey='kwanty:v1',savedKey='kwanty:saved-workspaces:v1';
function validate(text){const value=JSON.parse(text);if(!value||typeof value!=='object'||!value.settings||!Array.isArray(value.panels))throw Error('Choose a valid KWANTY workspace.');return value;}
export function bindTemplates(report,flush=()=>{}){
 const bar=document.createElement('div');bar.className='bot-template-actions';
 const button=(label,handler)=>{const b=document.createElement('button');b.textContent=label;b.type='button';b.addEventListener('click',handler);return b;};
 const capture=()=>{flush();return {state:botStorage.getItem(stateKey)||'{}',view:location.hash};};
 const restore=value=>{validate(value.state);botStorage.setItem(stateKey,value.state);if(/^#(?:classic|state|orderflow)$/.test(value.view))location.hash=value.view;location.reload();};
 const openSaved=()=>{
  const dialog=document.createElement('dialog'),title=document.createElement('h2'),name=document.createElement('input');title.textContent='KWANTY workspaces';name.placeholder='Workspace name';name.setAttribute('aria-label','Workspace name');
  let saved;try{saved=JSON.parse(botStorage.getItem(savedKey)||'[]');if(!Array.isArray(saved))saved=[];}catch{saved=[];}
  const actions=document.createElement('div');actions.className='workspace-dialog-actions';
  actions.append(button('Cancel',()=>dialog.close()),button('Save workspace',()=>{try{const label=name.value.trim().slice(0,60);if(!label)throw Error('Enter a workspace name.');const value=capture();validate(value.state);const next=[{name:label,...value},...saved.filter(item=>item.name!==label)].slice(0,12);botStorage.setItem(savedKey,JSON.stringify(next));dialog.close();report('Workspace saved.');}catch(error){report(error.message);}}));
  dialog.className='kwanty-workspace-dialog';dialog.append(title,name,actions);dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
 };
 const exportButton=button('Export workspace',()=>{try{const value=capture();validate(value.state);const url=URL.createObjectURL(new Blob([JSON.stringify({format:'kwantdesk-kwanty',version:1,...value},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='kwanty-workspace.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){report(error.message);}});
 const importButton=button('Import workspace',()=>{
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.addEventListener('change',async()=>{try{const file=input.files?.[0];if(!file)return;if(file.size>500000)throw Error('The workspace is too large.');const value=JSON.parse(await file.text());if(value.format!=='kwantdesk-kwanty'||value.version!==1)throw Error('Choose a KWANTY workspace export.');validate(value.state);const dialog=document.createElement('dialog'),text=document.createElement('p');text.textContent='Replace KWANTY settings with this workspace?';dialog.className='kwanty-workspace-dialog';dialog.append(text,button('Import workspace',()=>restore(value)),button('Cancel',()=>dialog.close()));dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();}catch(error){report(error.message);}});input.click();
 });

 const icon='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
 const trigger=button('',()=>{if(!menu.hidden){close();return;}render();menu.hidden=false;trigger.setAttribute('aria-expanded','true');position(menu,trigger);});
 trigger.className='kwanty-command';trigger.innerHTML=icon+'<span>Workspaces</span><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label','Kwanty workspaces');
 const menu=document.createElement('div');menu.className='kwanty-workspace-menu';menu.hidden=true;menu.setAttribute('role','group');menu.setAttribute('aria-label','Kwanty workspaces');document.body.append(menu);
 const close=()=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false');};
 const heading=text=>{const el=document.createElement('div');el.className='workspace-menu-heading';el.textContent=text;return el;};
 const render=()=>{menu.replaceChildren(heading('Saved workspaces'));let saved;try{saved=JSON.parse(botStorage.getItem(savedKey)||'[]');if(!Array.isArray(saved))saved=[];}catch{saved=[];}
  if(!saved.length)menu.append(heading('No saved workspaces yet'));
  for(const item of saved){const load=button(String(item.name||'Untitled workspace'),()=>{try{restore(item);}catch(error){report(error.message);}});load.title='Load '+item.name;menu.append(load);}
  const divider=document.createElement('div');divider.className='workspace-menu-divider';menu.append(divider,button('Save workspace…',()=>{close();openSaved();}),exportButton,importButton);
 };
 const overflow=document.createElement('details'),summary=document.createElement('summary'),more=document.createElement('div');overflow.className='template-overflow';summary.setAttribute('aria-label','More chart actions');summary.title='More chart actions';summary.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>';more.className='template-overflow-menu';
 const utilities=document.querySelector('.kwanty-command-utilities');if(utilities)more.append(utilities);
 overflow.append(summary,more);bar.append(trigger,overflow);(document.querySelector('.workspace-header-actions')||document.querySelector('header')).append(bar);
 function position(element,anchor){const r=anchor.getBoundingClientRect();element.style.right='auto';element.style.left=Math.max(8,Math.min(innerWidth-element.offsetWidth-8,r.right-element.offsetWidth))+'px';element.style.top=Math.max(8,Math.min(innerHeight-element.offsetHeight-8,r.bottom+6))+'px';}
 overflow.addEventListener('toggle',()=>{if(overflow.open){close();position(more,summary);}});
 more.addEventListener('click',event=>{if(event.target.closest('button'))overflow.open=false;});
 menu.addEventListener('click',event=>{if(event.target.closest('button'))close();});
 document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target)&&!trigger.contains(event.target))close();if(!overflow.contains(event.target))overflow.open=false;},true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!menu.hidden){close();trigger.focus();}overflow.open=false;}});
 window.addEventListener('resize',()=>{if(!menu.hidden)position(menu,trigger);if(overflow.open)position(more,summary);});
}
