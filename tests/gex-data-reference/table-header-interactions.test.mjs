import assert from 'node:assert/strict';
import test from 'node:test';
import { createTableView,formatTableValue,normalizeTableHeaderFilter } from '../../public/gex-data-app/table-view.js';
import { CONSOLIDATED_COLUMNS } from '../../public/gex-data-app/options-models.js';
import { UNCONSOLIDATED_COLUMNS } from '../../public/gex-data-app/option-trade-detail-model.js';
import {EQUITY_PRINT_COLUMNS} from '../../public/gex-data-app/equity-renderers.js';
import {equityPrintColumnFields,equityPrintField} from '../../public/gex-data-app/equity-print-interaction-model.js';
import {mountEquityHeaderFilter} from '../../public/gex-data-app/equity-header-filter-controls.js';
import {notificationColumnFields} from '../../public/gex-data-app/exchange-notification-interaction-model.js';

class Element {
  constructor(document,tag='div'){this.ownerDocument=document;this.tagName=tag;this.children=[];this.style={};this.dataset={};this.attributes={};this.events=new Map();this.textContent='';this.classList={add(){}};}
  append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
  replaceChildren(...children){this.children=[];this.append(...children);}
  setAttribute(name,value){this.attributes[name]=value;}
  addEventListener(name,fn){if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(fn);}
  removeEventListener(name,fn){this.events.get(name)?.delete(fn);}
  emit(name,event={}){for(const fn of [...this.events.get(name)||[]])fn({target:this,preventDefault(){},stopPropagation(){},...event});}
  dispatchEvent(event){this.emit(event.type);return true;}
  contains(node){return this===node||this.children.some(child=>child.contains?.(node));}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);}
  querySelectorAll(){return [];}
  querySelector(selector){return walk(this).find(node=>node.tagName===selector)||null;}
  getBoundingClientRect(){return {left:100,bottom:40,height:28};}
  focus(){this.focused=true;}
}
const walk=node=>[node,...(node.children||[]).flatMap(walk)];
function fixture(){
  const doc=new Element(null,'document');doc.ownerDocument=doc;doc.body=new Element(doc,'body');doc.defaultView=new Element(doc,'window');doc.defaultView.innerWidth=1000;doc.defaultView.innerHeight=720;
  doc.createElement=tag=>new Element(doc,tag);doc.createTextNode=text=>({textContent:text});
  const table=new Element(doc,'table');table.tBodies=[];for(const [fn,key] of [['createTHead','tHead'],['createTBody','body'],['createTFoot','tFoot']])table[fn]=()=>table[key]=new Element(doc,key);
  const view=createTableView({table});return {doc,table,view};
}
const field={key:'strikePrice',field:'STRIKE_PRICE',label:'Strike Price',type:'number',operators:['EQUALS','GREATER_THAN_OR_EQUAL_TO']};
const contract={...CONSOLIDATED_COLUMNS.find(column=>column.key==='contract'),filterFields:[field]};

const equityColumns=EQUITY_PRINT_COLUMNS.map(column=>{const fields=equityPrintColumnFields(column.key),entries=column.key==='ticker'?fields:fields.slice(0,1);return {...column,id:column.key,key:column.timeField??column.key,type:column.key==='size'?'integer':'text',sortField:fields[0]?.field,sortKeys:entries.map(field=>({key:field.key,field:field.field,label:field.label})),sortable:column.key!=='bidAsk'};});

test('Equity auto filter retains its actual editor/input across responses, preserves incomplete data and cleans pending work',async()=>{
  const {view,table,doc}=fixture(),updates=[],columns=[{...equityColumns.find(column=>column.id==='size'),filterFields:equityPrintColumnFields('size')}],config={toolId:'equity-prints',columns,headerMenu:true,onFilterChange:update=>updates.push(update)};
  view.setRows([{size:17}],config);walk(table.tHead).find(node=>node.attributes['aria-label']==='Filter Quantity').emit('click');
  const editor=doc.body.children[0],input=walk(editor).find(node=>node.attributes['aria-label']==='Quantity value'),operator=walk(editor).find(node=>node.attributes['aria-label']==='Quantity operator');
  assert.equal(walk(editor).some(node=>['Apply','Clear'].includes(node.textContent)),false);assert.equal(walk(editor).find(node=>node.attributes['aria-label']==='Field').readOnly,true);
  operator.emit('click');assert.equal(walk(editor).filter(node=>node.attributes.role==='option').length,6);doc.emit('keydown',{key:'Escape'});assert.equal(doc.body.children[0],editor,'first Escape closes only the nested chooser');assert.equal(operator.attributes['aria-expanded'],'false');
  input.value='5000000';input.emit('input');assert.equal(input.value,'5,000,000');await new Promise(resolve=>setTimeout(resolve,330));assert.equal(updates.length,1);assert.equal(updates[0].value,5000000);
  input.focus();view.setRows([{size:5000000}],{...config,headerFilters:[updates[0]]});assert.equal(doc.body.children[0],editor);assert.equal(walk(editor).find(node=>node.attributes['aria-label']==='Quantity value'),input);assert.equal(input.focused,true);
  doc.emit('scroll',{target:table.body});doc.defaultView.emit('resize');assert.equal(doc.body.children[0],editor,'layout/viewport changes reposition the opt-in Equity editor');assert.equal(walk(table.tHead).find(node=>node.attributes['aria-label']==='Filter Quantity').attributes['aria-expanded'],'true');
  input.value='-';input.emit('input');await new Promise(resolve=>setTimeout(resolve,330));assert.equal(updates.length,1);assert.equal(view.getVisibleRows()[0].size,5000000);
  input.value='';input.emit('input');await new Promise(resolve=>setTimeout(resolve,330));assert.equal(updates.at(-1).operator,null);assert.equal(doc.body.children[0],editor);
  input.value='123';input.emit('input');view.closeAutoFilter();await new Promise(resolve=>setTimeout(resolve,330));assert.equal(updates.length,2);assert.equal(doc.body.children.length,0);view.destroy();
});

test('Equity multi-field editor restores per-field values, cancels old drafts and keeps typed OR/false values',()=>{
  const {doc}=fixture(),host=new Element(doc),timers=new Map(),commits=[],current=new Map([['PRICE',{operator:'EQUALS',value:0}]]);let serial=0;
  const settings={host,getCurrent:field=>current.get(field),normalize:normalizeTableHeaderFilter,onCommit:(descriptor,operator,value)=>{commits.push({field:descriptor.field,operator,value});if(operator===null)current.delete(descriptor.field);else current.set(descriptor.field,{operator,value});},schedule:fn=>{timers.set(++serial,fn);return serial;},cancel:id=>timers.delete(id)},flush=()=>{const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());};
  let editor=mountEquityHeaderFilter({...settings,fields:equityPrintColumnFields('price')});const find=label=>walk(host).find(node=>node.attributes?.['aria-label']===label);
  assert.equal(find('Price value').value,'0');find('Price value').value='123';find('Price value').emit('input');find('Field').emit('click');walk(host).find(node=>node.dataset?.value==='tradeSide').emit('click');flush();assert.equal(commits.length,0,'changing Field cancels a draft for the old field');
  const side=find('Trade side value');for(const value of ['ASK','ABOVE_ASK']){const checkbox=walk(side).find(node=>node.type==='checkbox'&&node.value===value);checkbox.checked=true;checkbox.emit('change');}flush();assert.deepEqual(commits.at(-1),{field:'TRADE_SIDE',operator:'EQUALS',value:['ASK','ABOVE_ASK']});assert.equal(current.get('PRICE').value,0);
  find('Field').emit('click');walk(host).find(node=>node.dataset?.value==='price').emit('click');assert.equal(find('Price value').value,'0');find('Price value').value='';find('Price value').emit('input');flush();assert.equal(current.has('PRICE'),false);assert.equal(current.has('TRADE_SIDE'),true);editor.destroy();
  host.replaceChildren();editor=mountEquityHeaderFilter({...settings,fields:[equityPrintField('IS_DELAYED_PRINT')]});find('Phantom Prints value').children[0].emit('click');walk(host).find(node=>node.dataset?.value==='false').emit('click');flush();assert.deepEqual(commits.at(-1),{field:'IS_DELAYED_PRINT',operator:'EQUALS',value:false});editor.destroy();assert.equal(timers.size,0);
});

test('notification Type editor renders exactly is/is not, raw codes and the shared selected enum values',()=>{
  const {doc}=fixture(),host=new Element(doc),commits=[],timers=new Map();let serial=0;
  const editor=mountEquityHeaderFilter({host,fields:notificationColumnFields('type'),getCurrent:()=>({operator:'EQUALS',value:['LUDP']}),normalize:normalizeTableHeaderFilter,onCommit:(field,operator,value)=>commits.push({field:field.field,operator,value}),schedule:fn=>{timers.set(++serial,fn);return serial;},cancel:id=>timers.delete(id)});
  const find=label=>walk(host).find(node=>node.attributes?.['aria-label']===label),operators=walk(host).filter(node=>node.attributes?.role==='option');assert.deepEqual(operators.map(node=>node.textContent),['is','is not']);
  assert.equal(find('Field').value,'Type');assert.equal(find('Field').readOnly,true);
  const values=find('Type value'),reg=walk(values).find(node=>node.type==='checkbox'&&node.value==='REG_SHO');assert.ok(walk(values).some(node=>node.textContent==='REG_SHO'));assert.equal(walk(values).find(node=>node.type==='checkbox'&&node.value==='LUDP').checked,true);
  reg.checked=true;reg.emit('change');operators[1].emit('click');const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());
  assert.deepEqual(commits.at(-1),{field:'TYPE',operator:'DOES_NOT_EQUAL',value:['LUDP','REG_SHO']});editor.destroy();assert.equal(timers.size,0);
});

test('Equity single-field label activates a public sort immediately, previews existing rows and never opens a menu',()=>{
  const {view,table,doc}=fixture(),sorts=[];
  view.setRows([{ticker:'OLD',size:12},{ticker:'PAGE',size:2}],{toolId:'equity-prints',columns:equityColumns,headerMenu:true,onSortChange:update=>sorts.push(update),sortKey:'TRADE_TIME',sortDirection:-1});
  const quantity=()=>walk(table.tHead).find(node=>node.className==='qtable-sort'&&node.textContent.startsWith('Quantity'));
  assert.equal(quantity().textContent,'Quantity');assert.equal(quantity().attributes['aria-haspopup'],undefined);
  quantity().emit('click');assert.deepEqual(sorts.at(-1),{id:'size',key:'size',field:'SIZE',direction:-1});assert.equal(doc.body.children.length,0);assert.equal(quantity().textContent,'Quantity ↓');
  quantity().emit('click');assert.equal(sorts.at(-1).direction,1);assert.equal(doc.body.children.length,0);assert.equal(quantity().textContent,'Quantity ↑');assert.deepEqual(view.getVisibleRows().map(row=>row.size),[2,12]);assert.deepEqual(table.body.children.map(row=>row.children.find(cell=>cell.dataset.columnId==='size')?.children[0]?.children.at(-1)?.textContent),['2','12']);
  quantity().emit('click');assert.equal(sorts.at(-1).direction,-1);assert.equal(quantity().textContent,'Quantity ↓');assert.equal(doc.body.children.length,0);assert.deepEqual(table.body.children.map(row=>row.children.find(cell=>cell.dataset.columnId==='size')?.children[0]?.children.at(-1)?.textContent),['12','2']);
  view.setRows([{ticker:'BRK',size:1},{ticker:'ASML',size:3}],{toolId:'equity-prints',columns:equityColumns,headerMenu:true,onSortChange:update=>sorts.push(update),sortKey:'SIZE',sortId:'size',sortDirection:1});assert.equal(quantity().textContent,'Quantity ↑');assert.deepEqual(view.getVisibleRows().map(row=>row.ticker),['BRK','ASML']);
  view.destroy();
});

test('Equity Ticker retains exactly two radio sort groups and inactive Unsorted cannot clear another field',()=>{
  const {view,table,doc}=fixture(),sorts=[];view.setRows([],{toolId:'equity-prints',columns:equityColumns,headerMenu:true,onSortChange:update=>sorts.push(update),sortKey:'TRADE_TIME',sortDirection:-1});
  const ticker=()=>walk(table.tHead).find(node=>node.className==='qtable-sort'&&node.textContent.startsWith('Ticker'));
  ticker().emit('click');assert.equal(sorts.length,0);
  assert.equal(walk(doc.body).filter(node=>node.attributes.role==='radiogroup').length,2);assert.equal(walk(doc.body).filter(node=>node.attributes.role==='radio').length,6);
  const radio=label=>walk(doc.body).find(node=>node.attributes['aria-label']===label);
  assert.equal(radio('Ticker: Unsorted').attributes['aria-checked'],'true');assert.equal(radio('Type: Unsorted').attributes['aria-checked'],'true');radio('Type: Ascending').emit('click');assert.deepEqual(sorts.at(-1),{id:'ticker',key:'printType',field:'PRINT_TYPE',direction:1});
  ticker().emit('click');assert.equal(radio('Type: Ascending').attributes['aria-checked'],'true');assert.equal(radio('Ticker: Unsorted').attributes['aria-checked'],'true');radio('Ticker: Unsorted').emit('click');assert.equal(sorts.length,1);assert.equal(view.getSort().field,'PRINT_TYPE');
  ticker().emit('click');radio('Type: Unsorted').emit('click');assert.equal(sorts.at(-1).direction,null);view.destroy();
});

test('native shared-field Equity Date and Time markers follow the same canonical sort through clicks and reset',()=>{
  const {view,table}=fixture(),sorts=[],config={toolId:'equity-prints',columns:equityColumns,headerMenu:true,onSortChange:update=>sorts.push(update),sortKey:'TRADE_TIME',sortId:'tradeTime',sortDirection:-1};
  const header=id=>table.tHead.children[0].children.find(node=>node.dataset.columnId===id),label=id=>header(id).children.find(node=>node.className==='qtable-sort');
  const assertShared=(direction,marker)=>{for(const [id,text]of [['date','Date'],['tradeTime','Time']]){assert.equal(header(id).attributes['aria-sort'],direction);assert.equal(label(id).textContent,`${text} ${marker}`);}};
  view.setRows([],config);assertShared('descending','↓');
  label('date').emit('click');assert.deepEqual(sorts.at(-1),{id:'date',key:'tradeTime',field:'TRADE_TIME',direction:1});assertShared('ascending','↑');
  label('tradeTime').emit('click');assert.equal(sorts.at(-1).direction,-1);assertShared('descending','↓');
  view.setRows([],{...config,sortId:'date',sortKey:'trade_time',sortDirection:1});assertShared('ascending','↑');
  view.setAtomicSort('size','SIZE',-1);assert.equal(header('date').attributes['aria-sort'],'none');assert.equal(header('tradeTime').attributes['aria-sort'],'none');assert.equal(label('date').textContent,'Date');assert.equal(label('tradeTime').textContent,'Time');
  view.setRows([],config);assertShared('descending','↓');assert.equal(header('ticker').attributes['aria-sort'],'none');assert.equal(header('size').attributes['aria-sort'],'none');view.destroy();
});

test('real consolidated and unconsolidated definitions retain different source time precision and fixed Spot cents',()=>{
  const epoch=Date.parse('2026-10-16T21:22:31.257Z');
  const consolidated=CONSOLIDATED_COLUMNS.find(column=>column.id==='time'),individual=UNCONSOLIDATED_COLUMNS.find(column=>column.id==='time');
  assert.equal(formatTableValue(epoch,consolidated,{}, {timeZone:'Australia/Brisbane'}),'7:22:31 AM');
  assert.equal(formatTableValue(epoch,individual,{}, {timeZone:'Australia/Brisbane'}),'7:22:31.257 AM');
  assert.equal(consolidated.width,110);assert.equal(individual.width,140);
  assert.equal(formatTableValue(718,CONSOLIDATED_COLUMNS.find(column=>column.key==='stockPrice')),'$718.00');
  assert.equal(formatTableValue(718,{key:'strikePrice',type:'money'}),'$718');
});

test('opt-in actual header menu sends one atomic public sort and resets only an active sort',()=>{
  const {view,table,doc}=fixture(),sorts=[];
  view.setRows([{ticker:'ZZZ'},{ticker:'AAA'}],{toolId:'tape',columns:[contract],headerMenu:true,onSortChange:update=>sorts.push(update),sortKey:'EXPIRATION_DATE',sortDirection:-1});
  const trigger=walk(table.tHead).find(node=>node.attributes['aria-haspopup']==='dialog');trigger.emit('click');
  const choose=label=>walk(doc.body).find(node=>node.attributes['aria-label']===label);
  assert.ok(choose('Ticker: Ascending'));assert.ok(choose('Expiration: Descending'));assert.ok(choose('Strike Price: Unsorted'));assert.ok(choose('Contract Type: Ascending'));
  choose('Ticker: Ascending').emit('click');
  assert.deepEqual(sorts.at(-1),{id:'contract',key:'ticker',field:'TICKER',direction:1});assert.equal(view.getSort().field,'TICKER');
  assert.deepEqual(view.getVisibleRows().map(row=>row.ticker),['ZZZ','AAA'],'server-ranked rows cannot be reordered locally');
  view.setAtomicSort('contract','expirationDate',null);assert.equal(sorts.length,1,'inactive Unsorted must not clear another field');
  view.setAtomicSort('contract','ticker',null);assert.equal(sorts.at(-1).direction,null);assert.equal(doc.body.children.length,0);view.destroy();
});

test('actual server-filter form validates typed values, reports errors, clears and does not filter a loaded subset',()=>{
  const {view,table,doc}=fixture(),filters=[];
  view.setRows([{ticker:'AAA',strikePrice:700},{ticker:'BBB',strikePrice:800}],{toolId:'tape',columns:[contract],headerMenu:true,onFilterChange:update=>filters.push(update)});
  assert.equal(table.tHead.children.length,1,'opt-in tape has only the native header row');
  assert.equal(walk(table.tHead).some(node=>node.className==='qtable-column-filter'),false);
  walk(table.tHead).find(node=>node.attributes['aria-haspopup']==='dialog').emit('click');
  const form=walk(doc.body).find(node=>node.tagName==='form'),input=walk(form).find(node=>node.attributes['aria-label']==='Strike Price value'),select=walk(form).find(node=>node.attributes['aria-label']==='Strike Price operator');
  select.value='GREATER_THAN_OR_EQUAL_TO';input.value='invalid';form.emit('submit');assert.equal(filters.length,0);assert.match(walk(form).find(node=>node.attributes.role==='alert').textContent,/finite/);
  input.value='750';form.emit('submit');assert.deepEqual(filters.at(-1),{id:'contract',key:'strikePrice',field:'STRIKE_PRICE',operator:'GREATER_THAN_OR_EQUAL_TO',value:750});
  assert.equal(view.getVisibleRows().length,2);
  view.setHeaderFilter('contract','strikePrice',null);assert.equal(filters.at(-1).operator,null);view.destroy();
});

test('typed header filters reject unsupported Contains, invalid dates, unzoned instants and untrusted objects',()=>{
  assert.throws(()=>normalizeTableHeaderFilter(field,'CONTAINS','700'),/operator/);
  assert.throws(()=>normalizeTableHeaderFilter(field,'EQUALS',{}),/scalar/);
  assert.equal(normalizeTableHeaderFilter(field,'EQUALS','1,250.5').value,1250.5);
  const date={key:'expiry',field:'EXPIRATION_DATE',type:'date',operators:['EQUALS']};
  assert.throws(()=>normalizeTableHeaderFilter(date,'EQUALS','2026-02-30'),/calendar/);assert.equal(normalizeTableHeaderFilter(date,'EQUALS','2026-02-28').value,'2026-02-28');
  const time={key:'tradeTime',field:'TRADE_TIME',type:'datetime',operators:['EQUALS']};
  assert.throws(()=>normalizeTableHeaderFilter(time,'EQUALS','2026-10-16T09:30:00'),/timezone/);assert.equal(normalizeTableHeaderFilter(time,'EQUALS','2026-10-16T13:30:00Z').value,Date.parse('2026-10-16T13:30:00Z'));
  assert.deepEqual(normalizeTableHeaderFilter({...field,type:'enum',choices:['CALL','PUT']},'EQUALS',['CALL','PUT']).value,['CALL','PUT']);
});

test('menu cleanup removes all document/window listeners on destroy and old tables retain local sorting',()=>{
  const {view,table,doc}=fixture();view.setRows([],{columns:[contract],toolId:'tape',headerMenu:true,onSortChange(){}});
  walk(table.tHead).find(node=>node.attributes['aria-haspopup']==='dialog').emit('click');assert.equal(doc.body.children.length,1);view.destroy();
  assert.equal(doc.body.children.length,0);assert.equal([...doc.events.values()].reduce((n,set)=>n+set.size,0),0);assert.equal([...doc.defaultView.events.values()].reduce((n,set)=>n+set.size,0),0);
  const ordinary=fixture();ordinary.view.setRows([{name:'BBB'},{name:'AAA'}],{columns:[{key:'name',label:'Name'}],toolId:'ordinary'});
  assert.equal(ordinary.table.tHead.children.length,2,'ordinary tables retain the filter row');
  walk(ordinary.table.tHead).find(node=>node.className==='qtable-sort').emit('click');assert.equal(ordinary.doc.body.children.length,0);assert.equal(ordinary.view.getVisibleRows()[0].name,'BBB');ordinary.view.destroy();
});

test('option tapes use native price-side, bid-ask and moneyness punctuation without changing other tables',()=>{
  const row={tradeSideCode:'ASK',bidPrice:1.61,askPrice:1.62,moneyness:{moneyType:'OUT_OF_THE_MONEY',degree:3.25,degreeInPercent:0.43}};
  for(const columns of [CONSOLIDATED_COLUMNS,UNCONSOLIDATED_COLUMNS]){
    assert.equal(formatTableValue(1.62,columns.find(column=>column.key==='optionPrice'),row),'$1.62 A');
    assert.equal(formatTableValue(null,columns.find(column=>column.key==='bidAskSpread'),row),'$1.61 x $1.62');
    assert.equal(formatTableValue(null,columns.find(column=>column.key==='moneyness'),row),'OTM by $3.25 0.43%');
  }
  assert.equal(formatTableValue(1.62,{type:'priceSide'},row),'$1.62 · A');
  assert.equal(formatTableValue(null,{type:'bidAsk'},row),'$1.61 × $1.62');
  assert.equal(formatTableValue(null,{type:'moneyness'},row),'OTM by $3.25 (0.43%)');
});

test('shared TRADE_TIME sorts default to Time and preserve explicitly clicked Date or Time across responses',()=>{
  const {view,table}=fixture(),columns=CONSOLIDATED_COLUMNS.filter(column=>['date','time'].includes(column.id)).map(column=>({...column,sortField:'TRADE_TIME'}));
  const config={toolId:'tape',columns,headerMenu:true,onSortChange(){},sortKey:'TRADE_TIME',sortDirection:-1};
  view.setRows([],config);assert.equal(view.getSort().id,'time');assert.equal(table.tHead.children[0].children.find(header=>header.dataset.columnId==='date').attributes['aria-sort'],'none');assert.equal(table.tHead.children[0].children.find(header=>header.dataset.columnId==='time').attributes['aria-sort'],'descending');
  view.setAtomicSort('date','TRADE_TIME',1);view.setRows([],{...config,sortDirection:1});assert.equal(view.getSort().id,'date');
  view.setRows([],{...config,sortId:'time'});assert.equal(view.getSort().id,'time');
  view.setRows([],{...config,toolId:'anotherTape',sortId:'date'});assert.equal(view.getSort().id,'date');view.destroy();
});

test('tape sort label and funnel open separate menus and active filters keep a visible marker',()=>{
  const {view,table,doc}=fixture(),configuration={toolId:'tape',columns:[contract],headerMenu:true,onSortChange(){},onFilterChange(){}};
  view.setRows([],configuration);
  const filterButton=()=>walk(table.tHead).find(node=>node.attributes['aria-label']==='Filter Contract');
  walk(table.tHead).find(node=>node.className==='qtable-sort').emit('click');
  assert.ok(walk(doc.body).some(node=>node.attributes['aria-label']==='Ticker: Ascending'));
  assert.equal(walk(doc.body).some(node=>node.tagName==='form'),false);
  filterButton().emit('click');assert.ok(walk(doc.body).some(node=>node.tagName==='form'));
  assert.equal(walk(doc.body).some(node=>node.attributes['aria-label']==='Ticker: Ascending'),false);
  assert.equal(filterButton().attributes['aria-pressed'],'false');
  view.setHeaderFilter('contract','strikePrice','EQUALS',750);assert.equal(filterButton().attributes['aria-pressed'],'true');assert.match(filterButton().className,/is-active/);
  view.setRows([],{...configuration,headerFilters:[{field:'STRIKE_PRICE',key:'strikePrice',operator:'EQUALS',value:750}]});assert.equal(filterButton().attributes['aria-pressed'],'true');
  view.setHeaderFilter('contract','strikePrice',null);assert.equal(filterButton().attributes['aria-pressed'],'false');view.destroy();
});

test('IV accepts percent-point text without rescaling while sigma and other numeric fields reject percent notation',()=>{
  const numeric={type:'number',operators:['EQUALS']};
  assert.equal(normalizeTableHeaderFilter({...numeric,key:'impliedVolatility',field:'IMPLIED_VOLATILITY'},'EQUALS','20%').value,20);
  assert.equal(normalizeTableHeaderFilter({...numeric,key:'impliedVolatility',field:'IMPLIED_VOLATILITY'},'EQUALS','20 %').value,20);
  for(const field of ['SIGMA','DELTA','SIZE'])assert.throws(()=>normalizeTableHeaderFilter({...numeric,key:field,field},'EQUALS','20%'),/finite/);
  assert.equal(normalizeTableHeaderFilter({...numeric,key:'greeks.sigma',field:'SIGMA'},'EQUALS','0.2').value,0.2);
  assert.throws(()=>normalizeTableHeaderFilter({...numeric,key:'impliedVolatility',field:'IMPLIED_VOLATILITY'},'EQUALS','%'),/finite/);
});

test('Expiration uses a themed date-only calendar, retains nested clicks and scroll, and waits for Apply',()=>{
  const {view,table,doc}=fixture(),updates=[],expiry={key:'expirationDate',field:'EXPIRATION_DATE',label:'Expiration',type:'date',operators:['EQUALS','GREATER_THAN_OR_EQUAL_TO']};
  view.setRows([],{toolId:'tape',columns:[{...contract,filterFields:[expiry]}],headerMenu:true,onFilterChange:update=>updates.push(update),headerFilters:[{...expiry,operator:'EQUALS',value:'2026-10-16'}]});
  walk(table.tHead).find(node=>node.attributes['aria-label']==='Filter Contract').emit('click');
  const form=walk(doc.body).find(node=>node.tagName==='form'),input=walk(form).find(node=>node.attributes['aria-label']==='Expiration value');
  assert.equal(input.type,'text');assert.equal(input.readOnly,true);
  walk(form).find(node=>node.attributes['aria-label']==='Choose Expiration date').emit('click');
  const calendar=walk(form).find(node=>node.className==='qtable-header-calendar');assert.equal(calendar.hidden,false);
  walk(calendar).find(node=>node.attributes['aria-label']==='Next month').emit('click');assert.ok(walk(calendar).some(node=>node.dataset.date==='2026-11-19'));
  walk(calendar).find(node=>node.attributes['aria-label']==='Previous month').emit('click');
  const day=walk(calendar).find(node=>node.dataset.date==='2026-10-19');assert.ok(day);
  doc.emit('pointerdown',{target:day});doc.emit('scroll',{target:calendar});assert.equal(doc.body.children.length,1);
  day.emit('click');assert.equal(input.value,'2026-10-19');assert.equal(calendar.hidden,true);assert.equal(updates.length,0,'calendar drafts never request data');
  form.emit('submit');assert.deepEqual(updates,[{id:'contract',key:'expirationDate',field:'EXPIRATION_DATE',operator:'EQUALS',value:'2026-10-19'}]);assert.equal(doc.body.children.length,0);view.destroy();
});

test('header enums reuse the searchable themed multi dropdown and preserve both wire values until explicit Apply',()=>{
  const {view,table,doc}=fixture(),updates=[],enumField={key:'contractType',field:'CONTRACT_TYPE',label:'Contract Type',type:'enum',choices:['CALL','PUT'],operators:['EQUALS','DOES_NOT_EQUAL']};
  const configuration={toolId:'tape',columns:[{...contract,filterFields:[enumField]}],headerMenu:true,onFilterChange:update=>updates.push(update)};
  view.setRows([],configuration);walk(table.tHead).find(node=>node.attributes['aria-label']==='Filter Contract').emit('click');
  const form=walk(doc.body).find(node=>node.tagName==='form'),picker=walk(form).find(node=>node.tagName==='details');assert.ok(picker);assert.equal(picker.className,'choice-dropdown');
  assert.equal(walk(form).some(node=>node.tagName==='select'&&node.multiple),false,'no OS multi-select list');
  picker.open=true;picker.emit('toggle');
  const selectValue=value=>{const checkbox=walk(picker).find(node=>node.type==='checkbox'&&node.value===value);checkbox.checked=true;checkbox.emit('change');};
  selectValue('CALL');selectValue('PUT');assert.equal(picker.value,'CALL, PUT');assert.equal(updates.length,0);
  const search=walk(picker).find(node=>node.type==='search');search.value='put';search.emit('input');
  assert.equal(walk(picker).filter(node=>node.type==='checkbox').length,1);assert.equal(picker.value,'CALL, PUT','search must retain hidden selected CALL');
  const put=walk(picker).find(node=>node.type==='checkbox');assert.equal(put.checked,true);
  doc.emit('pointerdown',{target:put});doc.emit('scroll',{target:picker.children[1]});assert.equal(doc.body.children.length,1);assert.equal(picker.open,true);assert.equal(updates.length,0);
  walk(form).find(node=>node.attributes['aria-label']==='Contract Type operator').value='DOES_NOT_EQUAL';form.emit('submit');
  assert.deepEqual(updates,[{id:'contract',key:'contractType',field:'CONTRACT_TYPE',operator:'DOES_NOT_EQUAL',value:['CALL','PUT']}]);assert.equal(doc.body.children.length,0);assert.equal(picker.open,false);
  view.setRows([],{...configuration,headerFilters:[{key:'contractType',field:'CONTRACT_TYPE',operator:'EQUALS',value:['PUT']}]});walk(table.tHead).find(node=>node.attributes['aria-label']==='Filter Contract').emit('click');
  const restored=walk(doc.body).find(node=>node.tagName==='details');assert.equal(restored.value,'PUT');restored.open=true;restored.emit('toggle');doc.emit('pointerdown',{target:doc.body});assert.equal(doc.body.children.length,0);assert.equal(restored.open,false);view.destroy();
});
