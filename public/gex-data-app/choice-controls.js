// Shared UI choices only: no provider requests or inferred source availability.
import {createSelectPreferences,choiceSections} from '../kwanty-app/select-preferences.js?v=3';
import {claimMenu,releaseMenu} from './menu-coordination.js';
export const GEX_SELECT_PREFERENCES_KEY='gex-data:select-preferences:v1';
const manualSymbolControl=metadata=>['control-ticker','control-tickerOptional'].includes(metadata?.id);
// Numeric inventories already arrive in their canonical duration order. Keep
// that order within the directory/favourites while preserving chosen recents.
export function gexChoiceSections(options,preferences,query='',context={}){
  const sections=choiceSections(options,preferences,query,context);
  if(!['control:control-period','control:control-lookback','control:control-maturity'].includes(context.group))return sections;
  const order=new Map(options.map((option,index)=>[option.value,index]));
  return sections.map(section=>section.label==='Recent'?section:{...section,options:[...section.options].sort((a,b)=>(order.get(a.value)??Infinity)-(order.get(b.value)??Infinity))});
}
export function gexManualSymbolChoice(metadata,query){
  if(!manualSymbolControl(metadata))return null;
  const value=String(query??'').trim().toUpperCase();
  if(!/^[A-Z0-9./^_-]{1,16}$/.test(value)||(metadata.values||[]).some(item=>String(item).toUpperCase()===value))return null;
  return {value,label:`Use ${value}`};
}
export function createGexDataSelectPreferences(storage){
  const preferences=createSelectPreferences({getItem:()=>storage.getItem(GEX_SELECT_PREFERENCES_KEY),setItem:(_key,value)=>storage.setItem(GEX_SELECT_PREFERENCES_KEY,value)});
  const savedSymbols=()=>[...new Set([...preferences.get('instruments').recent,...preferences.get('instruments').favourites])].filter(value=>/^[A-Z0-9./^_-]{1,16}$/.test(value));
  return {...preferences,sections:gexChoiceSections,keyFor:metadata=>['control-ticker','control-tickerOptional'].includes(metadata.id)?'instruments':preferences.keyFor(metadata),
    savedSymbols,savedOptionsFor:group=>group==='instruments'?savedSymbols().map(value=>({value,label:`${value} — saved selection`})) : [],customOptionFor:gexManualSymbolChoice,isManualSymbolControl:manualSymbolControl};
}
const FALLBACK = ['SPX','NDX','SPY','QQQ','IWM','VIX','AAPL','NVDA','TSLA','MSFT','AMZN','META','AMD'];
export function instrumentChoices() {
  let owner = typeof window === 'undefined' ? null : window;
  const saved=owner?.__kwantSelectPreferences?.savedSymbols?.()??[];
  for (let i=0; owner && i<5; i++) {
    try {
      const choices=owner.__kwantGexDataHost?.instruments?.();
      if(Array.isArray(choices)&&choices.length)return choicesWithSaved(choices,saved);
      if(owner.parent!==owner)owner=owner.parent;else if(owner.opener)owner=owner.opener;else break;
    } catch { break; }
  }
  return choicesWithSaved(FALLBACK.map(value=>[value,value]),saved);
}
export function choicesWithSaved(choices, saved=[]) {
  const result=new Map(choices.map(([value,label])=>[String(value),String(label)]));
  for(const value of saved.map(String).filter(Boolean))if(!result.has(value))result.set(value,`${value} — saved selection`);
  return [...result];
}
export function setChoiceValue(select,value) {
  const next=String(value??'');
  if(!select.options){select.value=next;return;}
  if(![...select.options].some(option=>option.value===next)) {
    const option=select.ownerDocument.createElement('option');option.value=next;option.textContent=next?`${next} — saved selection`:'All instruments';select.append(option);
  }
  select.value=next;
}
/** A real dropdown with checkboxes; multi-value OR filters never collapse to one ticker. */
export function multiChoiceDropdown({choices,values=[],label='Instruments',emptyLabel='All instruments',searchable=false,compactSummary=false,countSummary=false,summaryLabels={},allowCustomSymbol=false,customSymbolPattern=/^[A-Z0-9./^_-]{1,16}$/,document:ownerDocument=globalThis.document}) {
  const document=ownerDocument,root=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('div');
  root.className='choice-dropdown';summary.setAttribute('aria-label',label);list.className='choice-dropdown-options';list.setAttribute('role','group');list.setAttribute('aria-label',label+' options');
  let selected=new Set(values.map(String));
  const labels=new Map(choices.map(([value,name])=>[String(value),String(name)]));
  const search=searchable?document.createElement('input'):null,results=searchable?document.createElement('div'):list;
  const clear=document.createElement('button');clear.type='button';clear.textContent=emptyLabel;
  if(search){
    search.type='search';search.placeholder='Select';search.setAttribute('aria-label',`Search ${label}`);
    // This menu lives inside the tool filter form. Searching must never bubble
    // into its input/change handlers and trigger a provider refresh.
    search.addEventListener('input',event=>{event.stopPropagation();render();});
    search.addEventListener('change',event=>event.stopPropagation());
    search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();}});
    list.append(search,clear,results);
  }
  const update=()=>{const names=[...selected].map(value=>Object.hasOwn(summaryLabels,value)?summaryLabels[value]:compactSummary?({AT_THE_MONEY:'ATM',IN_THE_MONEY:'ITM',OUT_OF_THE_MONEY:'OTM'}[value]||value):labels.get(value)||value);summary.textContent=names.length?countSummary&&names.length>1?`${names[0]} + ${names.length-1}`:names.join(', '):emptyLabel;};
  const render=()=>{
    results.replaceChildren();if(!search)list.append(clear);
    const query=String(search?.value??'').trim().toLowerCase(),matches=choicesWithSaved(choices,[...selected]).filter(([value,name])=>!query||`${value} ${name}`.toLowerCase().includes(query));
    for(const [value,name]of matches){
      const field=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');input.type='checkbox';input.value=value;input.checked=selected.has(value);text.textContent=name;
      input.addEventListener('change',event=>{event.stopPropagation();if(input.checked)selected.add(value);else selected.delete(value);update();root.dispatchEvent(new Event('change',{bubbles:true}));});field.append(input,text);results.append(field);
    }
    if(allowCustomSymbol&&search){const value=query.toUpperCase();if(customSymbolPattern.test(value)&&!choicesWithSaved(choices,[...selected]).some(([key])=>key.toUpperCase()===value)){const use=document.createElement('button');use.type='button';use.textContent=`Use ${value}`;use.addEventListener('click',event=>{event.stopPropagation();selected.add(value);search.value='';render();root.dispatchEvent(new Event('change',{bubbles:true}));});results.append(use);}}
    if(search&&!matches.length){const empty=document.createElement('p');empty.textContent='No matching options.';results.append(empty);}
    update();
  };
  clear.addEventListener('click',()=>{selected.clear();if(search)search.value='';render();root.dispatchEvent(new Event('change',{bubbles:true}));});
  Object.defineProperty(root,'value',{get:()=>[...selected].join(', '),set:value=>{selected=new Set(String(value??'').split(/[,\s]+/).filter(Boolean));render();}});
  // Refresh observed inventories without replacing an open menu, its search,
  // or saved selections. This never dispatches a filter change/provider load.
  root.setChoices=next=>{choices=next;labels.clear();for(const[value,name]of choices)labels.set(String(value),String(name));render();};
  root.addEventListener('toggle',()=>{if(root.open)claimMenu(document,root,()=>{root.open=false;});else releaseMenu(document,root);});
  root.append(summary,list);render();return root;
}
export function snapshotTimeOptions(timeline,format) {
  return timeline.map((time,index)=>[String(index),`${format(time)}${index===timeline.length-1?' · Latest available':''}`]);
}
