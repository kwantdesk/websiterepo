export const SAVED_WORKSPACES_KEY='gex-data:saved-workspaces:v1';
export const ACTIVE_WORKSPACE_KEY='gex-data:active-workspace:v1';
// Backups contain one workspace, never the saved collection recursively.
export function workspaceValues(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Choose a GEX Data workspace backup.');
 const entries=Object.entries(input).filter(([key])=>key!==SAVED_WORKSPACES_KEY&&key!==ACTIVE_WORKSPACE_KEY);
 if(entries.length>500||entries.some(([key,value])=>!key.startsWith('gex-data')||typeof value!=='string')||!entries.some(([key])=>key==='gex-data:workspace:v1'))throw Error('Invalid GEX Data workspace.');
 const values=Object.fromEntries(entries);if(JSON.stringify(values).length>1500000)throw Error('The workspace is too large.');return values;
}
const legacyId=name=>{let hash=2166136261;for(const char of name)hash=Math.imul(hash^char.charCodeAt(0),16777619);return 'legacy-'+(hash>>>0).toString(36)};
export function normalizeSavedWorkspaces(input,validate=value=>value){
 if(!Array.isArray(input)||input.length>100)throw Error('Invalid saved workspace list.');
 const ids=new Set();return input.map(p=>{
  if(!p||typeof p!=='object'||typeof p.name!=='string'||!p.name.trim()||p.name.length>64)throw Error('Invalid workspace name.');
  const values=workspaceValues(p.values);validate(values);const id=typeof p.id==='string'&&/^[a-zA-Z0-9:_-]{1,128}$/.test(p.id)?p.id:legacyId(p.name);
  if(ids.has(id))throw Error('Duplicate workspace identity.');ids.add(id);
  return{id,name:p.name.trim(),updatedAt:typeof p.updatedAt==='string'&&Number.isFinite(Date.parse(p.updatedAt))?p.updatedAt:null,values};
 });
}
export function saveWorkspaceAs(saved,{id,name,updatedAt,values},validate){
 const clean=name.trim();if(saved.some(p=>p.name.toLocaleLowerCase()===clean.toLocaleLowerCase()))throw Error('That workspace name already exists. Use Quick Save to update it.');
 return normalizeSavedWorkspaces([...saved,{id,name:clean,updatedAt,values}],validate);
}
export function quickSaveWorkspace(saved,id,values,updatedAt,validate){
 if(!saved.some(p=>p.id===id))throw Error('Name this workspace with Save As first.');
 return normalizeSavedWorkspaces(saved.map(p=>p.id===id?{...p,values,updatedAt}:p),validate);
}
export function workspaceBackup(presets){return{format:'kwantdesk-gex-data',version:2,exportedAt:new Date().toISOString(),presets}};
// Preserve the existing single-workspace v1 format while adding bundle v2.
export function parseWorkspaceBackup(data,validate){
 if(!data||data.format!=='kwantdesk-gex-data')throw Error('Choose a GEX Data workspace JSON backup.');
 if(data.version===1){const values=workspaceValues(data.values);const content=JSON.stringify(Object.fromEntries(Object.entries(values).sort(([a],[b])=>a<b?-1:a>b?1:0)));return normalizeSavedWorkspaces([{id:data.id||legacyId(content),name:data.name||'Imported workspace',updatedAt:data.exportedAt,values}],validate);}
 if(data.version!==2||!Array.isArray(data.presets)||!data.presets.length)throw Error('Invalid GEX Data workspace backup.');
 return normalizeSavedWorkspaces(data.presets,validate);
}
export function mergeWorkspaceBackups(saved,imported){const merged=new Map(saved.map(p=>[p.id,p]));for(const preset of imported)merged.set(preset.id,preset);if(merged.size>100)throw Error('Remove a saved workspace before importing more.');return[...merged.values()]}
export function workspaceToolCount(values){try{const state=JSON.parse(values['gex-data:workspace:v1']);let count=0;const walk=n=>{if(!n)return;if(n.type==='tab')count++;else for(const child of n.children||[])walk(child)};walk(state.layout??state);return count}catch{return 0}}

export function validateWorkspaceLayout(layout,toolIds){
 const stack=[{node:layout,parent:null,depth:0}],ids=new Set();let count=0,panes=0,tools=0;
 while(stack.length){const {node,parent,depth}=stack.pop();if(++count>128||depth>32||!node||typeof node!=='object'||!['row','tabset','tab'].includes(node.type)||typeof node.id!=='string'||!node.id||node.id.length>128||ids.has(node.id))throw Error('Invalid workspace layout.');ids.add(node.id);
 if(parent===null&&node.type==='tab'||parent==='row'&&node.type==='tab'||parent==='tabset'&&node.type!=='tab')throw Error('Invalid workspace layout.');
 if(node.type==='tab'){if(!toolIds.has(node.tool)||node.children?.length)throw Error('The workspace contains unsupported tools.');tools++}else{if(!Array.isArray(node.children))throw Error('Invalid workspace layout.');if(node.type==='tabset')panes++;for(const child of node.children)stack.push({node:child,parent:node.type,depth:depth+1})}}
 if(!panes||panes>16||tools>32)throw Error('The workspace contains unsupported tools or too many panels.');return layout;
}
