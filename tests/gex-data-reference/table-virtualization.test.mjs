import test from 'node:test';
import assert from 'node:assert/strict';
import {createTableView} from '../../public/gex-data-app/table-view.js';

class Node extends EventTarget {
  constructor(tag,doc){super();this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.parentNode=null;this.dataset={};this.style={};this.attributes={};this.className='';this._text='';this.scrollTop=0;this.clientHeight=0;this.clientTop=0;this.classList={add:(...values)=>{this.className=[...new Set([...this.className.split(' '),...values])].filter(Boolean).join(' ');},contains:value=>this.className.split(' ').includes(value)};}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set textContent(value){this.children=[];this._text=String(value);}
  get nextElementSibling(){return this.parentNode?.children[this.parentNode.children.indexOf(this)+1]??null;}
  append(...nodes){for(const node of nodes){node.remove?.();node.parentNode=this;this.children.push(node);}}
  insertBefore(node,before){node.remove();node.parentNode=this;this.children.splice(before?this.children.indexOf(before):this.children.length,0,node);}
  replaceChildren(...nodes){for(const node of this.children)node.parentNode=null;this.children=[];this._text='';this.append(...nodes);}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;}}
  setAttribute(key,value){this.attributes[key]=String(value);}
  querySelectorAll(selector){if(selector==='tr:first-child th')return this.children[0]?.children.filter(child=>child.tagName==='TH')??[];return [];}
  closest(selector){if(selector==='.table-scroll'&&this.classList.contains('table-scroll'))return this;return this.parentNode?.closest(selector)??null;}
  getBoundingClientRect(){const scroller=this.closest('.table-scroll'),header=this.tagName==='THEAD'?this:scroller?.children.find(child=>child.tagName==='TABLE')?.tHead,headerHeight=(header?.children.length||2)*28,height=this.tagName==='THEAD'?headerHeight:this.tagName==='TBODY'?this.children.reduce((sum,node)=>sum+node.getBoundingClientRect().height,0):this.tagName==='TR'?(Number.parseFloat(this.style.height)||28):this.clientHeight;return {top:this.tagName==='TBODY'?headerHeight-(scroller?.scrollTop||0):0,height,width:1000};}
  get scrollHeight(){const table=this.children.find(child=>child.tagName==='TABLE');return table?table.tHead.getBoundingClientRect().height+table.tBodies[0].getBoundingClientRect().height+table.tFoot.children.length*28:0;}
}
function fixture({layout=true,raf=false,...options}={}){
  const window=new EventTarget(),observers=[],frames=new Map();let frameId=0,cancelled=0;
  window.ResizeObserver=class{constructor(callback){this.callback=callback;this.targets=[];this.disconnected=false;observers.push(this);}observe(node){this.targets.push(node);}disconnect(){this.disconnected=true;}};
  if(raf){window.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId;};window.cancelAnimationFrame=id=>{cancelled++;frames.delete(id);};}
  const doc={defaultView:window,createElement:tag=>new Node(tag,doc),createTextNode:text=>{const node=new Node('#text',doc);node.textContent=text;return node;},addEventListener(){},removeEventListener(){}};
  const scroller=new Node('div',doc);scroller.className='table-scroll';scroller.clientHeight=layout?280:0;
  const table=new Node('table',doc);table.tHead=new Node('thead',doc);table.tBodies=[new Node('tbody',doc)];table.tFoot=new Node('tfoot',doc);table.append(table.tHead,table.tBodies[0],table.tFoot);scroller.append(table);
  const count=new Node('span',doc),search=new Node('input',doc);search.value='';
  const view=createTableView({table,count,search,...options});
  return {view,table,tbody:table.tBodies[0],scroller,count,search,doc,observers,frames,get cancelled(){return cancelled;},flush(){for(const [id,fn]of [...frames]){frames.delete(id);fn();}},scroll(value){scroller.scrollTop=value;scroller.dispatchEvent(new Event('scroll'));}};
}
const columns=[{key:'rank',label:'Rank',type:'integer',width:70},{key:'ticker',label:'Ticker',type:'text',width:120},{key:'value',label:'Value',type:'integer',width:150,bar:'primary',fractionField:'fraction'},{key:'side',label:'Side',type:'text',width:90}];
const records=length=>Array.from({length},(_,value)=>({ticker:`T${value}`,value,fraction:value/length,side:value%2?'PUT':'CALL'}));
const rendered=tbody=>tbody.children.filter(node=>node.dataset.rowIndex!==undefined);

test('actual virtual table dispatches opt-in scroll paging once and removes it on tool change/destroy',async()=>{
  const h=fixture(),calls=[],state={enabled:true,scope:'equity-selection',cursor:['opaque',0],busy:false};
  h.view.setRows(records(100),{columns,toolId:'equity-prints',autoPaging:{getState:()=>state,onNext:()=>{calls.push(state.cursor);}}});
  h.scroll(h.scroller.scrollHeight-h.scroller.clientHeight-30);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,1);assert.equal(calls[0],state.cursor);
  h.scroll(h.scroller.scrollHeight-h.scroller.clientHeight);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,1);
  h.view.setRows(records(200),{columns,toolId:'ordinary'});state.cursor=['new'];h.scroll(h.scroller.scrollHeight-h.scroller.clientHeight);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,1);
  h.view.destroy();h.scroll(h.scroller.scrollHeight);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,1);
});

test('detail table can omit inline filters while real header clicks sort and every virtualized row stays reachable',()=>{
  const h=fixture({inlineFilters:false}),rows=records(5000);h.view.setRows(rows,{columns,toolId:'heat-cell-detail',sortKey:'value',sortDirection:1});
  assert.equal(h.table.tHead.children.length,1);assert.equal(h.table.tHead.getBoundingClientRect().height,28);assert.ok(rendered(h.tbody).length<60);
  const valueHeader=h.table.tHead.children[0].children.find(node=>node.dataset.columnId==='value'),button=valueHeader.children.find(node=>node.className==='qtable-sort');button.dispatchEvent(new Event('click'));
  assert.equal(h.view.getSort().direction,-1);assert.equal(h.view.getVisibleRows()[0].value,4999);assert.equal(h.table.tHead.children.length,1);
  h.scroll(h.scroller.scrollHeight-h.scroller.clientHeight);assert.ok(rendered(h.tbody).some(node=>node.dataset.rowIndex==='4999'));assert.ok(rendered(h.tbody).length<60);h.view.destroy();
  const ordinary=fixture();ordinary.view.setRows(rows,{columns,toolId:'ordinary'});assert.equal(ordinary.table.tHead.children.length,2);
  ordinary.view.setRows(rows,{columns,toolId:'ordinary',inlineFilters:false});assert.equal(ordinary.table.tHead.children.length,1);
  ordinary.view.setRows(rows,{columns,toolId:'another-tool'});assert.equal(ordinary.table.tHead.children.length,2,'per-tool override cannot leak');ordinary.view.destroy();
});

test('10000 records stay sortable and reachable through a bounded actual table viewport and full-height spacers',()=>{
  const h=fixture(),rows=records(10000);h.view.setRows(rows,{columns,toolId:'tape',sortKey:'value',sortDirection:1,totalRow:{group:'TOTAL',ticker:'TOTAL',value:49995000}});
  assert.equal(h.view.getVisibleRows().length,10000);assert.match(h.count.textContent,/10,000 loaded rows/);assert.ok(rendered(h.tbody).length<60);assert.ok(h.tbody.children.some(node=>node.dataset.spacer==='bottom'));
  assert.match(h.table.tFoot.textContent,/49,995,000/);assert.equal(h.table.style.width,'430px');
  h.scroll(h.scroller.scrollHeight-h.scroller.clientHeight);
  const last=rendered(h.tbody).at(-1);assert.equal(last.dataset.rowIndex,'9999');assert.match(last.textContent,/T9999/);assert.equal(last.children[0].textContent,'10,000');assert.equal(last.children[2].children[0].style.width,'99.99%');assert.ok(rendered(h.tbody).length<60);assert.match(h.table.tFoot.textContent,/49,995,000/);
  assert.equal(h.table.attributes['aria-rowcount'],'10003');assert.equal(last.attributes['aria-rowindex'],'10002');
  h.view.destroy();
});
test('filters/search operate on all source records beyond750, while global ranks and manual sort survive refresh',()=>{
  const h=fixture(),rows=records(1200),put=()=>h.view.setRows(rows,{columns,toolId:'levels',sortKey:'value',sortDirection:1});put();
  h.view.setFilter('value','>=1190');assert.deepEqual(h.view.getVisibleRows().map(row=>row.value),Array.from({length:10},(_,i)=>1190+i));assert.equal(rendered(h.tbody).length,10);assert.match(h.count.textContent,/10 loaded rows/);
  h.view.setSort('ticker',-1);const expected=h.view.getVisibleRows().map(row=>row.ticker);put();assert.deepEqual(h.view.getVisibleRows().map(row=>row.ticker),expected);
  h.view.setFilter('value','');h.search.value='T1199';h.search.dispatchEvent(new Event('input'));assert.equal(h.view.getVisibleRows()[0].value,1199);assert.equal(rendered(h.tbody).length,1);
  h.view.setVisible('side',false);h.view.reorder('value','rank');assert.equal(h.view.getColumns()[0].key,'value');assert.equal(rendered(h.tbody)[0].children.length,3);h.view.destroy();
});
test('small and layout-less tables retain all matching rows with no silent cap',()=>{
  for(const [layout,length]of [[true,100],[false,1001]]){const h=fixture({layout});h.view.setRows(records(length),{columns,toolId:'fallback'});assert.equal(rendered(h.tbody).length,length);assert.ok(!h.tbody.children.some(node=>node.dataset.spacer));h.view.destroy();}
});
test('row clicks, keyboard activation and an expanded detail row remain attached while scrolling within its viewport',()=>{
  let clicks=0;const h=fixture({onRowClick:(row,event)=>{clicks++;assert.equal(row.value,2);const tr=event.currentTarget,next=tr.nextElementSibling;if(next?.classList.contains('detail-row'))next.remove();else{const detail=h.doc.createElement('tr');detail.className='detail-row';detail.style.height='600px';detail.textContent='Actual row details';tr.parentNode.insertBefore(detail,next);}}});
  h.view.setRows(records(1000),{columns,sortKey:'value',sortDirection:1,toolId:'clicks'});const row=rendered(h.tbody).find(node=>node.dataset.rowIndex==='2');row.dispatchEvent(new Event('click'));assert.equal(clicks,1);assert.equal(row.nextElementSibling.textContent,'Actual row details');
  h.scroll(250);assert.equal(rendered(h.tbody).find(node=>node.dataset.rowIndex==='2'),row);assert.equal(row.nextElementSibling.textContent,'Actual row details');
  const enter=new Event('keydown');Object.defineProperty(enter,'key',{value:'Enter'});row.dispatchEvent(enter);assert.equal(clicks,2);assert.notEqual(row.nextElementSibling?.textContent,'Actual row details');h.view.destroy();
});
test('scroll work coalesces, resize updates the viewport, and destroying releases every observer/frame/listener',()=>{
  const h=fixture({raf:true});h.view.setRows(records(10000),{columns,toolId:'cleanup'});
  h.scroll(50000);h.scroll(60000);assert.equal(h.frames.size,1);h.flush();const before=rendered(h.tbody).map(node=>node.dataset.rowIndex);
  h.scroller.clientHeight=560;h.observers[0].callback();assert.equal(h.frames.size,1);h.flush();assert.ok(rendered(h.tbody).length>before.length);
  h.scroller.clientHeight=0;h.observers[0].callback();h.flush();assert.ok(rendered(h.tbody).length<100,'hiding a previously measured live pane cannot materialize10000rows');
  h.scroll(70000);assert.equal(h.frames.size,1);h.view.destroy();assert.equal(h.frames.size,0);assert.equal(h.cancelled,1);assert.ok(h.observers.every(observer=>observer.disconnected));h.scroll(80000);assert.equal(h.frames.size,0);
});

test('external header sorting reports the licensed sort field without reordering the old server page',()=>{
  const calls=[],h=fixture({onSortChange:change=>calls.push(change)}),schema=columns.map(column=>column.key==='value'?{...column,sortField:'CHANGE_IN_OPEN_INTEREST'}:column);
  const rows=[{ticker:'A',value:1000},{ticker:'B',value:500},{ticker:'C',value:10}];
  h.view.setRows(rows,{columns:schema,toolId:'open-interest-change',sortKey:'CHANGE_IN_OPEN_INTEREST',sortDirection:-1});
  const originalNodes=[...rendered(h.tbody)];h.view.setSort('value',1);
  assert.deepEqual(calls,[{id:'value',key:'CHANGE_IN_OPEN_INTEREST',field:'CHANGE_IN_OPEN_INTEREST',direction:1}]);
  assert.deepEqual(h.view.getVisibleRows(),rows);assert.deepEqual(rendered(h.tbody),originalNodes,'a pending server sort must not reshuffle the previous subset');
  assert.equal(h.table.tHead.children[0].children.find(node=>node.dataset.columnId==='value').attributes['aria-sort'],'ascending');
  assert.deepEqual(h.view.getSort(),{id:'value',key:'CHANGE_IN_OPEN_INTEREST',field:'CHANGE_IN_OPEN_INTEREST',direction:1,external:true});
  h.view.setRows([{ticker:'X',value:1},{ticker:'Y',value:2}],{columns:schema,toolId:'open-interest-change',sortKey:'changeInOpenInterest',sortDirection:1});
  assert.deepEqual(h.view.getVisibleRows().map(row=>row.value),[1,2]);assert.equal(h.view.getSort().direction,1);assert.equal(calls.length,1,'source refresh is not a new user sort');h.view.destroy();
});

test('external sort configuration survives same-field direction changes and cannot leak to another tool',()=>{
  const calls=[],h=fixture(),rows=[{ticker:'B',value:2},{ticker:'A',value:1},{ticker:'C',value:3}];
  h.view.setRows(rows,{columns,toolId:'open-interest-change',sortKey:'value',sortDirection:-1,onSortChange:change=>calls.push(change)});
  h.view.setSort('ticker',1);assert.equal(calls[0].field,'ticker');assert.deepEqual(h.view.getVisibleRows(),rows);
  h.view.setRows(rows,{columns,toolId:'open-interest-change',sortKey:'ticker',sortDirection:-1});assert.equal(h.view.getSort().direction,-1);assert.equal(h.view.getSort().external,true);
  h.view.setRows(rows,{columns,toolId:'ordinary-table',sortKey:'value',sortDirection:-1});assert.equal(h.view.getSort().external,false);assert.deepEqual(h.view.getVisibleRows().map(row=>row.value),[3,2,1]);
  h.view.setSort('value',1);assert.deepEqual(h.view.getVisibleRows().map(row=>row.value),[1,2,3]);assert.equal(calls.length,1);h.view.destroy();
});
