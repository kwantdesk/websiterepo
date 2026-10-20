// Reuse the account's existing dropdown favourites; never start a second feed.
export function mountTickerShortcuts({root,select,preferences,currentTicker,isVisible}){
 const doc=root.ownerDocument;
 const render=()=>{
  const focused=root.contains(doc.activeElement)?doc.activeElement?.dataset.ticker:null;
  root.hidden=!isVisible();root.replaceChildren();
  if(root.hidden)return;
  const favourites=new Set(preferences?.get('instruments').favourites||[]);
  const options=[...select.options].filter(option=>favourites.has(option.value)&&!option.disabled)
   .sort((a,b)=>a.value.localeCompare(b.value,'en',{sensitivity:'base',numeric:true}));
  for(const option of options){
   const button=doc.createElement('button');button.type='button';button.textContent=option.value;button.dataset.ticker=option.value;
   button.title=option.textContent;button.setAttribute('aria-label','Switch ticker to '+option.value);
   button.setAttribute('aria-pressed',String(currentTicker()===option.value));
   button.addEventListener('click',()=>{
    if(select.value===option.value)return;
    try{preferences?.select('instruments',option.value);}catch{/* Storage failure must not prevent a ticker switch. */}
    select.value=option.value;
    select.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));
   });root.append(button);
  }
  if(!options.length){
   const button=doc.createElement('button');button.type='button';button.textContent='☆ Favourites';button.title='Star tickers in the ticker dropdown to pin them here';
   button.addEventListener('click',()=>select.nextElementSibling?.click());root.append(button);
  }
  if(focused)[...root.children].find(button=>button.dataset.ticker===focused)?.focus();
 };
 const unsubscribe=preferences?.subscribe?.(group=>{if(group==='instruments')render();});
 select.addEventListener('change',render);render();
 return {render,dispose(){unsubscribe?.();select.removeEventListener('change',render);}};
}
