// Menus share presentation-only dismissal across their document and chart frames.
const coordinationKey=Symbol.for('kwantdesk.gex-data.menu-coordination.v1');
function contains(owner,target){
  if(!owner||!target)return false;
  try{
    if(owner.contains(target))return true;
    let doc=target.ownerDocument;
    while(doc&&doc!==owner.ownerDocument){const frame=doc.defaultView?.frameElement;if(!frame)break;if(owner.contains(frame))return true;doc=frame.ownerDocument;}
  }catch{}
  return false;
}
function stateFor(document){
  let state=document[coordinationKey];if(state)return state;
  state={menus:[],documents:new WeakSet(),frames:new WeakSet()};Object.defineProperty(document,coordinationKey,{value:state});
  const dismiss=reason=>{const active=state.menus.pop();active?.close(reason);};
  const outside=event=>{while(state.menus.length){const active=state.menus.at(-1);if(contains(active.owner,event.target)||contains(active.anchor,event.target))break;dismiss('outside');}};
  const watchFrame=frame=>{
    if(state.frames.has(frame))return;state.frames.add(frame);
    const attach=()=>{try{if(frame.contentDocument)watchDocument(frame.contentDocument);}catch{}};
    frame.addEventListener?.('load',attach);attach();
  };
  const scan=node=>{if(node.matches?.('iframe'))watchFrame(node);node.querySelectorAll?.('iframe').forEach(watchFrame);};
  const watchDocument=doc=>{
    if(state.documents.has(doc))return;state.documents.add(doc);
    doc.addEventListener?.('pointerdown',outside,true);
    doc.addEventListener?.('click',outside,true);
    doc.addEventListener?.('keydown',event=>{if(event.key==='Escape')dismiss('escape');},true);
    scan(doc);
    const Observer=doc.defaultView?.MutationObserver;
    if(Observer&&doc.documentElement)new Observer(records=>{for(const record of records)for(const node of record.addedNodes)scan(node);}).observe(doc.documentElement,{childList:true,subtree:true});
  };
  watchDocument(document);return state;
}
export function claimMenu(document,owner,close,anchor=null){
  const state=stateFor(document);
  if(state.menus.at(-1)?.owner===owner)return;
  // A picker within a filter panel belongs to that panel, rather than replacing it.
  while(state.menus.length){const active=state.menus.at(-1);if(contains(active.owner,owner)||contains(active.owner,anchor))break;state.menus.pop();active.close('replace');}
  state.menus.push({owner,close,anchor});
}
export function releaseMenu(document,owner){const state=document[coordinationKey];if(state)state.menus=state.menus.filter(menu=>menu.owner!==owner);}

export function dismissDialogOnBackdrop(dialog){
  const outside=event=>{const rect=dialog.getBoundingClientRect();return event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;};
  let backdropPointer=null;
  dialog.addEventListener('pointerdown',event=>{backdropPointer=event.target===dialog&&outside(event)?event.pointerId:null;});
  dialog.addEventListener('pointercancel',()=>{backdropPointer=null;});
  dialog.addEventListener('pointerup',event=>{const dismiss=backdropPointer===event.pointerId&&event.target===dialog&&outside(event);backdropPointer=null;if(dismiss)dialog.close();});
}
