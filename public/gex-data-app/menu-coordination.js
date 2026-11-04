// One active menu and one listener set per document, never per mounted filter.
// Closing is presentation-only: it must not dispatch filter input/change.
// The same parent document can be reached by independently evaluated modules
// in separate tool iframes. A document-owned symbol shares their portal state.
const coordinationKey=Symbol.for('kwantdesk.gex-data.menu-coordination.v1');
function stateFor(document){
  let state=document[coordinationKey];if(state)return state;
  state={active:null};Object.defineProperty(document,coordinationKey,{value:state});
  const dismiss=reason=>{const active=state.active;state.active=null;active?.close(reason);};
  const outside=event=>{if(state.active&&!state.active.owner.contains(event.target)&&!state.active.anchor?.contains(event.target))dismiss('outside');};
  document.addEventListener?.('pointerdown',outside,true);
  document.addEventListener?.('click',outside,true);
  document.addEventListener?.('keydown',event=>{if(event.key==='Escape')dismiss('escape');},true);
  return state;
}
export function claimMenu(document,owner,close,anchor=null){
  const state=stateFor(document);
  if(state.active?.owner!==owner){const previous=state.active;state.active=null;previous?.close('replace');}
  state.active={owner,close,anchor};
}
export function releaseMenu(document,owner){const state=document[coordinationKey];if(state?.active?.owner===owner)state.active=null;}
