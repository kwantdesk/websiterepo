import {SAVED_WORKSPACES_KEY,ACTIVE_WORKSPACE_KEY,workspaceValues,normalizeSavedWorkspaces,saveWorkspaceAs,quickSaveWorkspace,workspaceBackup,parseWorkspaceBackup,mergeWorkspaceBackups,workspaceToolCount} from './saved-workspaces-model.js?v=20261114-feed-catalogue';
const paths={warning:'M10.3 3.8 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01',save:'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2ZM7 3v5h10M7 21v-8h10v8',plus:'M12 5v14M5 12h14',download:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',upload:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 8l5-5 5 5M12 3v12',trash:'M3 6h18M19 6l-1 14H6L5 6M9 6V3h6v3M10 10v7M14 10v7'};
function icon(doc,name){const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.5');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const path=doc.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]);svg.append(path);return svg}
export function createSavedWorkspaceMenu({storage,popup,closePopup,confirm,capture,validate,apply}){
 const read=()=>normalizeSavedWorkspaces(JSON.parse(storage.getItem(SAVED_WORKSPACES_KEY)||'[]'),validate);
 const current=()=>workspaceValues(capture());
 // Live chart windows and bootstrap control defaults can change without an edit.
 // Explicit tool selections are persisted in the dock layout.
 const signature=values=>JSON.stringify(Object.entries(values)
   .filter(([key])=>key!==SAVED_WORKSPACES_KEY&&key!==ACTIVE_WORKSPACE_KEY&&!/^gex-data-(chart-windows:|tool-controls:|market-map-camera:|add-tool-tab$)/.test(key))
   .sort(([left],[right])=>left.localeCompare(right)));
 let anchor,badge,baseline,viewportChanged=false;
 function savedBaseline(){try{return read().find(p=>p.id===storage.getItem(ACTIVE_WORKSPACE_KEY))?.values??capture()}catch{return capture()}}
 function refresh(){if(!anchor)return;try{
   const dirty=viewportChanged||signature(capture())!==baseline;
   badge.hidden=!dirty;
   if(dirty)anchor.setAttribute('aria-description','Save this workspace');else anchor.removeAttribute('aria-description');
 }catch{/* Preserve the current warning if the snapshot exceeds storage limits. */}}
 function markSaved(){baseline=signature(capture());viewportChanged=false;refresh()}
 const save=list=>storage.setItem(SAVED_WORKSPACES_KEY,JSON.stringify(list));
 const load=preset=>apply({...preset.values,[ACTIVE_WORKSPACE_KEY]:preset.id});
 function download(presets,name,doc){const url=URL.createObjectURL(new Blob([JSON.stringify(workspaceBackup(presets),null,2)],{type:'application/json'}));const a=doc.createElement('a');a.href=url;a.download=name;(doc.querySelector('.chart-workspace-menu')||doc.body).append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return{
  decorateTrigger(button){
   anchor=button;badge=button.ownerDocument.createElement('span');badge.className='saved-workspace-warning';badge.title='Save this workspace';badge.append(icon(button.ownerDocument,'warning'));button.append(badge);
   button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');baseline=signature(savedBaseline());refresh();
  },
  refresh,
  markViewportChanged(){if(viewportChanged)return;viewportChanged=true;refresh()},
  open(anchor){if(anchor.getAttribute('aria-expanded')==='true'){closePopup();return}popup(anchor,'Saved workspaces',el=>{el.workspaceAnchor=anchor;anchor.setAttribute('aria-expanded','true');
  el.classList.add('chart-workspace-menu');el.querySelector('h3')?.remove();el.querySelector('.popup-close')?.remove();const doc=el.ownerDocument;
  const node=(tag,cls,text)=>{const n=doc.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n};
  const action=(label,kind,fn,cls='')=>{const b=node('button','saved-workspace-action '+cls);b.type='button';if(kind)b.append(icon(doc,kind));if(label)b.append(node('span','',label));b.addEventListener('click',fn);return b};
  const heading=node('div','saved-workspace-heading');heading.append(node('span','','Saved workspaces'),node('span','saved-workspace-local','Saved locally'));el.append(heading);
  const error=node('p','saved-workspace-error');error.setAttribute('role','status');error.hidden=true;
  const fail=e=>{error.textContent=e.message||'The workspace could not be saved.';error.hidden=false};
  let saved;try{saved=read()}catch(e){saved=[];fail(e)}const activeId=storage.getItem(ACTIVE_WORKSPACE_KEY);
  const form=node('form','saved-workspace-name-form');form.hidden=true;const input=node('input');input.placeholder='Name this workspace';input.maxLength=64;input.setAttribute('aria-label','Name this workspace');const submit=action('Save As',null,()=>{},'primary');submit.type='submit';form.append(input,submit);
  const showName=()=>{form.hidden=false;input.focus()};input.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();form.hidden=true}});
  form.addEventListener('submit',event=>{event.preventDefault();try{const id=crypto.randomUUID();save(saveWorkspaceAs(read(),{id,name:input.value,updatedAt:new Date().toISOString(),values:current()},validate));storage.setItem(ACTIVE_WORKSPACE_KEY,id);markSaved();closePopup()}catch(e){fail(e)}});
  const quick=action('Quick Save','save',()=>{try{const list=read();if(!list.some(p=>p.id===activeId)){showName();return}save(quickSaveWorkspace(list,activeId,current(),new Date().toISOString(),validate));markSaved();closePopup()}catch(e){fail(e)}},'primary');
  const main=node('div','saved-workspace-grid');main.append(quick,action('Save As','plus',showName,'secondary'));el.append(main);
  const list=node('div','saved-workspace-list');
  if(!saved.length)list.append(node('div','saved-workspace-empty','No saved workspaces yet'));
  for(const preset of saved){const row=node('div','saved-workspace-row');row.dataset.active=String(preset.id===activeId);const open=action(preset.name,null,()=>{try{load(preset)}catch(e){fail(e)}},'saved-workspace-load');const meta=node('small','',[(preset.id===activeId?'Active':'Saved'),workspaceToolCount(preset.values)+' tools',preset.updatedAt?new Date(preset.updatedAt).toLocaleDateString():null].filter(Boolean).join(' · '));open.append(meta);const out=action('','download',()=>download([preset],'kwantdesk-gex-data-workspace.json',doc),'saved-workspace-icon');out.setAttribute('aria-label','Export '+preset.name);out.title='Export this workspace';const remove=action('','trash',()=>confirm('Delete workspace','Delete workspace “'+preset.name+'”?',()=>{try{save(read().filter(p=>p.id!==preset.id));if(preset.id===storage.getItem(ACTIVE_WORKSPACE_KEY))storage.removeItem(ACTIVE_WORKSPACE_KEY);closePopup()}catch(e){fail(e)}}),'saved-workspace-icon danger');remove.setAttribute('aria-label','Delete '+preset.name);row.append(open,out,remove);list.append(row)}el.append(list);
  const footer=node('div','saved-workspace-footer'),exports=node('div','saved-workspace-grid');exports.append(action('Export Current','download',()=>{try{const existing=read().find(p=>p.id===activeId);download([{id:existing?.id||crypto.randomUUID(),name:existing?.name||'Shared workspace',updatedAt:new Date().toISOString(),values:current()}],'kwantdesk-gex-data-workspace.json',doc)}catch(e){fail(e)}}));const all=action('Export All','download',()=>{try{download(read(),'kwantdesk-gex-data-workspaces.json',doc)}catch(e){fail(e)}});all.disabled=!saved.length;exports.append(all);footer.append(form,exports);
  const file=node('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.setAttribute('aria-label','Import GEX Data workspace JSON');
  const importFile=async selected=>{try{if(!selected)return;if(selected.size>1500000)throw Error('The workspace backup is too large.');const imported=parseWorkspaceBackup(JSON.parse(await selected.text()),validate);save(mergeWorkspaceBackups(read(),imported));confirm('Import workspace','Load “'+imported[0].name+'” from this backup?',()=>{try{load(imported[0])}catch(e){fail(e)}})}catch(e){fail(e)}finally{file.value=''}};
  const importButton=action('Import workspace JSON','upload',()=>file.click(),'saved-workspace-import');file.addEventListener('change',()=>void importFile(file.files?.[0]));for(const type of ['dragenter','dragover'])importButton.addEventListener(type,event=>{event.preventDefault();importButton.dataset.dragging='true'});importButton.addEventListener('dragleave',()=>delete importButton.dataset.dragging);importButton.addEventListener('drop',event=>{event.preventDefault();delete importButton.dataset.dragging;void importFile(event.dataTransfer?.files?.[0])});footer.append(importButton,file,error);el.append(footer);
 })}};
}
