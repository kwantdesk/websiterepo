import {NEWS_TOPIC_CHOICES} from '../../public/gex-data-app/news-feed-model.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {choicesWithSaved,instrumentChoices,setChoiceValue,snapshotTimeOptions,multiChoiceDropdown} from '../../public/gex-data-app/choice-controls.js';
import {claimMenu} from '../../public/gex-data-app/menu-coordination.js';

test('instrument list and saved choices preserve valid selections without duplicate or HTML insertion',()=>{
  assert.ok(instrumentChoices().some(([value])=>value==='QQQ'));
  assert.deepEqual(choicesWithSaved([['QQQ','Nasdaq ETF'],['SPY','S&P ETF']],['TSM','QQQ','TSM']),[['QQQ','Nasdaq ETF'],['SPY','S&P ETF'],['TSM','TSM — saved selection']]);
  const control={value:'QQQ',options:[{value:'QQQ'}],ownerDocument:{createElement:()=>({})},append(option){this.options.push(option);}};
  setChoiceValue(control,'TSM');assert.equal(control.value,'TSM');assert.equal(control.options.at(-1).textContent,'TSM — saved selection');setChoiceValue(control,'QQQ');assert.equal(control.options.length,2);
});
test('snapshot dropdown offers only real available timestamps and keeps original indices',()=>{
  const timeline=[1000,5000,6000];const options=snapshotTimeOptions(timeline,time=>`time:${time}`);
  assert.deepEqual(options,[['0','time:1000'],['1','time:5000'],['2','time:6000 · Latest available']]);
  assert.deepEqual(snapshotTimeOptions([],String),[]);
});
class Element extends EventTarget {
  constructor(tag,doc){super();this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.attributes={};}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=[...items];}
  setAttribute(name,value){this.attributes[name]=value;}
  contains(target){return target===this||this.children.some(child=>child.contains?.(target));}
}
test('multi-choice dropdown preserves OR selections, checkbox changes and clearing without typed CSV',()=>{
  const previous=globalThis.document;const doc={createElement:tag=>new Element(tag,doc)};globalThis.document=doc;
  try{
    const picker=multiChoiceDropdown({choices:[['SPY','SPY'],['QQQ','QQQ']],values:['SPY','TSM'],label:'Test instruments'});
    assert.equal(picker.tagName,'DETAILS');assert.equal(picker.value,'SPY, TSM');
    let changes=0;picker.addEventListener('change',()=>changes++);
    const options=picker.children[1],qqq=options.children.find(row=>row.children?.[0]?.value==='QQQ').children[0];
    qqq.checked=true;qqq.dispatchEvent(new Event('change'));assert.equal(picker.value,'SPY, TSM, QQQ');assert.equal(changes,1);
    picker.value='QQQ, AMD';assert.equal(picker.value,'QQQ, AMD');assert.equal(changes,1);
    picker.children[1].children[0].dispatchEvent(new Event('click'));assert.equal(picker.value,'');assert.equal(changes,2);assert.equal(picker.children[0].textContent,'All instruments');
  }finally{globalThis.document=previous;}
});

test('multi-choice summaries show readable labels without changing wire selection values',()=>{
 const previous=globalThis.document;const doc={createElement:tag=>new Element(tag,doc)};globalThis.document=doc;
 try{const picker=multiChoiceDropdown({choices:[['ABOVE_ASK','Above Ask'],['ASK','Ask']],values:['ABOVE_ASK','ASK'],label:'Side'});assert.equal(picker.children[0].textContent,'Above Ask, Ask');assert.equal(picker.value,'ABOVE_ASK, ASK');}finally{globalThis.document=previous;}
});

test('searchable moneyness filters actual choices without changing selection, losing search or bubbling refresh events',()=>{
 const previous=globalThis.document;const doc={createElement:tag=>new Element(tag,doc)};globalThis.document=doc;
 try{
  const picker=multiChoiceDropdown({choices:[['ATM','At-the-Money'],['ITM','In-the-Money'],['OTM','Out-of-the-Money']],values:['ITM'],label:'Moneyness',emptyLabel:'All',searchable:true});
  picker.open=true;let changes=0;picker.addEventListener('change',()=>changes++);
  const panel=picker.children[1],[search,clear,results]=panel.children;
  assert.equal(search.attributes['aria-label'],'Search Moneyness');assert.equal(search.type,'search');
  let inputStopped=false,changeStopped=false;search.addEventListener('input',event=>{inputStopped=event.cancelBubble;});search.addEventListener('change',event=>{changeStopped=event.cancelBubble;});
  search.value='  at-the  ';search.dispatchEvent(new Event('input',{bubbles:true}));search.dispatchEvent(new Event('change',{bubbles:true}));
  assert.equal(inputStopped,true);assert.equal(changeStopped,true);assert.equal(changes,0);assert.equal(picker.value,'ITM');
  assert.equal(results.children.length,1);assert.equal(results.children[0].children[0].value,'ATM');assert.equal(panel.children[0],search);
  const checkbox=results.children[0].children[0];checkbox.checked=true;checkbox.dispatchEvent(new Event('change'));
  assert.equal(picker.value,'ITM, ATM');assert.equal(changes,1);assert.equal(search.value,'  at-the  ');assert.equal(picker.open,true);
  clear.dispatchEvent(new Event('click'));assert.equal(picker.value,'');assert.equal(search.value,'');assert.equal(results.children.length,3);assert.equal(changes,2);assert.equal(picker.open,true);
 }finally{globalThis.document=previous;}
});

test('searchable trade side retains selected hidden values and clear action even with no matching results',()=>{
 const previous=globalThis.document;const doc={createElement:tag=>new Element(tag,doc)};globalThis.document=doc;
 try{
  const picker=multiChoiceDropdown({choices:[['ASK','Ask'],['ABOVE_ASK','Above Ask'],['BID','Bid']],values:['BID'],label:'Side',emptyLabel:'All',searchable:true});
  const [search,clear,results]=picker.children[1].children;search.value='nonexistent';search.dispatchEvent(new Event('input'));
  assert.equal(results.children[0].textContent,'No matching options.');assert.equal(picker.value,'BID');assert.equal(clear.textContent,'All');
  picker.value='BID, ABOVE_ASK';search.value='above';search.dispatchEvent(new Event('input'));assert.equal(results.children[0].children[0].checked,true);
  assert.equal(picker.children[0].textContent,'Bid, Above Ask');
 }finally{globalThis.document=previous;}
});

test('multi menus close each other, outside/title and shared popup claims without changing filters; inside clicks stay open',()=>{
 const previous=globalThis.document,listeners=new Map();const doc={createElement:tag=>new Element(tag,doc),addEventListener(type,listener){const rows=listeners.get(type)??[];rows.push(listener);listeners.set(type,rows);}};globalThis.document=doc;
 const outside=(type,target,key)=>{for(const listener of listeners.get(type)??[])listener({target,key});};
 try{
  const money=multiChoiceDropdown({choices:[['OTM','Out of the Money']],values:['OTM'],label:'Moneyness',searchable:true,compactSummary:true});
  const side=multiChoiceDropdown({choices:[['ASK','Ask']],label:'Side',searchable:true});let changes=0;money.addEventListener('change',()=>changes++);side.addEventListener('change',()=>changes++);
  money.open=true;money.dispatchEvent(new Event('toggle'));outside('pointerdown',money.children[1].children[0]);assert.equal(money.open,true);
  side.open=true;side.dispatchEvent(new Event('toggle'));assert.equal(money.open,false);assert.equal(side.open,true);
  outside('click',new Element('h2',doc));assert.equal(side.open,false);
  money.open=true;money.dispatchEvent(new Event('toggle'));const popup=new Element('section',doc);let closed=0;claimMenu(doc,popup,()=>closed++);assert.equal(money.open,false);
  money.open=true;money.dispatchEvent(new Event('toggle'));assert.equal(closed,1);outside('keydown',money,'Escape');assert.equal(money.open,false);
  assert.equal(money.value,'OTM');assert.equal(changes,0);assert.equal(listeners.get('pointerdown').length,1);
 }finally{globalThis.document=previous;}
});

test('compact moneyness and side summaries retain exact selected order while full menu names remain readable',()=>{
 const previous=globalThis.document;const doc={createElement:tag=>new Element(tag,doc)};globalThis.document=doc;
 try{
  const money=multiChoiceDropdown({choices:[['ATM','At the Money'],['OTM','Out of the Money']],values:['OTM','ATM'],label:'Moneyness',compactSummary:true});
  assert.equal(money.children[0].textContent,'OTM, ATM');assert.equal(money.children[1].children[2].children[1].textContent,'Out of the Money');
  const side=multiChoiceDropdown({choices:[['ASK','Ask'],['ABOVE_ASK','Above Ask']],values:['ASK','ABOVE_ASK'],summaryLabels:{ASK:'A',ABOVE_ASK:'AA'}});
  assert.equal(side.children[0].textContent,'A, AA');side.value='ABOVE_ASK, ASK';assert.equal(side.children[0].textContent,'AA, A');assert.equal(side.value,'ABOVE_ASK, ASK');
  side.children[1].children[0].dispatchEvent(new Event('click'));assert.equal(side.children[0].textContent,'All instruments');
 }finally{globalThis.document=previous;}
});

test('independently loaded tool-frame coordinators share one parent-document menu and listener set',async()=>{
 const other=await import('../../public/gex-data-app/menu-coordination.js?independent-frame');
 const listeners=new Map(),doc={addEventListener(type,listener){const rows=listeners.get(type)??[];rows.push(listener);listeners.set(type,rows);}};
 const first=new Element('section',doc),second=new Element('section',doc);let firstClosed=0,secondClosed=0;
 claimMenu(doc,first,()=>firstClosed++);other.claimMenu(doc,second,()=>secondClosed++);
 assert.equal(firstClosed,1);assert.equal(secondClosed,0);assert.equal(listeners.get('pointerdown').length,1);
 for(const listener of listeners.get('pointerdown'))listener({target:second});assert.equal(secondClosed,0);
 for(const listener of listeners.get('pointerdown'))listener({target:new Element('h2',doc)});assert.equal(secondClosed,1);
});
test('all instrument restores and overrides use the select-aware path; snapshot and enum choices are dropdowns',()=>{
  const app=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');
  assert.match(app,/ticker: \["Instrument", "select"/);assert.match(app,/tickerOptional: \["Instrument", "select"/);
  assert.match(app,/setChoiceValue\(control,result.value\[0\]\)/);assert.match(app,/setChoiceValue\(control,control.dataset.overrideOwn\)/);
  assert.match(app,/setControl\(input.dataset.control,value\)/);assert.match(app,/aria-label','Snapshot time/);assert.match(app,/range.value=timeSelect.value;select\(\)/);
  const editor=readFileSync(new URL('../../public/gex-data-app/filter-editor.js',import.meta.url),'utf8');assert.doesNotMatch(editor,/datalist/);assert.match(editor,/metadata\?\.choices\)input=multiChoiceDropdown/);
});

test('notification instrument picker supports multiple listed and explicit symbols without restricting filters to the fallback catalogue',()=>{
  const doc={createElement:tag=>new Element(tag,doc)},picker=multiChoiceDropdown({document:doc,choices:[['SPY','SPY']],values:['SPY'],label:'Instrument',searchable:true,allowCustomSymbol:true});
  const search=picker.children[1].children[0],results=picker.children[1].children[2];let changes=0;picker.addEventListener('change',()=>changes++);
  search.value='SRXH';search.dispatchEvent(new Event('input'));assert.equal(changes,0);const use=results.children.find(node=>node.textContent==='Use SRXH');assert.ok(use);use.dispatchEvent(new Event('click'));assert.equal(picker.value,'SPY, SRXH');assert.equal(changes,1);
  setChoiceValue(picker,'QQQ, AMD');assert.equal(picker.value,'QQQ, AMD');assert.equal(changes,1,'restoring the custom control does not emit a provider request');
  search.value='BAD SYMBOL';search.dispatchEvent(new Event('input'));assert.equal(results.children.some(node=>node.textContent==='Use BAD SYMBOL'),false);
  const ordinary=multiChoiceDropdown({document:doc,choices:[['SPY','SPY']],label:'Other',searchable:true}),ordinarySearch=ordinary.children[1].children[0];ordinarySearch.value='SRXH';ordinarySearch.dispatchEvent(new Event('input'));assert.equal(ordinary.children[1].children[2].children.some(node=>node.textContent==='Use SRXH'),false);
});

test('News Topic uses searchable catalogue options without changing hidden selections or unknown restored tags',()=>{
 const app=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),searchable=/searchable:(id===[^,]+),compactSummary/.exec(app)?.[1];assert.ok(searchable);
 const enabled=id=>Function('id','return '+searchable)(id);assert.equal(enabled('newsTopic'),true);assert.equal(enabled('newsSentiment'),false);assert.equal(enabled('sector'),false);
 const doc={createElement:tag=>new Element(tag,doc)},picker=multiChoiceDropdown({document:doc,choices:NEWS_TOPIC_CHOICES.map(({value,label})=>[value,label]),values:['FDA','WIIM','PRODUCT_LAUNCHES'],label:'Topic',searchable:enabled('newsTopic')});
 const [search,,results]=picker.children[1].children;let changes=0;picker.addEventListener('change',()=>changes++);search.value='m&a';search.dispatchEvent(new Event('input'));assert.equal(changes,0);assert.equal(results.children.length,1);assert.equal(results.children[0].children[0].value,'M_AND_A');assert.equal(picker.value,'FDA, WIIM, PRODUCT_LAUNCHES');results.children[0].children[0].checked=true;results.children[0].children[0].dispatchEvent(new Event('change'));assert.equal(picker.value,'FDA, WIIM, PRODUCT_LAUNCHES, M_AND_A');assert.equal(changes,1);search.value='no such topic';search.dispatchEvent(new Event('input'));assert.equal(results.children[0].textContent,'No matching options.');assert.equal(changes,1);
});
