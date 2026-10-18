import {botStorage} from './site-runtime.js';
const stateKey='kwanty:v1',savedKey='kwanty:saved-workspaces:v1';
function validate(text){const value=JSON.parse(text);if(!value||typeof value!=='object'||!value.settings||!Array.isArray(value.panels)||value.panels.length>3)throw Error('Choose a valid KWANTY template.');return value;}
export function bindTemplates(report,flush=()=>{}){
 const bar=document.createElement('div');bar.className='bot-template-actions';
 const button=(label,handler)=>{const b=document.createElement('button');b.textContent=label;b.type='button';b.addEventListener('click',handler);return b;};
 const capture=()=>{flush();return {state:botStorage.getItem(stateKey)||'{}',view:location.hash};};
 const restore=value=>{validate(value.state);botStorage.setItem(stateKey,value.state);if(/^#(?:classic|state|orderflow)$/.test(value.view))location.hash=value.view;location.reload();};
 bar.append(button('Templates',()=>{
  const dialog=document.createElement('dialog'),title=document.createElement('h2'),name=document.createElement('input');title.textContent='KWANTY templates';name.placeholder='Template name';name.setAttribute('aria-label','Template name');
  let saved;try{saved=JSON.parse(botStorage.getItem(savedKey)||'[]');if(!Array.isArray(saved))saved=[];}catch{saved=[];}
  dialog.append(title,name,button('Save template',()=>{try{const label=name.value.trim().slice(0,60);if(!label)throw Error('Enter a template name.');const value=capture();validate(value.state);const next=[{name:label,...value},...saved.filter(item=>item.name!==label)].slice(0,12);botStorage.setItem(savedKey,JSON.stringify(next));dialog.close();report('Template saved.');}catch(error){report(error.message);}}));
  for(const value of saved){const row=document.createElement('div');row.append(button(value.name,()=>{try{restore(value);}catch(error){report(error.message);}}));dialog.append(row);}
  dialog.append(button('Close',()=>dialog.close()));dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
 }),button('Export',()=>{try{const value=capture();validate(value.state);const url=URL.createObjectURL(new Blob([JSON.stringify({format:'kwantdesk-kwanty',version:1,...value},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='kwanty-template.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){report(error.message);}}),button('Import',()=>{
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.addEventListener('change',async()=>{try{const file=input.files?.[0];if(!file)return;if(file.size>500000)throw Error('The template is too large.');const value=JSON.parse(await file.text());if(value.format!=='kwantdesk-kwanty'||value.version!==1)throw Error('Choose a KWANTY template export.');validate(value.state);const dialog=document.createElement('dialog'),text=document.createElement('p');text.textContent='Replace KWANTY settings with this template?';dialog.append(text,button('Import template',()=>restore(value)),button('Cancel',()=>dialog.close()));dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();}catch(error){report(error.message);}});input.click();
 }));document.querySelector('header').append(bar);
}
