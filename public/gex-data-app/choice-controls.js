// Shared UI choices only: no provider requests or inferred source availability.
const FALLBACK = ['SPX','NDX','SPY','QQQ','IWM','VIX','AAPL','NVDA','TSLA','MSFT','AMZN','META','AMD'];
export function instrumentChoices() {
  let owner = typeof window === 'undefined' ? null : window;
  for (let i=0; owner && i<5; i++) {
    try {
      const choices=owner.__kwantGexDataHost?.instruments?.();
      if(Array.isArray(choices)&&choices.length)return choices;
      if(owner.parent!==owner)owner=owner.parent;else if(owner.opener)owner=owner.opener;else break;
    } catch { break; }
  }
  return FALLBACK.map(value=>[value,value]);
}
export function choicesWithSaved(choices, saved=[]) {
  const result=new Map(choices.map(([value,label])=>[String(value),String(label)]));
  for(const value of saved.map(String).filter(Boolean))if(!result.has(value))result.set(value,`${value} — saved selection`);
  return [...result];
}
export function setChoiceValue(select,value) {
  const next=String(value??'');
  if(![...select.options].some(option=>option.value===next)) {
    const option=select.ownerDocument.createElement('option');option.value=next;option.textContent=next?`${next} — saved selection`:'All instruments';select.append(option);
  }
  select.value=next;
}
/** A real dropdown with checkboxes; multi-value OR filters never collapse to one ticker. */
export function multiChoiceDropdown({choices,values=[],label='Instruments',emptyLabel='All instruments'}) {
  const document=globalThis.document,root=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('div');
  root.className='choice-dropdown';summary.setAttribute('aria-label',label);list.className='choice-dropdown-options';list.setAttribute('role','group');list.setAttribute('aria-label',label+' options');
  let selected=new Set(values.map(String));
  const update=()=>{summary.textContent=selected.size?[...selected].join(', '):emptyLabel;};
  const render=()=>{
    list.replaceChildren();
    const clear=document.createElement('button');clear.type='button';clear.textContent=emptyLabel;clear.addEventListener('click',()=>{selected.clear();render();root.dispatchEvent(new Event('change',{bubbles:true}));});list.append(clear);
    for(const [value,name]of choicesWithSaved(choices,[...selected])){
      const field=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');input.type='checkbox';input.value=value;input.checked=selected.has(value);text.textContent=name;
      input.addEventListener('change',event=>{event.stopPropagation();if(input.checked)selected.add(value);else selected.delete(value);update();root.dispatchEvent(new Event('change',{bubbles:true}));});field.append(input,text);list.append(field);
    }
    update();
  };
  Object.defineProperty(root,'value',{get:()=>[...selected].join(', '),set:value=>{selected=new Set(String(value??'').split(/[,\s]+/).filter(Boolean));render();}});
  root.append(summary,list);render();return root;
}
export function snapshotTimeOptions(timeline,format) {
  return timeline.map((time,index)=>[String(index),`${format(time)}${index===timeline.length-1?' · Latest available':''}`]);
}
