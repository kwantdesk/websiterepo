// Source732327/432891: local Top-N presentation over actual returned levels.
// No acquisition and no inferred price inventory belongs in this picker.
export function mountDarkPoolLevelLimit({host,popup,getScope,onChange}){
  const document=host.ownerDocument,node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
  const root=node('div');root.className='control';const trigger=node('button');trigger.type='button';trigger.className='kwant-choice-trigger';trigger.setAttribute('aria-label','Modify Level Limit');trigger.setAttribute('aria-haspopup','dialog');root.append(trigger);host.append(root);
  let active=null,destroyed=false,lastKey='',refresh=null;
  const scope=()=>{const raw=getScope();return {limit:Math.max(1,Math.floor(Number(raw.limit)||50)),available:Math.max(0,Math.floor(Number(raw.available)||0))};};
  const close=()=>{active?.remove();active=null;refresh=null;};
  function sync(){if(destroyed)return;const current=scope(),key=String(current.available);if(key!==lastKey)close();lastKey=key;trigger.textContent=`Top ${current.limit} ⌄`;trigger.disabled=current.available===0;refresh?.();}
  trigger.addEventListener('click',()=>{
    if(destroyed||!scope().available)return;close();const key=lastKey,current=scope();
    const menu=popup(trigger,'Modify Level Limit',section=>{
      const output=node('output',String(Math.min(current.limit,current.available))),slider=node('input');slider.type='range';slider.min='1';slider.max=String(current.available);slider.step='1';slider.value=String(Math.min(current.limit,current.available));slider.setAttribute('aria-label','Top levels');
      const ticks=node('div');ticks.style.display='flex';ticks.style.justifyContent='space-between';
      // Literal six-mark generation in source432891; endpoint follows max.
      for(let index=0;index<6;index++)ticks.append(node('span',String(index===0?1:Math.round(index/6*current.available))));
      const commit=value=>{if(destroyed||active!==menu||menu.isConnected===false||lastKey!==key)return;onChange(Math.max(1,Math.min(current.available,Math.round(value))));};
      slider.addEventListener('input',()=>{output.textContent=slider.value;commit(Number(slider.value));});
      const reset=node('button','⟲');reset.type='button';reset.title='Reset Top Levels Count';reset.setAttribute('aria-label','Reset Top Levels Count');reset.hidden=current.limit===50;reset.addEventListener('click',()=>commit(50));
      refresh=()=>{output.textContent=String(scope().limit);slider.value=String(Math.min(scope().limit,current.available));reset.hidden=scope().limit===50;};
      section.append(output,slider,ticks,reset);
    });active=menu;
  });
  sync();return {sync,destroy(){destroyed=true;close();root.remove();}};
}
