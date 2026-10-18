import {themePaint} from './site-theme.js?v=1';
import {gexStorage} from './site-runtime.js?v=1';
// Source-backed subset of market-data's FlexLayout row/tabset state (see audit).
// No network, DOM, chart state, or user credentials are handled here.
export const WORKSPACE_METRICS = Object.freeze({tabStripHeight:28, splitterSize:16, minWidth:0, minHeight:0});
const clone = value => structuredClone(value);
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `workspace-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const weight = node => Number.isFinite(Number(node.weight)) ? Math.max(0,Number(node.weight)) : 100;
export const workspaceOrientation = depth => depth % 2 === 0 ? 'horizontal' : 'vertical';
// Center square occupies the middle half on each axis; outer triangles dock.
export function workspaceDockLocation(rect,x,y,{maximized=false}={}) {
  if(maximized)return 'center';
  const nx=(x-rect.x)/rect.width,ny=(y-rect.y)/rect.height;
  if(nx>=.25&&nx<.75&&ny>=.25&&ny<.75)return 'center';
  return ny>=nx?(ny>=1-nx?'bottom':'left'):(ny>=1-nx?'right':'top');
}
export function workspaceDockRect(rect,location) {
  const out={...rect};if(location==='top'||location==='bottom'){out.height/=2;if(location==='bottom')out.y+=out.height;}
  else if(location==='left'||location==='right'){out.width/=2;if(location==='right')out.x+=out.width;}return out;
}
export function workspaceTabsets(state) {
  const out=[]; const visit=node=>{if(node.type==='tabset')out.push(node);else for(const child of node.children??[])visit(child);};
  visit(state.layout); return out;
}
export function findWorkspaceNode(state,id) {
  let found;const visit=(node,parent=null,depth=0)=>{if(node.id===id)found={node,parent,depth};else for(const child of node.children??[])visit(child,node,depth+1);};
  visit(state.layout);return found;
}
export function validateTabName(name) {
  const value=String(name??'').trim();return {value,valid:value.length>=3&&value.length<=64,error:value.length<3?'The tab name must be at least 3 characters.':value.length>64?'The tab name cannot exceed 64 characters.':null};
}
export function createWorkspace(tabs=[],layout=null) {
  const root=layout?clone(layout):{type:'row',id:makeId(),weight:100,children:[{type:'tabset',id:makeId(),weight:100,selected:tabs.length?0:-1,children:tabs.map(tab=>({...clone(tab),type:'tab'}))}]};
  const state={layout:root,activeTabsetId:null,maximizedTabsetId:null};
  const sets=workspaceTabsets(state);state.activeTabsetId=sets.find(set=>set.active)?.id??sets[0]?.id??null;state.maximizedTabsetId=sets.find(set=>set.maximized)?.id??null;
  return state;
}
export function createBoardWorkspace(tabs,{topWeights=[35,6,59],bottomWeights=[36,33,31]}={}) {
  const tabset=(tab,w)=>({type:'tabset',id:`set-${tab.id}`,weight:w,selected:0,children:[{...clone(tab),type:'tab'}]});
  const rows=[tabs.slice(0,3),tabs.slice(3,6)].filter(row=>row.length).map((row,index)=>({type:'row',id:`board-row-${index}`,weight:50,children:row.map((tab,i)=>tabset(tab,(index?bottomWeights:topWeights)[i]??100))}));
  return createWorkspace([],{type:'row',id:'board-root',weight:100,children:[{type:'row',id:'board-vertical',weight:100,children:rows}]});
}
export function splitWeights(firstWeight,secondWeight,firstPixels,secondPixels) {
  const a=Math.max(0,Number(firstPixels)||0),b=Math.max(0,Number(secondPixels)||0),total=Math.max(0,Number(firstWeight)||0)+Math.max(0,Number(secondWeight)||0);
  return a+b>0?[a*total/(a+b),b*total/(a+b)]:null;
}
function removeTab(set,index) {
  const selected=set.selected??0;set.children.splice(index,1);
  if(selected===index)set.selected=set.children.length?Math.min(index,set.children.length-1):-1;
  else if(index<selected)set.selected=selected-1;
}
function tidy(state) {
  const clean=node=>{
    if(node.type!=='row')return;
    for(const child of node.children)clean(child);
    const children=[];
    for(const child of node.children){
      if(child.type==='tabset'&&!child.children.length&&child.enableDeleteWhenEmpty!==false)continue;
      if(child.type==='row'&&!child.children.length)continue;
      if(child.type==='row'&&child.children.length===1){
        const only=child.children[0];
        if(only.type==='row'){
          const total=only.children.reduce((sum,n)=>sum+weight(n),0)||1;
          for(const grandchild of only.children){grandchild.weight=weight(child)*weight(grandchild)/total;children.push(grandchild);}
        }else {only.weight=weight(child);children.push(only);}
      }else children.push(child);
    }
    node.children=children;
  };clean(state.layout);
  if(!state.layout.children.length)state.layout.children=[{type:'tabset',id:makeId(),weight:100,selected:-1,children:[]}];
  const sets=workspaceTabsets(state);
  if(!sets.some(set=>set.id===state.activeTabsetId))state.activeTabsetId=sets[0]?.id??null;
  if(!sets.some(set=>set.id===state.maximizedTabsetId))state.maximizedTabsetId=null;
}
// Returns a new state; action errors leave the caller's existing state untouched.
// action types: select, add, duplicate, rename, delete, move, maximize, resize, activate.
export function workspaceAction(input,action) {
  const state=clone(input),find=id=>findWorkspaceNode(state,id);
  const entry=find(action.tabId??action.nodeId),tab=entry?.node,set=entry?.parent;
  switch(action.type){
    case 'activate': if(find(action.tabsetId)?.node.type==='tabset')state.activeTabsetId=action.tabsetId;break;
    case 'select': if(tab?.type==='tab'&&set?.type==='tabset'){set.selected=set.children.indexOf(tab);state.activeTabsetId=set.id;}break;
    case 'rename': {const name=validateTabName(action.name);if(!name.valid)throw new Error(name.error);if(tab?.type==='tab')tab.name=name.value;break;}
    case 'delete': if(tab?.type==='tab'&&set?.type==='tabset')removeTab(set,set.children.indexOf(tab));break;
    case 'add': {const target=find(action.tabsetId??state.activeTabsetId)?.node??workspaceTabsets(state)[0];if(target?.type!=='tabset')throw new Error('A tabset is required.');const added={...clone(action.tab),type:'tab',id:action.tab?.id??makeId()};if(find(added.id))throw new Error('Tab IDs must be unique.');target.children.push(added);target.selected=target.children.length-1;state.activeTabsetId=target.id;break;}
    case 'duplicate': if(tab?.type==='tab'&&set?.type==='tabset'){const id=action.newId??makeId();if(find(id))throw new Error('Tab IDs must be unique.');set.children.push({...clone(tab),id});set.selected=set.children.length-1;state.activeTabsetId=set.id;}break;
    case 'maximize': {const target=find(action.tabsetId??set?.id)?.node;if(target?.type==='tabset'){state.maximizedTabsetId=state.maximizedTabsetId===target.id?null:target.id;state.activeTabsetId=target.id;}break;}
    case 'resize': {const first=find(action.firstId),second=find(action.secondId);if(!first||!second||first.parent!==second.parent)throw new Error('Resize requires sibling nodes.');const values=splitWeights(weight(first.node),weight(second.node),action.firstPixels,action.secondPixels);if(values){first.node.weight=values[0];second.node.weight=values[1];}break;}
    case 'move': {
      const targetEntry=find(action.targetTabsetId),target=targetEntry?.node,location=String(action.location??'center').toLowerCase();
      if(tab?.type!=='tab'||set?.type!=='tabset'||target?.type!=='tabset')throw new Error('Move requires a tab and target tabset.');
      if(!['center','left','right','top','bottom'].includes(location))throw new Error('Invalid dock location.');
      if(state.maximizedTabsetId&&location!=='center')throw new Error('Restore the workspace before splitting a tab.');
      if(target===set&&location!=='center'&&set.children.length===1)return input;
      const oldIndex=set.children.indexOf(tab);let index=Number.isInteger(action.index)&&action.index>=0?action.index:target.children.length;
      removeTab(set,oldIndex);if(set===target&&oldIndex<index&&index>0)index--;
      if(location==='center'){
        index=Math.min(index,target.children.length);target.children.splice(index,0,tab);target.selected=index;state.activeTabsetId=target.id;
      }else{
        const parent=targetEntry.parent,position=parent.children.indexOf(target),axis=['left','right'].includes(location)?'horizontal':'vertical',before=['left','top'].includes(location);
        const created={type:'tabset',id:action.newTabsetId??makeId(),weight:50,selected:0,children:[tab]};
        if(workspaceOrientation(targetEntry.depth-1)===axis){created.weight=weight(target)/2;target.weight=weight(target)/2;parent.children.splice(position+(before?0:1),0,created);}
        else{const wrapper={type:'row',id:action.newRowId??makeId(),weight:weight(target),children:before?[created,target]:[target,created]};target.weight=50;parent.children.splice(position,1,wrapper);}
        state.activeTabsetId=created.id;
      }break;
    }
    default:throw new Error(`Unknown workspace action: ${action.type}`);
  }
  tidy(state);return state;
}
export function serializeWorkspace(state) {
  const layout=clone(state.layout);const visit=node=>{delete node.active;delete node.maximized;if(node.type==='tabset'){if(node.id===state.activeTabsetId)node.active=true;if(node.id===state.maximizedTabsetId)node.maximized=true;}for(const child of node.children??[])visit(child);};visit(layout);return layout;
}
