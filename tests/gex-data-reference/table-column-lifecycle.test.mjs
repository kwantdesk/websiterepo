import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {claimMenu,releaseMenu} from '../../public/gex-data-app/menu-coordination.js';
import { createTableView } from '../../public/gex-data-app/table-view.js';
import {prepareDarkPoolLevels,DARK_POOL_LEVEL_COLUMNS} from '../../public/gex-data-app/equity-renderers.js';
import {GAINERS_COLUMNS,gainersModel,MARKET_SHARE_COLUMNS,marketShareTableModel} from '../../public/gex-data-app/options-models.js';

class Node {
  constructor(document,tag='div') { this.ownerDocument = document; this.tagName=tag;this.children = []; this.style = {}; this.dataset = {};this.attributes={};this.events={}; this.classList = { add() {} }; }
  append(...nodes) { for(const node of nodes){node.remove?.();node.parent=this;this.children.push(node);} }
  replaceChildren(...nodes) { for(const node of this.children)node.parent=null;this.children=[];this.append(...nodes); }
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;}
  setAttribute(key,value) {this.attributes[key]=value;}
  addEventListener(key,callback) {this.events[key]=callback;}
  fire(key,event={}){this.events[key]?.({preventDefault(){},stopPropagation(){},...event});}
  removeEventListener() {}
  querySelectorAll(selector) { return selector==='tr:first-child th'?(this.children[0]?.children??[]):[]; }
  querySelector(selector){const id=/button\[data-column-reorder="([^"]+)"\]$/.exec(selector)?.[1];return descendants(this).find(node=>node!==this&&(id?node.tagName==='button'&&node.dataset?.columnReorder===id:node.tagName===selector))??null;}
  focus(){this.ownerDocument.activeElement=this;}
  contains(other){return descendants(this).includes(other);}
  getBoundingClientRect(){return this.rect??{left:8,top:8,bottom:32,width:220,height:240};}
}
const descendants=node=>[node,...(node.children??[]).flatMap(descendants)];
function fixture(saved = null,withColumnHost=false) {
  const document = {events:{},addEventListener(key,callback){(this.events[key]??=[]).push(callback);},removeEventListener(key,callback){this.events[key]=(this.events[key]??[]).filter(item=>item!==callback);},dispatch(key,event){for(const callback of this.events[key]??[])callback(event);}, createElement: tag => new Node(document,tag),createElementNS:(_namespace,tag)=>new Node(document,tag), createTextNode: text => ({ textContent: text }) };
  document.body=new Node(document,'body');document.querySelector=selector=>document.body.querySelector(selector);document.defaultView={innerWidth:800,innerHeight:600,events:{},addEventListener(key,callback){(this.events[key]??=[]).push(callback);},removeEventListener(key,callback){this.events[key]=(this.events[key]??[]).filter(item=>item!==callback);}};
  const table = new Node(document); table.tBodies = [];
  let head,body,foot;table.createTHead = () => (head=new Node(document)); table.createTBody = () => (body=new Node(document)); table.createTFoot = () => (foot=new Node(document));
  let stored = saved;
  const columnHost=withColumnHost?new Node(document):null;
  document.body.append(table);if(columnHost)document.body.append(columnHost);
  const view = createTableView({ table,columnHost, storage: { getItem: () => stored && JSON.stringify(stored), setItem: (_, value) => { stored = JSON.parse(value); } } });
  return { view,table,columnHost,get head(){return head;},get body(){return body;},get foot(){return foot;}, saved: () => stored };
}
const full = ['date', 'time', 'ticker', 'price'].map(key => ({ key, label: key, type: 'text' }));
const latest = full.filter(column => column.key !== 'date');
const ids = view => view.getColumns().map(column => column.id);
const put = (view, columns) => view.setRows([{ date: 'Friday', time: 'now', ticker: 'QQQ', price: '12' }], { columns, toolId: 'equity-prints' });

test('actual Dark Pool column chooser fixes Rank and dynamically locks only the sorted metric through restore/reorder',()=>{
  const app=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),fragment=app.slice(app.indexOf('  function renderDarkLevelsQuant('),app.indexOf('  function renderOhlcQuant('));let actual;
  const env={getControl:key=>key==='topLevels'?'50':'',number:Number,prepareDarkPoolLevels,DARK_POOL_LEVEL_COLUMNS,showTable:(rows,columns,_total,config)=>{actual={rows,columns,config};},setSummary(){},formatPrice:String,netDriftContractControls:null};
  vm.runInNewContext(fragment+'\nthis.render=renderDarkLevelsQuant;',env);env.render({data:{'773':{notionalValue:100,tradeCount:2,size:10}}});
  const tableFixture=fixture({hidden:['rank','price','volume'],order:['volume','price','rank','notionalValue','tradeCount'],widths:{rank:210}},true),{view,columnHost}=tableFixture;
  const load=columns=>view.setRows(actual.rows,{columns,toolId:'dark-pool-levels',inlineFilters:false,sortKey:actual.config.sortKey});load(actual.columns);
  const labels=()=>descendants(columnHost).filter(node=>node.tagName==='label');
  assert.deepEqual(labels().map(node=>node.children[1].textContent),['Volume','Price','Notional Value','Trade Count']);
  const priceChoice=labels().find(node=>node.children[1].textContent==='Price');assert.equal(priceChoice.children[0].disabled,true);assert.equal(priceChoice.children[0].checked,true);
  assert.equal(view.getColumns().find(column=>column.id==='rank').visible,true);
  assert.equal(view.getColumns()[0].id,'rank');assert.equal(view.getColumns()[0].width,70,'legacy rank width restores source fixed width');
  const rankHeader=descendants(tableFixture.head).find(node=>node.dataset?.columnId==='rank'),priceHeader=descendants(tableFixture.head).find(node=>node.dataset?.columnId==='price');
  assert.equal(rankHeader.draggable,false);assert.equal(descendants(rankHeader).some(node=>node.attributes?.role==='separator'),false);
  assert.equal(priceHeader.draggable,true);assert.ok(descendants(priceHeader).some(node=>node.attributes?.role==='separator'));
  let rejected=false;rankHeader.fire('dragstart',{preventDefault(){rejected=true;}});assert.equal(rejected,true);
  const anchored=ids(view);view.reorder('rank','volume');view.reorder('volume','rank');assert.deepEqual(ids(view),anchored);
  priceHeader.fire('dragstart');rankHeader.fire('drop');assert.deepEqual(ids(view),anchored,'UI drop cannot insert another column before fixed Rank');
  assert.equal(view.getColumns().find(column=>column.id==='volume').visible,false);
  view.setVisible('price',false);assert.equal(view.getColumns().find(column=>column.id==='price').visible,true);
  view.setVisible('volume',true);view.setVisible('tradeCount',false);view.reorder('volume','notionalValue');
  assert.equal(view.getColumns().find(column=>column.id==='volume').visible,true);assert.equal(view.getColumns().find(column=>column.id==='tradeCount').visible,false);
  assert.deepEqual(ids(view),['rank','price','volume','notionalValue','tradeCount']);
  const checkbox=name=>labels().find(node=>node.children[1].textContent===name).children[0];
  assert.notEqual(actual.columns.find(column=>column.key==='price').canHide,false,'Price has no permanent visibility requirement');
  descendants(tableFixture.head).find(node=>node.dataset?.columnId==='notionalValue').children.find(node=>node.className==='qtable-sort').fire('click');assert.equal(view.getSort().id,'notionalValue');assert.equal(view.getSort().direction,-1);assert.equal(checkbox('Price').disabled,false);assert.equal(checkbox('Notional Value').disabled,true);assert.equal(checkbox('Trade Count').disabled,false);assert.equal(checkbox('Volume').disabled,false);
  view.setVisible('notionalValue',false);assert.equal(view.getColumns().find(column=>column.id==='notionalValue').visible,true);view.setVisible('price',false);assert.equal(view.getColumns().find(column=>column.id==='price').visible,false);
  load(actual.columns);assert.equal(view.getColumns().find(column=>column.id==='price').visible,false,'ordinary refresh retains the active Notional sort and optional hidden Price');
  view.setSort('price',1);assert.equal(view.getColumns().find(column=>column.id==='price').visible,true,'new active sort repairs a previously hidden column');assert.equal(checkbox('Price').disabled,true);assert.equal(checkbox('Notional Value').disabled,false);assert.equal(tableFixture.saved().hidden.includes('price'),false);
  view.setRows([{rank:1,price:773}],{toolId:'ordinary-table',columns:[{key:'rank',label:'Rank'},{key:'price',label:'Price'}]});
  assert.deepEqual(labels().map(node=>node.children[1].textContent),['Rank','Price']);assert.equal(labels()[1].children[0].disabled,false,'ordinary table Price retains its existing configurable visibility');
  view.setSort('price',-1);assert.equal(labels()[1].children[0].disabled,false);view.setVisible('price',false);assert.equal(view.getColumns().find(column=>column.id==='price').visible,false,'sorting alone cannot enable this opt-in rule for unrelated tools');
  view.destroy();
});

test('Dark Pool actual menu grips drag and keyboard reorder through persistence with fixed Rank and unchanged default menus',()=>{
  const app=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),fragment=app.slice(app.indexOf('  function renderDarkLevelsQuant('),app.indexOf('  function renderOhlcQuant('));let actual;
  const env={getControl:key=>key==='topLevels'?'50':'',number:Number,prepareDarkPoolLevels,DARK_POOL_LEVEL_COLUMNS,showTable:(rows,columns)=>{actual={rows,columns};},setSummary(){},formatPrice:String,netDriftContractControls:null};
  vm.runInNewContext(fragment+'\nthis.render=renderDarkLevelsQuant;',env);env.render({data:{'773':{notionalValue:100,tradeCount:2,size:10}}});
  const h=fixture(null,true),load=target=>target.view.setRows(actual.rows,{columns:actual.columns,toolId:'dark-pool-levels',inlineFilters:false});load(h);
  const grips=()=>descendants(h.columnHost).filter(node=>node.dataset?.columnReorder),grip=id=>grips().find(node=>node.dataset.columnReorder===id);
  assert.deepEqual(grips().map(node=>node.dataset.columnReorder),['price','notionalValue','tradeCount','volume']);
  assert.ok(grips().every(node=>node.draggable&&node.attributes['aria-roledescription']==='draggable'));assert.equal(grip('rank'),undefined);
  grip('price').fire('dragstart',{dataTransfer:{setData(){}}});
  descendants(h.columnHost).find(node=>node.className==='qtable-column-reorder-row'&&descendants(node).some(child=>child.dataset?.columnReorder==='volume')).fire('drop');
  assert.deepEqual(ids(h.view),['rank','notionalValue','tradeCount','volume','price']);assert.deepEqual(h.saved().order,ids(h.view));
  grip('price').fire('keydown',{key:' '});assert.equal(grip('price').attributes['aria-pressed'],'true');
  grip('price').fire('keydown',{key:'ArrowUp'});assert.deepEqual(ids(h.view),['rank','notionalValue','tradeCount','price','volume']);
  assert.equal(grip('price').ownerDocument.activeElement,grip('price'),'keyboard focus survives menu rerender');
  grip('price').fire('keydown',{key:' '});assert.equal(grip('price').attributes['aria-pressed'],'false');
  grip('notionalValue').fire('keydown',{key:' '});grip('notionalValue').fire('keydown',{key:'ArrowUp'});assert.equal(ids(h.view)[0],'rank');assert.equal(ids(h.view)[1],'notionalValue');
  grip('notionalValue').fire('keydown',{key:'Escape'});assert.equal(grip('notionalValue').attributes['aria-pressed'],'false');
  const fresh=fixture(h.saved(),true);load(fresh);assert.deepEqual(ids(fresh.view),ids(h.view));assert.equal(fresh.view.getColumns().find(column=>column.id==='price').visible,true);
  fresh.view.setRows([{ticker:'SPY',price:773}],{toolId:'ordinary',columns:[{key:'ticker',label:'Ticker'},{key:'price',label:'Price'}]});
  assert.equal(descendants(fresh.columnHost).some(node=>node.dataset?.columnReorder),false,'other callers gain no new UI');
  h.view.destroy();fresh.view.destroy();
});

test('coordinated Columns replaces adjacent menus, dismisses outside/Escape, retains own scroll and cleans remount/destroy',()=>{
  const h=fixture(null,true),doc=h.columnHost.ownerDocument,columns=[{key:'rank',label:'Rank',columnMenu:false,reorderable:false},{key:'price',label:'Price',menuReorder:true,canHide:false}];
  h.view.setRows([{rank:1,price:773}],{columns,toolId:'dark-pool-levels',inlineFilters:false});
  const details=()=>h.columnHost.querySelector('details'),summary=()=>descendants(details()).find(node=>node.tagName==='summary'),open=()=>summary().fire('click');
  const portal=()=>doc.body.children.find(node=>node.className==='qtable-column-menu');
  summary().rect={left:780,top:580,bottom:604,width:70,height:24};open();assert.equal(details().open,true);
  assert.equal(portal().parent,doc.body,'menu escapes clipped toolbar into document body');assert.equal(portal().style.position,'fixed');assert.equal(portal().style.left,'572px');assert.equal(portal().style.top,'334px');
  const ticker=new Node(doc),anchor=new Node(doc);let tickerOpen=true;
  claimMenu(doc,ticker,()=>{tickerOpen=false;},anchor);assert.equal(details().open,false,'adjacent ticker opening closes Columns');
  open();assert.equal(details().open,true);assert.equal(tickerOpen,false,'opening Columns closes prior ticker');
  const inside=descendants(portal()).find(node=>node.dataset?.columnReorder==='price');
  doc.dispatch('pointerdown',{target:inside});doc.dispatch('scroll',{target:inside});assert.equal(details().open,true,'own scrolling/clicking does not dismiss');
  doc.dispatch('pointerdown',{target:new Node(doc)});assert.equal(details().open,false);
  open();doc.dispatch('keydown',{key:'Escape'});assert.equal(details().open,false);assert.equal(doc.activeElement,summary());
  open();descendants(portal()).find(node=>node.attributes?.['aria-label']==='Close Columns').fire('click');assert.equal(details().open,false);assert.equal(doc.activeElement,summary());assert.equal(portal(),undefined);
  open();const old=details();h.view.render();assert.notEqual(details(),old);assert.equal(details().open,true);
  tickerOpen=true;claimMenu(doc,ticker,()=>{tickerOpen=false;},anchor);old.fire('toggle');assert.equal(tickerOpen,true,'stale detached toggle cannot reclaim active menu');releaseMenu(doc,ticker);
  assert.equal(doc.events.pointerdown.length,1);assert.equal(doc.events.click.length,1);assert.equal(doc.events.keydown.length,1,'shared coordination has one listener set after rerenders');
  open();const current=details();h.view.destroy();assert.equal(current.open,false);assert.equal(portal(),undefined);assert.equal(doc.events.scroll.length,0);assert.equal(doc.defaultView.events.resize.length,0);current.fire('toggle');
  tickerOpen=true;claimMenu(doc,ticker,()=>{tickerOpen=false;},anchor);doc.dispatch('pointerdown',{target:inside});assert.equal(tickerOpen,false,'destroyed Columns no longer owns the manager');
});

test('rank-control changes apply new sort while same-control refresh preserves manual column sorting',()=>{
  const {view}=fixture();
  const rows=[{ticker:'AAA',bullish:10,bearish:30},{ticker:'BBB',bullish:20,bearish:5}];
  const columns=[{key:'ticker',type:'text'},{key:'bullish',type:'integer'},{key:'bearish',type:'integer'}];
  const refresh=sortKey=>view.setRows(rows,{columns,toolId:'gainers-losers',sortKey});
  refresh('bullish');assert.equal(view.getVisibleRows()[0].ticker,'BBB');
  refresh('bearish');assert.equal(view.getVisibleRows()[0].ticker,'AAA');
  view.setSort('ticker',-1);refresh('bearish');assert.equal(view.getVisibleRows()[0].ticker,'BBB');
  refresh('bullish');assert.equal(view.getVisibleRows()[0].ticker,'BBB');
  view.destroy();
});

test('Date appearing after latest tape joins its default first position', () => {
  const { view } = fixture();
  put(view, latest); put(view, full);
  assert.deepEqual(ids(view), ['date', 'time', 'ticker', 'price']);
  view.destroy();
});

test('actual Gainers table retains source ratio sorting without overriding a manual ticker sort on refresh',()=>{
  const {view}=fixture(),data={MISSING:{bullishPremium:0,bearishPremium:5},ZERO:{bullishPremium:10,bearishPremium:0},HIGH:{bullishPremium:10,bearishPremium:5}};
  const refresh=()=>view.setRows(gainersModel(data,'premiumRatio').rows,{columns:GAINERS_COLUMNS,toolId:'gainers-losers',sortKey:'premiumRatio'});
  refresh();assert.deepEqual(view.getVisibleRows().map(row=>row.ticker),['HIGH','ZERO','MISSING']);
  view.setSort('premiumRatio',1);assert.deepEqual(view.getVisibleRows().map(row=>row.ticker),['MISSING','ZERO','HIGH']);
  view.setSort('ticker',1);refresh();assert.deepEqual(view.getVisibleRows().map(row=>row.ticker),['HIGH','MISSING','ZERO']);
  view.destroy();
});

test('new columns preserve existing custom relative order and filter state', () => {
  const { view } = fixture();
  put(view, latest); view.reorder('price', 'time'); view.setFilter('ticker', 'QQQ');
  put(view, full);
  assert.deepEqual(ids(view), ['price', 'date', 'time', 'ticker']);
  assert.equal(view.getVisibleRows().length, 1);
  put(view, latest); put(view, full);
  assert.deepEqual(ids(view), ['price', 'date', 'time', 'ticker']);
  view.setFilter('ticker', 'SPY'); assert.equal(view.getVisibleRows().length, 0);
  view.destroy();
});

test('temporarily absent Date restores saved custom position, width and hidden preference across reload', () => {
  const initial = { order: ['price', 'time', 'date', 'ticker'], widths: { date: 180, price: 150 }, hidden: ['date'] };
  const { view, saved } = fixture(initial);
  put(view, latest); view.setVisible('ticker', false);
  assert.deepEqual(saved().order, initial.order);
  put(view, full);
  assert.deepEqual(ids(view), initial.order);
  assert.equal(view.getColumns().find(column => column.id === 'date').width, 180);
  assert.equal(view.getColumns().find(column => column.id === 'date').visible, false);
  assert.equal(view.getColumns().find(column => column.id === 'ticker').visible, false);
  view.destroy();
});

test('unseen middle and trailing schema columns join default neighbours without resetting saved order', () => {
  const { view } = fixture({ order: ['time', 'price'], widths: { price: 173 } });
  put(view, full);
  assert.deepEqual(ids(view), ['date', 'time', 'ticker', 'price']);
  put(view, [...full, { key: 'venue', label: 'Venue' }]);
  assert.deepEqual(ids(view), ['date', 'time', 'ticker', 'price', 'venue']);
  assert.equal(view.getColumns().find(column => column.id === 'price').width, 173);
  view.destroy();
});


test('Exchange opt-in geometry fixes early widths and fills only last visible column across hide reorder resize and tool reset',()=>{
  const h=fixture(),schema=[['date',120],['time',100],['ticker',110],['type',110]].map(([key,width])=>({key,label:key,width}));
  const load=columns=>h.view.setRows([{date:'16',time:'12',ticker:'QQQ',type:'LUDP'}],{columns,toolId:'exchange-notifications',fillLastColumn:true});
  const headers=()=>h.head.children[0].children,widths=()=>headers().map(node=>node.style.width);
  load(schema);assert.deepEqual(widths(),['120px','100px','110px','auto']);assert.equal(h.table.style.width,'100%');assert.equal(h.table.style.minWidth,'440px');assert.equal(headers()[3].style.minWidth,'110px');
  assert.deepEqual(headers().slice(0,3).map(node=>node.style.maxWidth),['120px','100px','110px']);
  h.view.setVisible('type',false);assert.deepEqual(widths(),['120px','100px','auto']);assert.equal(h.table.style.minWidth,'330px');
  h.view.setVisible('type',true);h.view.reorder('type','time');assert.deepEqual(headers().map(node=>node.dataset.columnId),['date','type','time','ticker']);assert.deepEqual(widths(),['120px','110px','100px','auto']);
  descendants(headers()[0]).find(node=>node.attributes?.role==='separator').fire('keydown',{key:'ArrowRight'});assert.equal(headers()[0].style.width,'130px');assert.equal(h.table.style.minWidth,'450px');assert.equal(h.saved().widths.date,130);
  load(schema.filter(column=>column.key!=='date'));assert.equal(h.table.style.minWidth,'320px');assert.equal(widths().at(-1),'auto');
  load(schema);assert.equal(headers().find(node=>node.dataset.columnId==='date').style.width,'130px');
  h.view.setRows([],{columns:schema,toolId:'equity-prints'});assert.equal(h.table.style.minWidth,'');assert.ok(widths().every(width=>width.endsWith('px')));assert.ok(headers().every(node=>node.style.maxWidth===''&&node.style.boxSizing===''));
  h.view.setRows([],{columns:schema,toolId:'exchange-notifications',fillLastColumn:true});for(const column of schema)h.view.setVisible(column.key,false);assert.equal(h.table.style.minWidth,'110px','existing last-column visibility guard remains intact');
  h.view.destroy();
});


test('actual Gainers Rank stays fixed visible 70px through legacy restore hide reorder and schema refresh',()=>{
  const h=fixture({order:['ticker','rank'],hidden:['rank'],widths:{rank:200}},true),load=()=>h.view.setRows([{rank:1,ticker:'SPY'}],{columns:GAINERS_COLUMNS,toolId:'gainers-losers'});load();const rank=()=>h.view.getColumns().find(column=>column.id==='rank');assert.equal(ids(h.view)[0],'rank');assert.equal(rank().visible,true);assert.equal(rank().width,70);h.view.setVisible('rank',false);h.view.reorder('rank','ticker');h.view.reorder('ticker','rank');assert.equal(ids(h.view)[0],'rank');assert.equal(rank().visible,true);const header=descendants(h.head).find(node=>node.dataset?.columnId==='rank');assert.equal(header.draggable,false);assert.equal(descendants(header).some(node=>node.attributes?.role==='separator'),false);assert.equal(descendants(h.columnHost).some(node=>node.tagName==='label'&&node.children[1]?.textContent==='Rank'),false);load();assert.equal(rank().width,70);h.view.destroy();
});


test('Gainers actual Columns locks only current sort plus immutable Rank and repairs hidden next sort',()=>{
  const h=fixture(null,true);h.view.setRows([{rank:1,ticker:'SPY',bullishPremium:100,premiumRatio:.5}],{columns:GAINERS_COLUMNS,toolId:'gainers-losers',sortKey:'bullishPremium'});
  const checkbox=label=>descendants(h.columnHost).find(node=>node.tagName==='label'&&node.children[1]?.textContent===label)?.children[0];
  assert.equal(checkbox('Bullish Premium').checked,true);assert.equal(checkbox('Bullish Premium').disabled,true);assert.equal(checkbox('Ticker').disabled,false);h.view.setVisible('bullishPremium',false);assert.equal(h.view.getColumns().find(column=>column.id==='bullishPremium').visible,true);
  h.view.setSort('ticker',1);assert.equal(checkbox('Ticker').disabled,true);assert.equal(checkbox('Bullish Premium').disabled,false);h.view.setVisible('premiumRatio',false);assert.equal(h.view.getColumns().find(column=>column.id==='premiumRatio').visible,false);h.view.setSort('premiumRatio',-1);assert.equal(checkbox('Premium Ratio').checked,true);assert.equal(checkbox('Premium Ratio').disabled,true);assert.equal(checkbox('Ticker').disabled,false);assert.equal(checkbox('Rank'),undefined);assert.equal(h.view.getColumns().find(column=>column.id==='rank').visible,true);h.view.destroy();
});
test('Market Share actual Columns dynamically locks sorted field and repairs restored hidden sort without locking peers',()=>{
 const h=fixture({hidden:['equityTotalVolume'],widths:{totalPremium:193}},true),model=marketShareTableModel({BATS:{equityCallVolume:10,equityCallPremium:100}});h.view.setRows(model.rows,{columns:MARKET_SHARE_COLUMNS,totalRow:model.totalRow,toolId:'market-share-table',sortKey:'equityTotalVolume',inlineFilters:false});
 const checkbox=label=>descendants(h.columnHost).find(node=>node.tagName==='label'&&node.children[1]?.textContent===label)?.children[0];
 assert.equal(checkbox('Equity Volume').checked,true);assert.equal(checkbox('Equity Volume').disabled,true);assert.equal(checkbox('Total Premium').disabled,false);h.view.setVisible('equityTotalVolume',false);assert.equal(h.view.getColumns().find(column=>column.id==='equityTotalVolume').visible,true);
 h.view.setVisible('totalPremium',false);h.view.setSort('totalPremium',-1);assert.equal(checkbox('Total Premium').checked,true);assert.equal(checkbox('Total Premium').disabled,true);assert.equal(checkbox('Equity Volume').disabled,false);assert.equal(h.view.getColumns().find(column=>column.id==='totalPremium').width,193,'source defaults must not erase saved custom widths');h.view.destroy();
});

test('actual Market Share table paints IEX blank Group and retains ALL/TOTAL numeric footer',()=>{
 const h=fixture(),model=marketShareTableModel({IEX:{equityCallPremium:1234567,equityCallVolume:120,equityCallTradeCount:3}});
 h.view.setRows(model.rows,{columns:MARKET_SHARE_COLUMNS,totalRow:model.totalRow,toolId:'market-share-table',inlineFilters:false});
 const bodyCells=descendants(h.body).filter(node=>node.tagName==='td'),footCells=descendants(h.foot).filter(node=>node.tagName==='td');
 const text=node=>node.textContent??(node.children??[]).map(text).join('');
 assert.equal(text(bodyCells[0]),'');assert.equal(text(bodyCells[1]),'IEX');assert.equal(text(footCells[0]),'TOTAL');assert.equal(text(footCells[1]),'ALL');assert.ok(footCells.some(node=>text(node).startsWith('$1,234,567')));assert.equal(bodyCells.length,17);assert.equal(footCells.length,17);h.view.destroy();
});
