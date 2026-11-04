"use client";
import {useEffect,useRef,type RefObject} from 'react';
import {DrawingEditHistory} from '@/lib/drawingEditHistory';
const activePanes=new WeakMap<Document,HTMLElement>();
const textTarget=(target:EventTarget|null)=>(target as Element|null)?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
export function useChartDrawingUndo(root:RefObject<HTMLElement|null>,scope:string,enabled=true){
  const ref=useRef({scope,history:new DrawingEditHistory()});
  if(ref.current.scope!==scope)ref.current={scope,history:new DrawingEditHistory()};
  const history=ref.current.history;
  const enabledRef=useRef(enabled);enabledRef.current=enabled;
  useEffect(()=>{
    const pane=root.current;if(!pane)return;const doc=pane.ownerDocument,view=doc.defaultView;
    const focus=(event:PointerEvent)=>{history.beginGesture();if(pane.contains(event.target as Node)){
      activePanes.set(doc,pane);
      // Canvas grabs prevent the browser's default focus change. A previously
      // focused order-ticket/text field must not keep stealing drawing undo.
      if(!textTarget(event.target)&&textTarget(doc.activeElement))(doc.activeElement as HTMLElement).blur();
    }else if(activePanes.get(doc)===pane)activePanes.delete(doc);};
    const key=(event:KeyboardEvent)=>{
      if(!enabledRef.current||event.defaultPrevented||event.altKey||!(event.ctrlKey||event.metaKey)||activePanes.get(doc)!==pane)return;
      if(textTarget(event.target))return;
      const command=event.key.toLowerCase();if(command!=='z'&&command!=='y')return;
      if(history.step(command==='y'||event.shiftKey)){event.preventDefault();event.stopImmediatePropagation();}
    };
    // Capture before drawing layers stop propagation to claim a drag.
    view?.addEventListener('pointerdown',focus,true);doc.addEventListener('keydown',key,true);
    return()=>{view?.removeEventListener('pointerdown',focus,true);doc.removeEventListener('keydown',key,true);if(activePanes.get(doc)===pane)activePanes.delete(doc);};
  },[root,history]);
  return history;
}
