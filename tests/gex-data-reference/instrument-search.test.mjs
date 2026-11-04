import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createGexDataSelectPreferences,GEX_SELECT_PREFERENCES_KEY,gexManualSymbolChoice,instrumentChoices} from '../../public/gex-data-app/choice-controls.js';
import {installThemedSelects} from '../../public/gex-data-app/themed-select.js';
import {createTableView} from '../../public/gex-data-app/table-view.js';
import {HEAT_METRICS} from '../../public/gex-data-app/exposure-models.js';
import {createSelectPreferences,SELECT_PREFERENCES_KEY} from '../../public/kwanty-app/select-preferences.js';
const memory=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};

test('GEX preferences persist under the GEX account namespace and share ticker groups across tools',()=>{
  const storage=memory(),gex=createGexDataSelectPreferences(storage),kwanty=createSelectPreferences(storage);
  assert.equal(gex.keyFor({id:'control-ticker'}),'instruments');assert.equal(gex.keyFor({id:'control-tickerOptional'}),'instruments');
  gex.select('instruments','SPYD');gex.toggleFavourite('instruments','SPYX');
  assert.deepEqual(createGexDataSelectPreferences(storage).savedSymbols(),['SPYD','SPYX']);
  assert.ok(storage.values.has(GEX_SELECT_PREFERENCES_KEY));assert.equal(storage.values.has(SELECT_PREFERENCES_KEY),false);
  assert.deepEqual(kwanty.get('instruments').recent,[]);
  kwanty.select('instruments','NQ');assert.deepEqual(gex.get('instruments').recent,['SPYD']);
});
test('typed symbols use the policy format and cannot add arbitrary Greek/settings values',()=>{
  for(const id of ['control-ticker','control-tickerOptional'])assert.deepEqual(gexManualSymbolChoice({id,values:['SPY']},' spyd '),{value:'SPYD',label:'Use SPYD'});
  for(const value of ['','A'.repeat(17),'<img src=x>','SPY SPYD','SPY,SPYD','AAA!'])assert.equal(gexManualSymbolChoice({id:'control-ticker'},value),null);
  assert.equal(gexManualSymbolChoice({id:'control-ticker',values:['SPYD']},'spyd'),null);
  assert.equal(gexManualSymbolChoice({id:'control-greek'},'SPYD'),null);
});
test('instrument catalogue keeps host choices and saved symbols without advertising an invented universe',()=>{
  const oldWindow=globalThis.window,preferences=createGexDataSelectPreferences(memory());preferences.select('instruments','SPYD');preferences.select('instruments','invalid symbol');
  const hostWindow={__kwantSelectPreferences:preferences,__kwantGexDataHost:{instruments:()=>[['SPY','SPY — core'],['QQQ','QQQ — core']]}};hostWindow.parent=hostWindow;
  try{globalThis.window=hostWindow;assert.deepEqual(instrumentChoices(),[['SPY','SPY — core'],['QQQ','QQQ — core'],['SPYD','SPYD — saved selection']]);}
  finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;}
});

// A focused DOM/event harness for the actual shared adapter, without a browser,
// timers, network, provider calls or dependencies on the active trading page.
class Node{
  constructor(tag,doc){this.tag=tag;this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.nodeType=1;this.children=[];this.attributes={};this.dataset={};this.listeners={};this.style={};this.className='';this.textContent='';this.value='';this.disabled=false;this.isConnected=true;this.scrollHeight=200;
    this.classList={add:(...values)=>{this.className+=' '+values.join(' ');},contains:value=>this.className.split(/\s+/).includes(value)};}
  append(...items){for(const item of items){item.parentElement=this;this.children.push(item);}}
  replaceChildren(...items){this.children=[];this.append(...items);}
  after(item){const parent=this.parentElement;item.parentElement=parent;parent.children.splice(parent.children.indexOf(this)+1,0,item);}
  get nextElementSibling(){return this.parentElement?.children[this.parentElement.children.indexOf(this)+1];}
  setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}
  addEventListener(k,v){(this.listeners[k]??=[]).push(v);}
  dispatchEvent(event){event.target=this;for(const listener of this.listeners[event.type]??[])listener(event);this['on'+event.type]?.(event);return true;}
  click(){this.dispatchEvent(new Event('click'));}focus(){this.ownerDocument.activeElement=this;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(item=>item!==this);this.isConnected=false;}
  closest(selector){for(let node=this;node;node=node.parentElement)if(selector.split(',').some(part=>{const s=part.trim();return s.startsWith('.')?node.classList.contains(s.slice(1)):s==='dialog[open]'?node.tag==='dialog'&&node.getAttribute('open')!==null:node.tag===s;}))return node;return null;}getBoundingClientRect(){return {left:0,bottom:35,width:180,height:35};}
  contains(node){return this===node||this.children.some(child=>child.contains(node));}
  matches(selector){if(selector==='select')return this.tag==='select';return selector.split(',').some(tag=>tag===this.tag);}
  querySelectorAll(selector){const all=this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);if(selector==='*')return all;
    if(selector.startsWith('.'))return all.filter(node=>node.classList.contains(selector.slice(1)));
    return all.filter(node=>{const tag=/^([a-z]+)(?:\[|:|$)/.exec(selector)?.[1],attr=/\[(role|aria-selected|type)="([^"]+)"\]/.exec(selector);return (!tag||node.tag===tag)&&(!attr||(attr[1]==='type'?node.type:node.getAttribute(attr[1]))===attr[2])&&(!selector.includes(':not(:disabled)')||!node.disabled);});}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
}
class Select extends Node{
  constructor(doc){super('select',doc);this._value='';}
  get options(){return this.querySelectorAll('option');}get value(){return this._value;}set value(value){this._value=String(value);for(const option of this.options??[])option.selected=option.value===this._value;}
  add(option){this.append(option);}
  get selectedIndex(){return this.options.findIndex(option=>option.selected);}set selectedIndex(index){this.value=this.options[index]?.value??'';}
  get selectedOptions(){return this.options.filter(option=>option.selected);}
}
class Event{constructor(type,options={}){this.type=type;Object.assign(this,options);}preventDefault(){this.defaultPrevented=true;}stopPropagation(){this.propagationStopped=true;}}
function harness({gex=true,id='control-ticker',saved=[],blank=false}={}){
  const doc={listeners:{},addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);},removeEventListener(type,listener){this.listeners[type]=(this.listeners[type]??[]).filter(item=>item!==listener);},createElement:tag=>tag==='select'?new Select(doc):new Node(tag,doc),createTextNode:text=>Object.assign(new Node('text',doc),{textContent:text})};
  doc.defaultView={HTMLSelectElement:Select,Event,MutationObserver:class{observe(){}},addEventListener(){},removeEventListener(){},innerWidth:1000,innerHeight:800,CSS:{escape:String}};
  const storage=memory(),preferences=gex?createGexDataSelectPreferences(storage):createSelectPreferences(storage);for(const symbol of saved)preferences.select('instruments',symbol);
  doc.defaultView.__kwantSelectPreferences=preferences;
  doc.documentElement=new Node('html',doc);doc.body=new Node('body',doc);doc.documentElement.append(doc.body);
  const select=new Select(doc);select.id=id;select.name='';
  if(blank){const reset=new Node('option',doc);reset.value='';reset.textContent='Select instrument';select.append(reset);}
  const option=new Node('option',doc);option.value='SPY';option.textContent='SPY';select.append(option);select.value='SPY';doc.body.append(select);
  let changes=0,inputs=0;select.addEventListener('change',()=>changes++);select.addEventListener('input',()=>inputs++);
  installThemedSelects(doc);const button=select.nextElementSibling;
  const open=()=>{button.click();return doc.body.querySelector('.kwant-choice-menu');};
  return {doc,select,button,open,storage,preferences,get changes(){return changes;},get inputs(){return inputs;}};
}

test('actual nested operator pointer selection and inner scroll preserve the table header; genuine outside pointer closes it',()=>{
  const h=harness({id:'control-greek'}),{doc}=h,table=new Node('table',doc),updates=[];
  table.tBodies=[];for(const [method,key]of [['createTHead','tHead'],['createTBody','body'],['createTFoot','tFoot']])table[method]=()=>table[key]=new Node(key,doc);
  const view=createTableView({table});
  view.setRows([],{toolId:'tape',headerMenu:true,onFilterChange:update=>updates.push(update),columns:[{key:'size',label:'Quantity',type:'integer',filterFields:[{key:'size',field:'SIZE',label:'Quantity',type:'number',operators:['EQUALS','GREATER_THAN_OR_EQUAL_TO']}]}]});
  const openFilter=()=>table.tHead.querySelectorAll('button').find(button=>button.getAttribute('aria-label')==='Filter Quantity').click();
  openFilter();const header=doc.body.querySelector('.qtable-header-menu');assert.ok(header);
  // Enhance the dynamically mounted actual table form, just as its observer does.
  const originalRoot=doc.documentElement;doc.documentElement=header;installThemedSelects(doc);doc.documentElement=originalRoot;
  const operator=header.querySelector('select'),trigger=operator.nextElementSibling;
  const documentEvent=(type,target)=>{for(const listener of [...doc.listeners[type]??[]])listener(new Event(type,{target}));};
  trigger.click();const nested=header.querySelector('.kwant-choice-menu');assert.ok(nested);assert.equal(nested.parentElement,header);
  assert.equal(Number.isFinite(Number.parseFloat(nested.style.top)),true);assert.equal(Number.isFinite(Number.parseFloat(nested.style.left)),true);
  const options=nested.querySelector('.kwant-choice-options')??nested;
  documentEvent('scroll',options);assert.equal(header.isConnected,true);assert.equal(nested.isConnected,true);
  const greater=nested.querySelectorAll('button').find(button=>button.textContent==='Greater than or equal');assert.ok(greater);
  documentEvent('pointerdown',greater);assert.equal(header.isConnected,true);greater.click();
  assert.equal(operator.value,'GREATER_THAN_OR_EQUAL_TO');assert.equal(nested.isConnected,false);assert.equal(header.isConnected,true);assert.equal(updates.length,0,'operator choice alone does not apply a provider filter');
  const form=header.querySelector('form'),value=form.querySelector('input');value.value='250';form.dispatchEvent(new Event('submit'));
  assert.deepEqual(updates,[{id:'size',key:'size',field:'SIZE',operator:'GREATER_THAN_OR_EQUAL_TO',value:250}]);
  openFilter();const reopened=doc.body.querySelector('.qtable-header-menu');assert.ok(reopened);documentEvent('pointerdown',doc.body);assert.equal(reopened.isConnected,false);view.destroy();
});
test('actual typed-symbol click commits once, closes, records recency and performs no selection during search',()=>{
  const h=harness(),menu=h.open(),search=menu.querySelector('input[type="search"]');
  search.value='spyd';search.dispatchEvent(new Event('input'));
  assert.equal(h.changes,0);assert.equal(h.select.value,'SPY');assert.equal(h.select.options.length,1);
  const use=menu.querySelectorAll('button').find(button=>button.textContent==='Use SPYD');assert.ok(use);use.click();use.click();
  assert.equal(h.select.value,'SPYD');assert.equal(h.changes,1);assert.equal(h.inputs,1);assert.equal(menu.isConnected,false);
  assert.deepEqual(h.preferences.get('instruments').recent,['SPYD']);
});
test('actual Enter is explicit, ignores composition/repeat, and commits one normalized symbol only',()=>{
  const h=harness(),menu=h.open(),search=menu.querySelector('input[type="search"]');search.value=' spyx ';search.dispatchEvent(new Event('input'));
  search.dispatchEvent(new Event('keydown',{key:'Enter',repeat:true}));search.dispatchEvent(new Event('keydown',{key:'Enter',isComposing:true}));assert.equal(h.changes,0);
  search.dispatchEvent(new Event('keydown',{key:'Enter'}));search.dispatchEvent(new Event('keydown',{key:'Enter'}));
  assert.equal(h.changes,1);assert.equal(h.select.value,'SPYX');assert.equal(menu.isConnected,false);
});
test('saved symbols reappear in an existing chooser without mutating source options until chosen',()=>{
  const h=harness({saved:['SPYD']}),menu=h.open();assert.equal(h.select.options.length,1);
  const pick=menu.querySelectorAll('button').find(button=>button.textContent==='SPYD — saved selection');assert.ok(pick);pick.click();
  assert.equal(h.select.value,'SPYD');assert.equal(h.changes,1);assert.equal(h.select.options.length,2);
});
test('fixed GEX enums and unchanged KWANTY preferences cannot create manual values',()=>{
  for(const options of [{id:'control-greek'},{gex:false,id:'ticker'}]){
    const h=harness(options),menu=h.open(),search=menu.querySelector('input[type="search"]');search.value='SPYD';search.dispatchEvent(new Event('input'));
    assert.equal(menu.querySelectorAll('button').some(button=>button.textContent==='Use SPYD'),false);
    search.dispatchEvent(new Event('keydown',{key:'Enter'}));assert.equal(h.changes,0);assert.equal(h.select.options.length,1);
  }
});

test('GEX blank reset is first and plain, never a favourite or recent symbol; catalogue title is bounded',()=>{
  const h=harness({blank:true,saved:['SPYD']}),menu=h.open(),list=menu.querySelector('.kwant-choice-options');
  assert.equal(list.children[0].children[0].textContent,'Select instrument');
  assert.equal(list.children[0].children.length,1);
  assert.equal(menu.querySelectorAll('button').some(button=>(button.getAttribute('aria-label')||'').includes('Select instrument to favourites')),false);
  assert.ok(menu.querySelectorAll('*').some(node=>node.textContent==='Symbols (A–Z)'));
  assert.equal(menu.querySelectorAll('*').some(node=>node.textContent==='All tickers (A–Z)'),false);
  list.children[0].children[0].click();
  assert.equal(h.select.value,'');assert.equal(h.changes,1);assert.deepEqual(h.preferences.get('instruments').recent,['SPYD']);
  assert.deepEqual(h.preferences.get('instruments').favourites,[]);
});

test('KWANTY keeps its existing directory title and option behavior without GEX opt-in',()=>{
  const h=harness({gex:false,id:'ticker',blank:true}),menu=h.open();
  assert.ok(menu.querySelectorAll('*').some(node=>node.textContent==='All tickers (A–Z)'));
  assert.equal(menu.querySelectorAll('*').some(node=>node.textContent==='Symbols (A–Z)'),false);
});

function actualHeatControl(doc){
  const app=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),optionsLine=app.split(/\r?\n/).find(line=>line.trim().startsWith('heatMetric:'));
  const options=runInNewContext('('+optionsLine.trim().replace(/^heatMetric:\s*/,'').replace(/,$/,'')+')',{HEAT_METRICS});
  const makeControl=app.slice(app.indexOf('  function makeControl(id)'),app.indexOf('  function getControl(id)'));
  return runInNewContext(makeControl+'; makeControl("heatMetric");',{CONTROL_META:{heatMetric:['Data mode','select']},CONTROL_OPTIONS:{heatMetric:options},activeTool:{id:'heat-map'},document:doc,element:(tag,className,text)=>{const node=doc.createElement(tag);node.className=className||'';if(text!==undefined)node.textContent=text;return node;},Option:function(text,value){const option=doc.createElement('option');option.textContent=text;option.value=value;return option;}});
}

test('actual Heat Map control groups all46 unchanged values Call19 Put19 Net8 with alphabetical short menu labels',()=>{
  const {doc}=harness(),wrap=actualHeatControl(doc),select=wrap.children[1];
  assert.deepEqual(select.children.map(group=>group.label),['Call','Put','Net']);assert.deepEqual(select.children.map(group=>group.children.length),[19,19,8]);
  assert.equal(select.options.length,46);assert.deepEqual([...select.options].map(option=>option.value).sort(),HEAT_METRICS.map(metric=>metric.apiName).sort());
  for(const group of select.children){const labels=group.children.map(option=>option.dataset.menuLabel);assert.deepEqual(labels,[...labels].sort((a,b)=>a.localeCompare(b,'en')));}
  assert.deepEqual(select.children[2].children.map(option=>option.textContent),['Net CHEX','Net DEX','Net GEX','Net Open Interest','Net Premium','Net Trade Count','Net VEX','Net Volume']);
  const iv=select.options.find(option=>option.value==='CALL_IMPLIED_VOLATILITY');assert.equal(iv.textContent,'Implied Volatility (Calls)');assert.equal(iv.dataset.menuLabel,'Implied Volatility');assert.equal(select.value,'NET_GAMMA_EXPOSURE');
});

test('actual grouped themed menu retains headings, search, full selected label, favourites, keyboard and outside closing',()=>{
  const {doc}=harness(),wrap=actualHeatControl(doc),select=wrap.children[1];select.id='control-heatMetric';
  doc.documentElement=wrap;installThemedSelects(doc);const trigger=select.nextElementSibling;trigger.click();
  let menu=doc.body.querySelector('.kwant-choice-menu');const list=menu.querySelector('.kwant-choice-options');
  assert.deepEqual(list.querySelectorAll('.kwant-choice-heading').map(node=>node.textContent).filter(label=>['Call','Put','Net'].includes(label)),['Call','Put','Net']);
  assert.equal(list.querySelectorAll('[role="option"]').length,46);
  const search=menu.querySelector('input[type="search"]');search.value='Implied Volatility';search.dispatchEvent(new Event('input'));
  assert.equal(list.querySelectorAll('[role="option"]').length,2);assert.deepEqual(list.querySelectorAll('[role="option"]').map(node=>node.textContent),['Implied Volatility','Implied Volatility']);
  const calls=list.querySelectorAll('[role="option"]')[0];calls.focus();for(const listener of doc.listeners.keydown)listener(new Event('keydown',{key:'ArrowDown',target:calls}));assert.equal(doc.activeElement,list.querySelectorAll('[role="option"]')[1]);
  const star=list.querySelectorAll('button').find(node=>node.getAttribute('aria-label')==='Add Implied Volatility (Calls) to favourites');star.click();assert.equal(list.querySelectorAll('button').some(node=>node.getAttribute('aria-label')==='Remove Implied Volatility (Calls) from favourites'),true);
  list.querySelectorAll('[role="option"]')[0].click();assert.equal(select.value,'CALL_IMPLIED_VOLATILITY');assert.equal(trigger.children[0].textContent,'Implied Volatility (Calls)');assert.equal(menu.isConnected,false);
  trigger.click();menu=doc.body.querySelector('.kwant-choice-menu');for(const listener of doc.listeners.pointerdown)listener(new Event('pointerdown',{target:doc.body}));assert.equal(menu.isConnected,false);
});

test('grouped selects without preferences retain native headings and disabled optgroup semantics',()=>{
  const {doc}=harness(),wrap=actualHeatControl(doc),select=wrap.children[1];delete doc.defaultView.__kwantSelectPreferences;select.children[1].disabled=true;
  doc.documentElement=wrap;installThemedSelects(doc);select.nextElementSibling.click();const menu=doc.body.querySelector('.kwant-choice-menu');
  assert.deepEqual(menu.querySelectorAll('.kwant-choice-heading').map(node=>node.textContent).filter(label=>['Call','Put','Net'].includes(label)),['Call','Put','Net']);
  const rows=menu.querySelectorAll('[role="option"]');assert.equal(rows.length,46);assert.equal(rows.slice(19,38).every(row=>row.disabled),true);assert.equal(rows[0].textContent,'Ask Price');
});

test('native groups retain most-recent ordering within a preference Recent section',()=>{
  const {doc}=harness(),wrap=actualHeatControl(doc),select=wrap.children[1];select.id='control-heatMetric';
  const preferences=doc.defaultView.__kwantSelectPreferences,group=preferences.keyFor({id:select.id,name:select.name,label:'',values:select.options.map(option=>option.value)});
  preferences.update(group,{showRecents:true});preferences.select(group,'CALL_CHARM');preferences.select(group,'CALL_ZOMMA');
  doc.documentElement=wrap;installThemedSelects(doc);select.nextElementSibling.click();
  const rows=doc.body.querySelector('.kwant-choice-menu').querySelector('.kwant-choice-options').querySelectorAll('[role="option"]');
  assert.deepEqual(rows.slice(0,2).map(row=>row.textContent),['Zomma','Charm']);
});
