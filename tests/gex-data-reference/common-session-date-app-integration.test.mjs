import {gainersIndustryChoices} from '../../public/gex-data-app/gainers-industry-controls.js';
import {numericControlChoices} from '../../public/gex-data-app/numeric-control-options.js';
import test from 'node:test';
import {mountSessionDateControls} from '../../public/gex-data-app/session-date-controls.js';
import {mountDarkPoolLevelLimit} from '../../public/gex-data-app/dark-pool-level-controls.js';
import {mountOptionTapeSessionControls} from '../../public/gex-data-app/option-tape-session-controls.js';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {optionTapeRequest,optionTapeSort,optionTapeFilterExpression,optionTapeField,optionTapeColumnFields,optionTapeSessionRange,optionTapeCursor,mergeOptionTapeRows} from '../../public/gex-data-app/option-tape-interaction-model.js';
import {additionalToolRequest} from '../../public/gex-data-app/additional-tool-requests.js';
import {toolControlDefault} from '../../public/gex-data-app/tool-control-defaults.js';
import {resolveFilterOverride,normalizeAPIExpression,expirationFilterForTool} from '../../public/gex-data-app/preferences-model.js';
import {restoreSurfaceSelections,persistSurfaceSelections} from '../../public/gex-data-app/surface-selection-storage.js';
import {dataRequestIdentity} from '../../public/gex-data-app/live-chart-model.js';
import {equityPrintField,equityPrintColumnFields,equityPrintSort,equityPrintFilterExpression,equityPrintRequest,equityPrintCursor} from '../../public/gex-data-app/equity-print-interaction-model.js';
import {notificationField,notificationColumnFields,notificationSort,notificationFilterExpression,notificationRequest,notificationCursor,notificationReferenceSession} from '../../public/gex-data-app/exchange-notification-interaction-model.js';
import {EQUITY_PRINT_COLUMNS,EXCHANGE_NOTIFICATION_COLUMNS,equitySideColorToken,equityPrintColorToken,notificationColorToken} from '../../public/gex-data-app/equity-renderers.js';
import {formatTableValue,createTableView} from '../../public/gex-data-app/table-view.js';
import {CONSOLIDATED_COLUMNS,flowStatisticsModel,GAINERS_COLUMNS,gainersModel,MARKET_SHARE_COLUMNS,marketShareTableModel} from '../../public/gex-data-app/options-models.js';
import {UNCONSOLIDATED_COLUMNS} from '../../public/gex-data-app/option-trade-detail-model.js';
import {validateGexDataRequest} from '../../src/lib/gexDataPolicy.ts';
import {mergeEquityLivePage,mergeLiveTapePage} from '../../public/gex-data-app/equity-live-page.js';

const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),plain=value=>JSON.parse(JSON.stringify(value));
const definitions=vm.runInNewContext(source.slice(source.indexOf('const TOOL_DEFINITIONS = [')+'const TOOL_DEFINITIONS = '.length,source.indexOf('\n  ];',source.indexOf('const TOOL_DEFINITIONS = ['))+5));
function actual(name){const start=new RegExp(`^  (?:async )?function ${name}\\(`,'m').exec(source);assert.ok(start,name);const tail=source.slice(start.index+start[0].length),end=/^  (?:async )?function /m.exec(tail);assert.ok(end);return source.slice(start.index,start.index+start[0].length+end.index);}
class Node{
  constructor(tag='div',document){this.tagName=tag.toUpperCase();this.ownerDocument=document;this.dataset={};this.children=[];this.options=[];this._value='';this._type='';this.style={};this.attributes={};this.events={};this.classList={add(){},remove(){},toggle(){},contains:name=>String(this.className||'').split(/\s+/).includes(name)};this.textContent='';}
  get value(){return this._value;}set value(value){const text=String(value);this._value=this._type==='number'&&text!==''&&(!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)||!Number.isFinite(Number(text)))?'':text;}
  get type(){return this._type;}set type(value){this._type=value;this.value=this._value;}
  append(...children){for(const child of children){child.remove?.();child.parent=this;this.children.push(child);}}
  prepend(...children){this.append(...children);this.children=[...children,...this.children.filter(child=>!children.includes(child))];}
  replaceChildren(...children){this.children.forEach(child=>{child.parent=null;});this.children=[];this.append(...children);}
  insertBefore(child,reference){this.append(child);const before=this.children.indexOf(reference);if(before>=0){this.children.pop();this.children.splice(before,0,child);}}
  add(option){this.options.push(option);this.children.push(option);if(this.options.length===1)this.value=option.value;}
  contains(other){return this===other||this.children.some(child=>child.contains(other));}
  get isConnected(){return this===this.ownerDocument.body||!!this.parent?.isConnected;}
  fire(type){if(!this.disabled)for(const callback of this.events[type]||[])callback({target:this,currentTarget:this});}
  closest(){return this.parent;}setAttribute(key,value){this.attributes[key]=value;}addEventListener(event,callback){(this.events[event]||=[]).push(callback);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
  removeEventListener(event,callback){this.events[event]=(this.events[event]||[]).filter(value=>value!==callback);}
  focus(){this.ownerDocument.activeElement=this;}
  getBoundingClientRect(){return {left:100,bottom:40,height:28,width:120};}
  querySelector(selector){return descendants(this).find(node=>node.tagName?.toLowerCase()===selector)||null;}
  querySelectorAll(selector){return selector==='tr:first-child th'?this.children[0]?.children.filter(node=>node.tagName==='TH')??[]:[];}
}

const byLabel=(root,label)=>descendants(root).find(node=>node.attributes?.['aria-label']===label);
const byText=(root,text)=>descendants(root).find(node=>node.textContent===text);

test('actual Equity controls retain copied legacy filters behind source range toolbar and public DST-safe scope',()=>{
  const h=harness({toolId:'equity-prints',copied:{c_mode:'historical',c_date:'2026-10-16',c_ticker:'SPY',c_printType:'LIT_POOL'}});
  assert.equal(h.input('ticker').closest().hidden,true);assert.equal(h.input('printType').closest().hidden,true);assert.equal(byLabel(h.holder,'Session Date'),undefined);
  assert.equal(h.env.session.commitOnSelect,true);assert.equal(h.env.session.toggleSameDay,true);
  assert.deepEqual(h.request(),{sessionDate:'2026-10-16',filter:{ticker:'SPY',equityPrintTypes:['LIT_POOL']},size:100,sort:{field:'TRADE_TIME',direction:'DESCENDING'}});
  h.env.session.onChange({startDate:'2026-10-31',endDate:'2026-11-02'});
  assert.deepEqual(h.request().timeRange,{startTime:'2026-10-31T04:00:00.000Z',endTime:'2026-11-03T05:00:00.000Z'});assert.equal(h.request().sessionDate,undefined);
  h.global.sessionDate='2026-10-16';h.global.tickers=['SPY','QQQ'];h.env.api.reflectFilterOverrides();
  assert.equal(h.request().sessionDate,'2026-10-16');assert.equal(h.request().timeRange,undefined);assert.deepEqual(h.request().filter.tickers,['SPY','QQQ']);
});

test('actual Equity headers dispatch public server sorts/AND filters and reset opaque cursor without statistics',()=>{
  const h=harness({toolId:'equity-prints',saved:{mode:'historical',date:'2026-10-16'},groups:[{id:'group',expression:{field:'SIZE',operation:'GREATER_THAN',values:[1]}}]});
  h.env.toolCursor=['old','opaque'];const config=h.env.api.equityPrintTableConfiguration(h.tool);
  config.onSortChange({id:'ticker',field:'PRINT_TYPE',direction:1});assert.equal(h.env.toolCursor,null);assert.equal(h.loads.length,1);assert.deepEqual(h.loads.at(-1).body.sort,{field:'PRINT_TYPE',direction:'ASCENDING'});
  h.env.toolCursor=['different'];h.env.api.equityPrintTableConfiguration(h.tool).onFilterChange({id:'price',field:'PRICE',operator:'GREATER_THAN_OR_EQUAL_TO',value:875.7});
  assert.equal(h.env.toolCursor,null);assert.equal(h.loads.at(-1).body.searchAfter,undefined);assert.equal(h.loads.at(-1).body.includeStatistics,undefined);
  assert.equal(h.loads.at(-1).body.filterExpression.filters[1].filters[0].values[0],875.7);
  assert.equal(h.loads.at(-1).body.filterExpression.filters[0].filters[0].field,'SIZE');
  h.env.api.renderToolPayload(h.tool,{data:[{id:'1',ticker:'MU',size:1500,price:875.7,tradeSide:'ASK',printType:'LIT_POOL',tradeTime:1792187990000}]});
  const table=h.tables.at(-1);assert.equal(table.config.headerMenu,true);assert.equal(table.config.inlineFilters,false);
  assert.equal(table.config.columns.length,7);const bidAsk=table.config.columns.find(column=>column.id==='bidAsk');assert.equal(bidAsk.sortable,false);assert.equal(bidAsk.bidAskSeparator,' x ');assert.deepEqual(Array.from(bidAsk.filterFields,field=>field.field),['BID_PRICE','ASK_PRICE']);
  assert.deepEqual(Array.from(table.config.columns.find(column=>column.id==='ticker').sortKeys,key=>key.field),['TICKER','PRINT_TYPE']);
  assert.deepEqual(Array.from(table.config.columns.find(column=>column.id==='price').sortKeys,key=>key.field),['PRICE']);
  for(const id of ['date','tradeTime','size','price','notionalValue'])assert.equal(table.config.columns.find(column=>column.id===id).directSort,true,`${id} reaches the actual direct-sort renderer`);
  for(const id of ['date','tradeTime'])assert.equal(table.config.columns.find(column=>column.id===id).sharedSortIndicator,true,`${id} reaches the shared canonical field indicator`);
  assert.equal(table.config.columns.find(column=>column.id==='ticker').sortMenuRadios,true);assert.notEqual(bidAsk.directSort,true);
  const price=table.config.columns.find(column=>column.id==='price');assert.equal(formatTableValue(875.7,price,{tradeSide:'ASK',printType:'LIT_POOL'},{timeZone:'UTC'}),'$875.70 A');assert.equal(formatTableValue(875.7,price,{tradeSide:'ASK',printType:'DARK_POOL'},{timeZone:'UTC'}),'$875.70');
  assert.equal(formatTableValue(null,bidAsk,{bidPrice:875.6,askPrice:875.7},{timeZone:'UTC'}),'$875.60 x $875.70');
  h.set('mode','latest');h.env.api.renderToolPayload(h.tool,{data:[]});assert.equal(h.tables.at(-1).config.columns.length,6);
});

test('real Equity calendar continues legacy single-day range after reopening, disables weekend endpoints and closes on completion',()=>{
  const h=harness({toolId:'equity-prints',realCalendar:true,copied:{c_mode:'historical',c_date:'2026-10-16'}}),open=()=>byLabel(h.holder,'Session Date Range').fire('click');
  assert.equal(h.get('tapeSessionStart'),'2026-10-16');assert.equal(h.get('tapeSessionEnd'),'2026-10-16');open();const prior=h.env.menu;prior.remove();open();
  for(const day of [3,4,17,18]){const endpoint=byLabel(h.env.menu,`Oct ${day}, 2026`);assert.equal(endpoint.disabled,true);endpoint.fire('click');}assert.equal(h.loads.length,0);
  byLabel(h.env.menu,'Oct 19, 2026').fire('click');h.timers.at(-1).callback();assert.equal(h.get('tapeSessionStart'),'2026-10-16');assert.equal(h.get('tapeSessionEnd'),'2026-10-19');assert.equal(h.env.menu.isConnected,false);assert.deepEqual(h.loads.at(-1).body.timeRange,{startTime:'2026-10-16T04:00:00.000Z',endTime:'2026-10-20T04:00:00.000Z'});assert.equal(h.loads.at(-1).body.sessionDate,undefined);
  const trigger=byLabel(h.holder,'Session Date Range');assert.ok(trigger.className.includes('session-range-trigger-nowrap'));assert.equal(trigger.parent.className,'control session-range-single-line');assert.equal(h.env.session.singleLineTrigger,true);
  open();assert.equal(byLabel(h.env.menu,'Oct 17, 2026').attributes['aria-pressed'],'true','interior weekend remains included');h.env.netDriftContractControls.destroy();
});

test('real Equity empty range selects 16 then 19; reopened same singleton clears and explicit saved endpoints survive',()=>{
  const h=harness({toolId:'equity-prints',realCalendar:true});byLabel(h.holder,'Session Date Range').fire('click');byLabel(h.env.menu,'Previous month').fire('click');
  byLabel(h.env.menu,'Oct 16, 2026').fire('click');h.timers.at(-1).callback();assert.equal(h.env.menu.isConnected,true);assert.equal(h.loads.at(-1).body.sessionDate,'2026-10-16');
  byLabel(h.env.menu,'Oct 19, 2026').fire('click');assert.equal(h.env.menu.isConnected,false);assert.equal(h.get('tapeSessionStart'),'2026-10-16');assert.equal(h.get('tapeSessionEnd'),'2026-10-19');h.env.netDriftContractControls.destroy();
  const single=harness({toolId:'equity-prints',realCalendar:true,saved:{mode:'historical',date:'2026-10-16'}});byLabel(single.holder,'Session Date Range').fire('click');byLabel(single.env.menu,'Oct 16, 2026').fire('click');single.timers.at(-1).callback();assert.equal(single.get('tapeSessionStart'),'');assert.equal(single.get('tapeSessionEnd'),'');assert.equal(single.get('mode'),'latest');assert.equal(single.loads.at(-1).body.sessionDate,single.env.apiStatus.market.sessionDate);assert.equal(single.loads.at(-1).body.timeRange,undefined);single.env.netDriftContractControls.destroy();
  const saved=harness({toolId:'equity-prints',realCalendar:true,saved:{mode:'historical',date:'2026-10-16',tapeSessionStart:'2026-10-17',tapeSessionEnd:'2026-10-19'}});byLabel(saved.holder,'Session Date Range').fire('click');assert.equal(saved.get('tapeSessionStart'),'2026-10-17');assert.equal(saved.get('tapeSessionEnd'),'2026-10-19');assert.equal(saved.loads.length,0);assert.equal(byLabel(saved.env.menu,'Oct 17, 2026').disabled,true);byLabel(saved.env.menu,'Oct 20, 2026').fire('click');assert.equal(saved.get('tapeSessionStart'),'2026-10-20');assert.equal(saved.get('tapeSessionEnd'),'2026-10-20');assert.equal(saved.env.menu.isConnected,true);saved.env.netDriftContractControls.destroy();
});

test('actual Equity pagination keeps cursor scoped to request and replaces repeated IDs without inventing trades',async()=>{
  const h=harness({toolId:'equity-prints',saved:{mode:'historical',date:'2026-10-16'}});
  const first=h.load();h.requests[0].resolve({data:[{id:'one',ticker:'MU',price:875.7}],nextSearchAfter:['clock','opaque']});await first;
  const second=h.load({append:true});assert.deepEqual(h.requests[1].body.searchAfter,['clock','opaque']);assert.equal(h.requests[1].body.sort.field,'TRADE_TIME');
  h.requests[1].resolve({data:[{id:'one',ticker:'MU',price:875.71},{id:'two',ticker:'SPY',price:762}],nextSearchAfter:null});await second;
  assert.deepEqual(Array.from(h.tables.at(-1).rows,row=>[row.id,row.price]),[['one',875.71],['two',762]]);assert.equal(h.env.toolCursor,null);
  h.env.toolCursor=['old'];h.env.api.equityPrintTableConfiguration(h.tool).onSortChange({id:'price',field:'PRICE',direction:1});assert.equal(h.loads.at(-1).body.searchAfter,undefined);
});

test('actual Equity header callback compares current state when a second click restores Time before a response',()=>{
  const h=harness({toolId:'equity-prints'}),config=h.env.api.equityPrintTableConfiguration(h.tool);
  config.onSortChange({id:'size',field:'SIZE',direction:-1});assert.deepEqual(h.loads.at(-1).body.sort,{field:'SIZE',direction:'DESCENDING'});
  h.env.toolCursor=['stale'];config.onSortChange({id:'tradeTime',field:'TRADE_TIME',direction:-1});assert.equal(h.loads.length,2);assert.equal(h.env.toolCursor,null);assert.deepEqual(h.loads.at(-1).body.sort,{field:'TRADE_TIME',direction:'DESCENDING'});
  config.onSortChange({id:'tradeTime',field:'TRADE_TIME',direction:-1});assert.equal(h.loads.length,2,'the current selected direction is already requested');
});

test('actual Equity active Ticker Unsorted returns to native canonical trade-time descending and resets the cursor',()=>{
  const h=harness({toolId:'equity-prints'});h.env.api.equityPrintTableConfiguration(h.tool).onSortChange({id:'ticker',field:'PRINT_TYPE',direction:1});
  h.env.toolCursor=['old-type-order'];h.env.api.equityPrintTableConfiguration(h.tool).onSortChange({id:'ticker',field:'PRINT_TYPE',direction:null});
  assert.equal(h.env.toolCursor,null);assert.deepEqual(h.loads.at(-1).body.sort,{field:'TRADE_TIME',direction:'DESCENDING'});assert.equal(h.loads.at(-1).body.searchAfter,undefined);
  const settled=h.env.api.equityPrintTableConfiguration(h.tool);assert.equal(settled.sortKey,'TRADE_TIME');assert.equal(settled.sortDirection,-1);assert.equal(settled.sortId,'time');
});

test('actual Equity filter edits retain the current stage, preserve unrelated filters and wire automatic paging safely',async()=>{
  const h=harness({toolId:'equity-prints',groups:[{id:'group',expression:{field:'TICKER',operation:'EQUALS',values:['MU']}}]});
  const initial=h.load();h.requests[0].resolve({data:[{id:'old',ticker:'MU',size:17}],nextSearchAfter:['clock','opaque']});await initial;
  const page=h.tables.at(-1).config.autoPaging;assert.equal(page.getState().enabled,true);assert.deepEqual(Array.from(page.getState().cursor),['clock','opaque']);assert.equal(h.nodes.get('#loadMore').hidden,true);page.onNext();assert.equal(h.loads.at(-1).options.append,true);assert.deepEqual(h.loads.at(-1).body.searchAfter,['clock','opaque']);
  const filter=(field,value)=>h.env.api.equityPrintTableConfiguration(h.tool).onFilterChange({id:field==='SIZE'?'size':'price',field,operator:'GREATER_THAN_OR_EQUAL_TO',value});
  filter('PRICE',100);filter('SIZE',5000000);assert.equal(h.loads.at(-1).options.retainEquityEditor,true);assert.equal(h.env.toolCursor,null);
  const previous=h.env.toolPayload,refresh=h.load({retainEquityEditor:true});assert.equal(h.env.toolPayload,previous);assert.equal(h.nodes.get('#toolTableWrap').hidden,false);assert.equal(page.getState().busy,true);
  h.requests[1].resolve({data:[{id:'new',ticker:'MU',size:5000000}]});await refresh;assert.equal(h.tables.at(-1).rows[0].id,'new');assert.equal(h.env.toolCursor,null);assert.equal(h.nodes.get('#loadMore').hidden,true);
  assert.throws(()=>filter('SIZE','incomplete'),/valid/);assert.equal(h.tables.at(-1).rows[0].id,'new');
  h.env.api.equityPrintTableConfiguration(h.tool).onFilterChange({id:'size',field:'SIZE',operator:null});
  const expression=h.loads.at(-1).body.filterExpression;assert.equal(expression.filters[0].filters[0].field,'TICKER');assert.deepEqual(Array.from(expression.filters[1].filters,filter=>filter.field),['PRICE']);
});

test('actual Equity automatic append failure retains its cursor/data and exposes the accessible manual retry only on failure',async()=>{
  const h=harness({toolId:'equity-prints'}),first=h.load();h.requests[0].resolve({data:[{id:'one',size:7}],nextSearchAfter:['opaque',0]});await first;
  const retry=h.load({append:true});h.requests[1].reject(Error('temporary page failure'));await retry;assert.equal(h.nodes.get('#loadMore').hidden,false);assert.deepEqual(Array.from(h.env.toolCursor),['opaque',0]);assert.equal(h.env.tableRows[0].id,'one');assert.equal(h.nodes.get('#toolError').hidden,false);
  const success=h.load({append:true});assert.deepEqual(h.requests[2].body.searchAfter,['opaque',0]);h.requests[2].resolve({data:[{id:'one',size:8},{id:'two',size:9}],nextSearchAfter:null});await success;assert.equal(h.nodes.get('#loadMore').hidden,true);assert.deepEqual(Array.from(h.env.tableRows,row=>[row.id,row.size]),[['one',8],['two',9]]);
});

test('actual live Equity refresh preserves older loaded pages, deepest cursor and scope isolation',async()=>{
 const h=harness({toolId:'equity-prints'}),first=h.load();
 h.requests[0].resolve({data:[{id:'one',tradeTime:30}],nextSearchAfter:['older',30]});await first;
 const older=h.load({append:true});h.requests[1].resolve({data:[{id:'two',tradeTime:20}],nextSearchAfter:['deepest',20]});await older;
 const generation=h.env.equityPageGeneration;
 const live=h.load({liveFrame:true});h.requests[2].resolve({data:[{id:'new',tradeTime:40},{id:'one',tradeTime:30,size:2}],nextSearchAfter:['first-page',30]});await live;
 assert.deepEqual(Array.from(h.env.tableRows,r=>r.id),['new','one','two']);assert.equal(h.env.tableRows[1].size,2);
 assert.deepEqual(Array.from(h.env.toolCursor),['deepest',20]);assert.equal(h.env.equityPageGeneration,generation);
 const failed=h.load({liveFrame:true});h.requests[3].reject(Error('temporary live failure'));await failed;
 assert.deepEqual(Array.from(h.env.toolCursor),['deepest',20]);assert.deepEqual(Array.from(h.env.tableRows,r=>r.id),['new','one','two']);
 h.set('ticker','QQQ');const switched=h.load({liveFrame:true});h.requests[4].resolve({data:[{id:'qqq',tradeTime:50}],nextSearchAfter:['qqq',50]});await switched;
 assert.deepEqual(Array.from(h.env.tableRows,r=>r.id),['qqq']);assert.deepEqual(Array.from(h.env.toolCursor),['qqq',50]);
});

test('actual live notification refresh retains pages/cursor and never mixes a new type filter',async()=>{
 const h=harness({toolId:'exchange-notifications'}),initial=h.load();
 h.requests[0].resolve({data:[{id:'a',createdTime:30,type:'LUDP'}],nextSearchAfter:['old',30]});await initial;
 const page=h.load({append:true});h.requests[1].resolve({data:[{id:'b',createdTime:20,type:'REG_SHO'}],nextSearchAfter:['deep',20]});await page;
 const generation=h.env.equityPageGeneration,live=h.load({liveFrame:true});h.requests[2].resolve({data:[{id:'c',createdTime:40,type:'LUDP'},{id:'a',createdTime:30,type:'LUDP'}],nextSearchAfter:['first',30]});await live;
 assert.deepEqual(Array.from(h.env.tableRows,r=>r.id),['c','a','b']);assert.deepEqual(Array.from(h.env.toolCursor),['deep',20]);assert.equal(h.env.equityPageGeneration,generation);
 h.set('notificationType','REG_SHO');const changed=h.load({liveFrame:true});assert.deepEqual(h.requests[3].body.filter.types,['REG_SHO']);h.requests[3].resolve({data:[{id:'b',createdTime:20,type:'REG_SHO'}],nextSearchAfter:null});await changed;
 assert.deepEqual(Array.from(h.env.tableRows,r=>r.type),['REG_SHO']);assert.equal(h.env.toolCursor,null);
});

test('current Consolidated session excludes pre-open totals without changing historical or explicit scopes',()=>{
 const h=harness({toolId:'order-flow-consolidated'});
 assert.deepEqual(h.request().timeRange,{startTime:'2026-11-02T14:30:00.000Z',endTime:'2026-11-03T05:00:00.000Z'});assert.equal(h.request().sessionDate,undefined);
 h.set('mode','historical');h.set('date','2026-10-16');assert.equal(h.request().sessionDate,'2026-10-16');assert.equal(h.request().timeRange,undefined);
 const raw=harness({toolId:'order-flow-unconsolidated'});assert.equal(raw.request().sessionDate,'2026-11-02');assert.equal(raw.request().timeRange,undefined);
});

test('actual consolidated live refresh keeps older trades, deepest cursor and new provider statistics',async()=>{
 const h=harness({toolId:'order-flow-consolidated'}),initial=h.load(),statistics={CALL:{ASK:{premium:100,volume:2}},PUT:{BID:{premium:50,volume:1}}};
 h.requests[0].resolve({data:[{id:'a',tradeTime:30}],statistics,nextSearchAfter:['30']});await initial;assert.equal(h.nodes.get('#toolError').hidden,true,h.nodes.get('#toolError').textContent);
 const page=h.load({append:true});h.requests[1].resolve({data:[{id:'b',tradeTime:20}],nextSearchAfter:['20']});await page;assert.equal(h.nodes.get('#toolError').hidden,true,h.nodes.get('#toolError').textContent);
 const nextStatistics={CALL:{ASK:{premium:200,volume:3}},PUT:{BID:{premium:70,volume:2}}};
 const live=h.load({liveFrame:true});h.requests[2].resolve({data:[{id:'c',tradeTime:40},{id:'a',tradeTime:30,size:7}],statistics:nextStatistics,nextSearchAfter:['30']});await live;
 assert.deepEqual(Array.from(h.env.tableRows,r=>r.id),['c','a','b']);assert.equal(h.env.tableRows[1].size,7);assert.deepEqual(Array.from(h.env.toolCursor),['20']);
 assert.deepEqual(h.env.toolPayload.statistics,nextStatistics);assert.equal(h.nodes.get('#toolTableWrap').children.filter(n=>n.className==='flow-statistics').length,1);
 h.set('ticker','QQQ');const changed=h.load({liveFrame:true});h.requests[3].resolve({data:[{id:'qqq',tradeTime:50}],nextSearchAfter:null});await changed;
 assert.deepEqual(Array.from(h.env.tableRows,r=>r.id),['qqq']);assert.equal(h.env.toolCursor,null);
});

test('a changed live frame arriving during pagination is consumed immediately after that page finishes',async()=>{
 const h=harness({toolId:'equity-prints'}),initial=h.load();h.requests[0].resolve({data:[{id:'one',tradeTime:30}],nextSearchAfter:['old',30]});await initial;
 const older=h.load({append:true}),before=h.loads.length;h.env.api.receiveLiveToolFrame();assert.equal(h.env.pendingLiveFrame,true);assert.equal(h.loads.length,before);
 h.requests[1].resolve({data:[{id:'two',tradeTime:20}],nextSearchAfter:null});await older;await Promise.resolve();
 assert.equal(h.env.pendingLiveFrame,false);assert.deepEqual(plain(h.loads.at(-1).options),{liveFrame:true});assert.equal(h.loads.length,before+1);
});

test('actual load/render/reset pipeline with the REAL TableView keeps the focused Equity editor through a 100-to-14 response',async()=>{
  const h=harness({toolId:'equity-prints',realTable:true}),initial=h.load();h.requests[0].resolve({data:Array.from({length:100},(_,id)=>({id:String(id),ticker:'MU',size:4600000}))});await initial;
  assert.equal(h.env.tableRuntime.getVisibleRows().length,100);const document=h.holder.ownerDocument,table=h.nodes.get('#toolTable');assert.equal(h.nodes.get('#toolError').hidden,true);assert.equal(table.tBodies[0].children.length,100);
  byLabel(table.tHead,'Filter Quantity').fire('click');const editor=document.body.children.find(node=>node.className==='qtable-header-menu'),input=byLabel(editor,'Quantity value');assert.ok(input);input.focus();
  let request;h.env.loadActiveTool=options=>{request=h.load(options);};
  input.value='6000000';input.fire('input');await new Promise(resolve=>setTimeout(resolve,330));assert.equal(h.requests.length,2);assert.equal(document.activeElement,input);assert.equal(input.isConnected,true);
  h.requests[1].resolve({data:Array.from({length:14},(_,id)=>({id:'new-'+id,ticker:'MU',size:6000000}))});await request;
  assert.equal(h.env.tableRuntime.getVisibleRows().length,14);assert.equal(table.tBodies[0].children.length,14);assert.equal(h.nodes.get('#toolError').hidden,true);assert.equal(document.body.children.find(node=>node.className==='qtable-header-menu'),editor);assert.equal(byLabel(editor,'Quantity value'),input);assert.equal(document.activeElement,input);assert.equal(input.isConnected,true);assert.equal(input.value,'6,000,000');assert.equal(byLabel(table.tHead,'Filter Quantity').attributes['aria-expanded'],'true');
  for(const callback of document.events.scroll||[])callback({target:table.tBodies[0]});assert.equal(input.isConnected,true,'response/layout scroll must reposition, not dismiss, the Equity editor');
  const refresh=h.load();h.requests[2].resolve({data:[{id:'refresh',ticker:'MU',size:7000000}]});await refresh;assert.equal(input.isConnected,true);assert.equal(document.activeElement,input);
  h.env.tableRuntime.closeAutoFilter();assert.equal(input.isConnected,false);h.env.tableRuntime.destroy();
});

test('actual Equity renderer separates fixed-cents price from lit-only semantic side spans without changing captured values',async()=>{
  const h=harness({toolId:'equity-prints',realTable:true}),sides=[['BID','B','Bid'],['MID_MARKET','M','Mid'],['ASK','A','Ask'],['BELOW_BID','BB','Below bid'],['ABOVE_ASK','AA','Above ask']],rows=sides.map(([tradeSide],index)=>({id:String(index),price:index===1?2.93:21.9,printType:'LIT_POOL',tradeSide,tradeSideCode:'UNKNOWN'}));
  rows.push({id:'dark',price:21.9,printType:'DARK_POOL',tradeSide:'BID'},{id:'unknown',price:21.9,printType:'LIT_POOL',tradeSide:'UNKNOWN'});
  const load=h.load();h.requests[0].resolve({data:rows});await load;const schema=h.tables.at(-1).config.columns.find(column=>column.id==='price');assert.equal(schema.splitPriceSide,true);
  const rendered=h.nodes.get('#toolTable').tBodies[0].children;
  assert.equal(rendered.length,rows.length,h.nodes.get('#toolError')?.textContent);
  for(let index=0;index<rows.length;index++){
    const cell=rendered[index].children.find(cell=>cell.dataset.columnId==='price'),parts=cell.children[0].children,amount=parts.find(node=>node.className==='qtable-equity-price-amount'),side=parts.find(node=>node.className==='qtable-equity-price-side-code');assert.equal(amount.textContent,index===1?'$2.93':'$21.90');
    if(index<sides.length){assert.equal(side.textContent,sides[index][1]);assert.equal(side.attributes['aria-label'],sides[index][2]);assert.equal(side.title,sides[index][2]);assert.match(cell.title,new RegExp(sides[index][2]));assert.equal(parts[1].textContent,' ','explicit whitespace preserves DOM capture separation');}else assert.equal(side,undefined,'dark/unknown sides never manufacture a badge');
    assert.equal(parts.map(node=>node.textContent).join(''),formatTableValue(rows[index].price,schema,rows[index]));
  }h.env.tableRuntime.destroy();
});

test('actual Equity column switches lock canonical sorts, including Date+Time/Type aliases, independent of Quantity filters',async()=>{
  const h=harness({toolId:'equity-prints',realTable:true,saved:{mode:'historical',date:'2026-10-16'}});
  h.env.gexStorage.getItem=key=>key.includes('gex-data-table-columns:equity-prints')?JSON.stringify({hidden:['date','tradeTime','size']}):null;
  const load=h.load();h.requests[0].resolve({data:[{id:'one',ticker:'MU',size:5000000,tradeTime:1792187990000}]});await load;
  const view=h.env.tableRuntime,host=h.nodes.get('#equityPrintColumnControls'),locked=()=>descendants(host).filter(node=>node.type==='checkbox'&&node.disabled).map(node=>node.parent.children[1].textContent).sort(),visible=id=>view.getColumns().find(column=>column.id===id).visible;
  assert.deepEqual(locked(),['Date','Time']);assert.equal(visible('date'),true);assert.equal(visible('tradeTime'),true);assert.equal(visible('size'),false,'filterable non-sort column keeps its own saved visibility');
  view.setHeaderFilter('size','SIZE','GREATER_THAN_OR_EQUAL_TO',5000000);assert.deepEqual(locked(),['Date','Time'],'filter-only changes do not lock Quantity');
  view.setAtomicSort('size','SIZE',-1);assert.deepEqual(locked(),['Quantity']);assert.equal(visible('size'),true);view.setVisible('size',false);assert.equal(visible('size'),true);view.setVisible('date',false);view.setVisible('tradeTime',false);assert.equal(visible('date'),false);assert.equal(visible('tradeTime'),false);
  byText(h.nodes.get('#toolTable').tHead,'Ticker ▾').fire('click');byLabel(h.holder.ownerDocument.body,'Type: Ascending').fire('click');assert.deepEqual(locked(),['Ticker']);view.setVisible('ticker',false);assert.equal(visible('ticker'),true);assert.equal(JSON.parse(h.get('tapeFilters'))[0].field,'SIZE','Quantity filter remains active but Quantity is unlocked');
  view.setAtomicSort('date','TRADE_TIME',1);assert.deepEqual(locked(),['Date','Time']);assert.equal(visible('date'),true);assert.equal(visible('tradeTime'),true);view.setVisible('date',false);view.setVisible('tradeTime',false);assert.equal(visible('date'),true);assert.equal(visible('tradeTime'),true);
  view.destroy();
});

test('actual Gainers range presentation migrates historical saved/copied day without generic Session Date',()=>{
  for(const input of [{saved:{mode:'historical',date:'2026-10-16',tickerOptional:'SPY'}},{copied:{c_mode:'historical',c_date:'2026-10-16',c_tickerOptional:'SPY'}}]){
    const h=harness({toolId:'gainers-losers',...input});
    assert.equal(byLabel(h.holder,'Session Date'),undefined);assert.equal(h.input('mode').closest().hidden,true);assert.equal(h.input('date').closest().hidden,true);
    assert.equal(h.get('tapeSessionStart'),'2026-10-16');assert.equal(h.get('tapeSessionEnd'),'2026-10-16');
    assert.deepEqual(h.request(),{sessionDate:'2026-10-16',filter:{tickers:['SPY']}});
    h.env.api.saveToolControls();assert.equal(h.writes.at(-1)['gainers-losers'].tapeSessionStart,'2026-10-16');
  }
});

test('actual Gainers multi-session requests use inclusive New York days and exclusive next midnight through DST',()=>{
  const h=harness({toolId:'gainers-losers',saved:{mode:'historical',date:'2026-03-07',tapeSessionStart:'2026-03-07',tapeSessionEnd:'2026-03-09',tickerOptional:'SPY',sector:'TECHNOLOGY'}});
  assert.deepEqual(h.request(),{filter:{tickers:['SPY'],sectors:['TECHNOLOGY']},timeRange:{startTime:'2026-03-07T05:00:00.000Z',endTime:'2026-03-10T04:00:00.000Z'}});
  assert.equal(h.request().sessionDateStart,undefined);assert.equal(h.request().sessionDateEnd,undefined);assert.equal(h.request().sessionDate,undefined);
  h.env.session.onChange({startDate:'2026-10-31',endDate:'2026-11-02'});
  assert.deepEqual(h.request().timeRange,{startTime:'2026-10-31T04:00:00.000Z',endTime:'2026-11-03T05:00:00.000Z'});
  assert.equal(h.writes.at(-1)['gainers-losers'].tapeSessionEnd,'2026-11-02');
  validateGexDataRequest('gainers-losers',h.request());
  h.env.session.onChange({startDate:'',endDate:''});assert.equal(h.get('mode'),'latest');assert.equal(h.request().timeRange,undefined);assert.equal(h.request().sessionDate,'2026-11-02');
});

test('actual Gainers ranges retain own saved values under page/global date overrides',()=>{
  const h=harness({toolId:'gainers-losers',saved:{mode:'historical',date:'2026-10-16',tapeSessionStart:'2026-10-15',tapeSessionEnd:'2026-10-16'},global:{sessionDate:'2026-10-19'}});
  assert.equal(h.env.session.getScope().disabled,true);assert.equal(h.request().sessionDate,'2026-10-19');assert.equal(h.request().timeRange,undefined);
  h.page.sessionDate='2026-10-20';h.env.api.reflectFilterOverrides();assert.equal(h.request().sessionDate,'2026-10-20');
  h.env.api.saveToolControls();assert.equal(h.writes.at(-1)['gainers-losers'].tapeSessionStart,'2026-10-15');assert.equal(h.writes.at(-1)['gainers-losers'].tapeSessionEnd,'2026-10-16');
  delete h.page.sessionDate;delete h.global.sessionDate;h.env.api.reflectFilterOverrides();
  assert.deepEqual(h.request().timeRange,{startTime:'2026-10-15T04:00:00.000Z',endTime:'2026-10-17T04:00:00.000Z'});
  const copied=harness({toolId:'gainers-losers',copied:{c_mode:'historical',c_date:'2026-10-16',c_tapeSessionStart:'2026-10-15',c_tapeSessionEnd:'2026-10-16'}});
  assert.deepEqual(copied.request().timeRange,h.request().timeRange);
});
test('actual non-tape render replaces only legacy mode/date presentation; a day commits saved and request state once',()=>{
  const h=harness({toolId:'net-flow',saved:{ticker:'SPY',mode:'latest',date:'2026-10-16'}}),trigger=byLabel(h.holder,'Session Date');
  assert.ok(trigger);assert.equal(trigger.textContent,'Current');assert.equal(h.input('mode').closest().hidden,true);assert.equal(h.input('date').hidden,true);assert.equal(h.input('date').closest().hidden,false);assert.equal(h.input('date').closest().children.find(node=>node.tagName==='LABEL').hidden,true);
  trigger.fire('click');assert.equal(h.loads.length,0);assert.equal(h.timers.length,0);byLabel(h.env.menu,'Previous month').fire('click');assert.equal(h.timers.length,0);byLabel(h.env.menu,'Oct 16, 2026').fire('click');
  assert.equal(h.get('mode'),'historical');assert.equal(h.get('date'),'2026-10-16');assert.equal(h.request().sessionDate,'2026-10-16');assert.equal(h.timers.length,1);assert.equal(h.writes.at(-1)['net-flow'].date,'2026-10-16');assert.equal(h.writes.at(-1)['net-flow'].mode,'historical');
  trigger.fire('click');byText(h.env.menu,'Clear').fire('click');assert.equal(h.get('mode'),'latest');assert.equal(h.get('date'),'');assert.equal(h.request().sessionDate,'2026-11-02');assert.equal(trigger.textContent,'Current');
});

test('actual saved/copied dates and page/global overrides stay distinct and restore own choices',()=>{
  const h=harness({toolId:'net-flow',copied:{c_mode:'historical',c_date:'2026-10-16',c_ticker:'SPY'},global:{sessionDate:'2026-10-19'}}),trigger=byLabel(h.holder,'Session Date');
  assert.equal(trigger.textContent,'Oct 19, 2026');assert.equal(trigger.disabled,true);assert.equal(h.input('date').dataset.overrideOwn,'2026-10-16');assert.equal(h.request().sessionDate,'2026-10-19');h.env.api.saveToolControls();assert.equal(h.writes.at(-1)['net-flow'].date,'2026-10-16');
  h.page.sessionDate='2026-10-20';h.env.api.reflectFilterOverrides();assert.equal(trigger.textContent,'Oct 20, 2026');delete h.page.sessionDate;delete h.global.sessionDate;h.env.api.reflectFilterOverrides();assert.equal(trigger.disabled,false);assert.equal(trigger.textContent,'Oct 16, 2026');assert.equal(h.get('mode'),'historical');assert.equal(h.request().sessionDate,'2026-10-16');
});

test('Exposure ticker change clears prior-contract expiry and replay snapshot while retaining units',()=>{
  const h=harness({toolId:'exposure-by-strike',saved:{ticker:'SPY',expiry:'2026-10-23',mode:'historical',date:'2026-10-16',greek:'GAMMA',representation:'PER_ONE_PERCENT_MOVE'}});
  h.env.snapshotSelections.set('exposure-by-strike',123);h.set('ticker','QQQ');h.env.api.onControlsChanged({target:h.input('ticker')});
  assert.equal(h.get('expiry'),'');assert.equal(h.env.snapshotSelections.size,0);assert.equal(h.request().filter.ticker,'QQQ');assert.equal(h.request().filter.expirationDates,undefined);assert.equal(h.request().representationMode,'PER_ONE_PERCENT_MOVE');
});

test('actual rerender destroys prior calendar and rejects retained date clicks without loading',()=>{
  const h=harness({toolId:'net-flow',saved:{mode:'historical',date:'2026-10-16',ticker:'SPY'}}),trigger=byLabel(h.holder,'Session Date');trigger.fire('click');const previous=h.env.menu,stale=byLabel(previous,'Oct 19, 2026');h.env.api.renderControls(h.tool);
  assert.equal(previous.isConnected,false);stale.fire('click');assert.equal(h.get('date'),'2026-10-16');assert.equal(h.timers.length,0);assert.equal(descendants(h.holder).filter(node=>node.attributes?.['aria-label']==='Session Date').length,1);
});

test('actual Dark Pool range preserves saved values behind the themed range presentation',()=>{
  const tool=definitions.find(tool=>tool.controls.includes('rangeStart'));
  assert.ok(tool,'catalogue includes a range tool');const h=harness({toolId:tool.id,saved:{mode:'latest',rangeStart:'2026-10-10',rangeEnd:'2026-10-19',expiry:'2026-10-30'}});assert.equal(byLabel(h.holder,'Session Date'),undefined);for(const id of ['rangeStart','rangeEnd','levelMetric','topLevels'])assert.equal(h.input(id).closest().hidden,true);assert.equal(h.get('rangeStart'),'2026-10-10');assert.equal(h.get('rangeEnd'),'2026-10-19');if(h.input('expiry'))assert.equal(h.get('expiry'),'2026-10-30');
});

test('actual Dark Pool defaults remain blank/current and range overrides restore explicit saved/copied choices',()=>{
  const fresh=harness({toolId:'dark-pool-levels'});assert.equal(fresh.get('rangeStart'),'');assert.equal(fresh.get('rangeEnd'),'');assert.equal(fresh.get('topLevels'),'50');
  assert.equal(fresh.env.session.monthsVisible,2);assert.equal(fresh.env.session.commitOnSelect,true);assert.equal(fresh.env.session.clearLabel,'Clear');assert.equal(fresh.env.session.emptyHint,'Leave blank for current session');assert.equal(fresh.env.session.businessDayEndpoints,true);
  assert.deepEqual(fresh.request().sessionDateRange,{startDate:'2026-11-02',endDate:'2026-11-02'});
  const h=harness({toolId:'dark-pool-levels',copied:{c_rangeStart:'2026-10-15',c_rangeEnd:'2026-10-16',c_topLevels:'10'},global:{sessionDate:'2026-10-20'}});
  assert.equal(h.env.session.getScope().disabled,true);assert.deepEqual(h.request().sessionDateRange,{startDate:'2026-10-20',endDate:'2026-10-20'});
  delete h.global.sessionDate;h.env.api.reflectFilterOverrides();assert.deepEqual(h.request().sessionDateRange,{startDate:'2026-10-15',endDate:'2026-10-16'});
  h.env.session.onChange({startDate:'',endDate:''});assert.deepEqual(h.request().sessionDateRange,{startDate:'2026-11-02',endDate:'2026-11-02'});
  h.env.api.saveToolControls();assert.equal(h.writes.at(-1)['dark-pool-levels'].rangeStart,'');assert.equal(h.writes.at(-1)['dark-pool-levels'].topLevels,'10');
});
test('actual Exchange calendar preserves legacy session, extends range across EDT/DST and restores authoritative overrides',()=>{
  const h=harness({toolId:'exchange-notifications',realCalendar:true,copied:{c_mode:'historical',c_date:'2026-10-16',c_notificationType:'LUDP'}});
  assert.deepEqual(h.request().sort,{field:'CREATED_TIME',direction:'DESCENDING'});assert.deepEqual(h.request().filter.types,['LUDP']);assert.deepEqual(h.request().timeRange,{startTime:'2026-10-16T13:30:00.000Z',endTime:'2026-10-17T04:00:00.000Z'});
  byLabel(h.holder,'Session Date Range').fire('click');assert.equal(byLabel(h.env.menu,'Oct 17, 2026').disabled,true);byLabel(h.env.menu,'Oct 19, 2026').fire('click');
  assert.equal(h.env.menu.isConnected,false);assert.deepEqual(h.request().timeRange,{startTime:'2026-10-16T04:00:00.000Z',endTime:'2026-10-20T04:00:00.000Z'});assert.equal(h.request().sessionDate,undefined);
  h.set('tapeSessionStart','2026-10-31');h.set('tapeSessionEnd','2026-11-02');assert.deepEqual(h.request().timeRange,{startTime:'2026-10-31T04:00:00.000Z',endTime:'2026-11-03T05:00:00.000Z'});
  h.global.sessionDate='2026-10-16';h.global.tickers=['SPY','QQQ'];h.env.api.reflectFilterOverrides();assert.deepEqual(h.request().timeRange,{startTime:'2026-10-16T13:30:00.000Z',endTime:'2026-10-17T04:00:00.000Z'});assert.deepEqual(h.request().filter.tickers,['SPY','QQQ']);
  delete h.global.sessionDate;delete h.global.tickers;h.env.api.reflectFilterOverrides();assert.equal(h.request().timeRange.endTime,'2026-11-03T05:00:00.000Z');
});

test('actual Exchange Type toolbar and header share positive, negative and cleared filters without OR exclusion errors',()=>{
  const h=harness({toolId:'exchange-notifications',saved:{mode:'historical',date:'2026-10-16',notificationType:'LUDP'}});
  const config=()=>h.env.api.notificationTableConfiguration(h.tool);assert.deepEqual(plain(config().headerFilters),[{field:'TYPE',operator:'EQUALS',value:['LUDP']}]);
  config().onFilterChange({id:'type',field:'TYPE',operator:'DOES_NOT_EQUAL',value:['LUDP','REG_SHO']});assert.equal(h.get('notificationType'),'LUDP, REG_SHO');assert.equal(h.request().filter.types,undefined);
  assert.deepEqual(h.request().filterExpression.filters.map(item=>item.values),[['LUDP'],['REG_SHO']]);
  h.set('notificationType','T1');h.env.api.onControlsChanged({target:h.input('notificationType')});assert.deepEqual(h.request().filter.types,['T1']);assert.equal(config().headerFilters[0].operator,'EQUALS');
  config().onFilterChange({id:'type',field:'TYPE',operator:null,value:null});assert.equal(h.get('notificationType'),'');assert.equal(h.request().filter,undefined);assert.equal(h.request().filterExpression,undefined);
});

test('actual Exchange renderer has one clean header, top Columns, canonical active locks and real server sort dispatch',async()=>{
  const h=harness({toolId:'exchange-notifications',realTable:true,saved:{mode:'historical',date:'2026-10-16',notificationType:'LUDP'}}),load=h.load();
  h.requests[0].resolve({data:[{id:'one',createdTime:1792162000000,ticker:'SPY',type:'LUDP'}]});await load;
  const view=h.env.tableRuntime,table=h.nodes.get('#toolTable'),host=h.nodes.get('#notificationColumnControls');assert.ok(host);assert.equal(host.className,'qtable-compact-column-controls');assert.equal(table.tHead.children.length,1);
  const locked=()=>descendants(host).filter(node=>node.type==='checkbox'&&node.disabled).map(node=>node.parent.children[1].textContent).sort();assert.deepEqual(locked(),['Date','Time']);
  assert.equal(h.tables.at(-1).config.inlineFilters,false);assert.equal(h.tables.at(-1).config.headerMenu,true);assert.equal(h.tables.at(-1).config.fillLastColumn,true);assert.deepEqual(table.tHead.children[0].children.map(node=>node.style.width),['120px','100px','110px','auto']);assert.equal(table.style.minWidth,'440px');assert.equal(h.tables.at(-1).config.autoPaging.getState().enabled,true);assert.equal(h.nodes.get('#loadMore').hidden,true);
  assert.equal(table.tBodies[0].children.length,1);assert.ok(descendants(table.tBodies[0]).some(node=>node.textContent==='LUDP'));
  const assertColumnsHost=()=>{assert.equal(host.className,'qtable-compact-column-controls');assert.equal(descendants(host).find(node=>node.tagName==='DETAILS')?.className,'qtable-columns');assert.equal(descendants(host).find(node=>node.tagName==='SUMMARY')?.textContent,'Columns');};
  assertColumnsHost();view.setVisible('type',false);assertColumnsHost();view.setVisible('type',true);assertColumnsHost();view.render();assertColumnsHost();
  const css=readFileSync(new URL('../../public/gex-data-app/styles.css',import.meta.url),'utf8'),rule=css.match(/\.qtable-compact-column-controls \.qtable-columns > summary \{([^}]+)\}/)?.[1];assert.ok(rule);for(const declaration of ['display:flex','height:24px','font-size:11px','list-style:none','border-radius:18px','background:var(--site-surface'])assert.ok(rule.includes(declaration));assert.match(css,/\.qtable-compact-column-controls \.qtable-columns > summary::\-webkit-details-marker \{ display:none; \}/);
  view.setVisible('date',false);assert.equal(view.getColumns().find(column=>column.id==='date').visible,true);
  view.setSort('ticker',1);assert.deepEqual(h.loads.at(-1).body.sort,{field:'TICKER',direction:'ASCENDING'});assert.deepEqual(locked(),['Ticker']);assert.equal(h.env.toolCursor,null);
  view.destroy();
});

test('actual Exchange pages preserve opaque cursor, replace duplicate IDs and reject stale requests after scope changes',async()=>{
  const h=harness({toolId:'exchange-notifications',saved:{mode:'historical',date:'2026-10-16',notificationType:'LUDP'}});
  const first=h.load();h.requests[0].resolve({data:[{id:'one',type:'LUDP',ticker:'SPY',createdTime:1792162000000}],nextSearchAfter:['opaque',0]});await first;
  const originalScope=h.env.toolPayloadQuery,page=h.load({append:true});assert.deepEqual(h.requests[1].body.searchAfter,['opaque',0]);
  h.requests[1].resolve({data:[{id:'one',type:'LUDP',ticker:'SPY',createdTime:1792162000001},{id:'two',type:'LUDP',ticker:'QQQ',createdTime:1792161000000}]});await page;
  assert.equal(h.env.toolPayloadQuery,originalScope);assert.deepEqual(Array.from(h.tables.at(-1).rows,row=>[row.id,row.createdTime]),[['one',1792162000001],['two',1792161000000]]);assert.equal(h.env.toolCursor,null);
  const stale=h.load();h.set('notificationType','T1');h.env.toolCursor=['stale'];h.env.api.onControlsChanged({target:h.input('notificationType')});assert.equal(h.env.toolCursor,null);
  const current=h.load();assert.equal(h.requests[3].body.searchAfter,undefined);assert.deepEqual(h.requests[3].body.filter.types,['T1']);h.requests[3].resolve({data:[{id:'new',type:'T1'}]});await current;
  h.requests[2].resolve({data:[{id:'stale',type:'LUDP'}]});await stale;assert.deepEqual(Array.from(h.tables.at(-1).rows,row=>row.id),['new']);
});

test('actual Exchange sort-only acquisition keeps current table visible but genuine filter changes clear stale scope',async()=>{
  const h=harness({toolId:'exchange-notifications',realTable:true,saved:{mode:'historical',date:'2026-10-16',notificationType:'LUDP'}}),first=h.load();h.requests[0].resolve({data:[{id:'one',type:'LUDP',ticker:'ZZZ',createdTime:1792162000000}]});await first;
  const previous=h.env.tableRuntime;previous.setSort('ticker',1);assert.equal(h.loads.at(-1).options.retainSortPage,true);
  const sorting=h.load(h.loads.at(-1).options);assert.equal(h.env.tableRuntime,previous);assert.equal(h.env.tableRuntime.getVisibleRows()[0].id,'one');
  h.requests[1].resolve({data:[{id:'two',type:'LUDP',ticker:'AAA',createdTime:1792161000000}]});await sorting;assert.equal(h.env.tableRuntime,previous);assert.equal(h.env.tableRuntime.getVisibleRows()[0].id,'two');
  h.set('notificationType','T1');h.env.api.onControlsChanged({target:h.input('notificationType')});const filtered=h.load({retainSortPage:true});assert.equal(h.nodes.get('#toolTableWrap').hidden,true,'a changed filter may not display another scope under the new controls');assert.equal(h.nodes.get('#toolTable').tBodies[0].children.length,0);assert.equal(h.env.tableRows.length,0);
  h.requests[2].resolve({data:[{id:'new',type:'T1',ticker:'AAA'}]});await filtered;assert.equal(h.env.tableRuntime.getVisibleRows()[0].id,'new');h.env.tableRuntime.destroy();
});

const descendants=node=>[node,...node.children.flatMap(descendants)];
function harness({toolId='order-flow-consolidated',saved,copied,page={},global={},groups=[],realTable=false,realCalendar=false}={}){
  const document={createElement:tag=>new Node(tag,document),createElementNS:(_namespace,tag)=>new Node(tag,document)},holder=document.createElement('div'),nodes=new Map([['#toolControls',holder]]),writes=[],loads=[],requests=[],tables=[],timers=[];
  document.body=document.createElement('body');document.body.append(holder);
  document.createTextNode=text=>({textContent:String(text),children:[]});document.events={};document.addEventListener=(event,fn)=>{(document.events[event]??=[]).push(fn);};document.removeEventListener=(event,fn)=>{document.events[event]=(document.events[event]||[]).filter(value=>value!==fn);};
  const tool=definitions.find(tool=>tool.id===toolId),getNode=key=>{
    if(['#notificationColumnControls','#equityPrintColumnControls','#darkPoolColumnControls','#gainersColumnControls','#marketShareColumnControls'].includes(key)){const liveHost=descendants(holder).find(node=>'#'+node.id===key);if(liveHost){nodes.set(key,liveHost);return liveHost;}}
    if(realTable&&key==='#toolTable thead')return getNode('#toolTable').tHead;if(realTable&&key==='#toolTable tbody')return getNode('#toolTable').tBodies[0];
    if(!nodes.has(key)){
      if(realTable&&key==='#toolTable'){
        const table=document.createElement('table');table.tBodies=[];table.createTHead=()=>{table.tHead=document.createElement('thead');table.append(table.tHead);return table.tHead;};table.createTBody=()=>{const body=document.createElement('tbody');table.tBodies.push(body);table.append(body);return body;};table.createTFoot=()=>{table.tFoot=document.createElement('tfoot');table.append(table.tFoot);return table.tFoot;};table.createTHead();table.createTBody();table.createTFoot();nodes.set(key,table);
      }else nodes.set(key,document.createElement('div'));
    }return nodes.get(key);
  };
  const env={document,console,structuredClone,AbortController,Date,toolControlDefault,numericControlChoices,activeTool:tool,CONTROL_OPTIONS:{printType:[['','Lit + dark'],['DARK_POOL','Dark pool'],['LIT_POOL','Lit pool']]},commonSessionDateControls:null, netDriftContractControls:null,masterReplay:null,
    gainersIndustryChoices,instrumentChoices:()=>[['SPY','SPY'],['QQQ','QQQ']],Option:function(text,value){this.text=text;this.value=value;this.children=[];},
    element:(tag,className='',text='')=>{const node=document.createElement(tag);node.className=className;node.textContent=String(text);return node;},
    q:(selector,root)=>selector==='label'?descendants(root||holder).find(node=>node.tagName==='LABEL'):selector.startsWith('#')?getNode(selector):selector==='.flow-statistics'?getNode('#toolTableWrap').children.find(child=>child.className==='flow-statistics'):descendants(root||holder).find(node=>node.dataset?.control===/data-control="([^"]+)"/.exec(selector)?.[1]),
    qa:(selector,root=holder)=>descendants(root).filter(node=>selector==='label'?node.tagName==='LABEL':!!node.dataset?.control),todayOffset:()=> '2026-11-02',
    savedToolControls:saved?{[toolId]:structuredClone(saved)}:{},VIEW_PARAMETERS:new URLSearchParams(copied?{instance:'copy',...copied}:{}),EMBEDDED:false,
    getFilterOverrides:()=>({page,global}),resolveFilterOverride,normalizeAPIExpression,expirationFilterForTool,restoreSurfaceSelections,persistSurfaceSelections,
    setChoiceValue:(control,value)=>{control.value=value;},multiChoiceDropdown:options=>{const control=document.createElement('input');control.choiceConfiguration=options;control.setChoices=choices=>{control.choices=choices;};return control;},
    apiStatus:{market:{sessionDate:'2026-11-02',optionsSessionDate:'2026-11-02'}},FILTER_GROUP_TOOLS:new Set([toolId]),getFilterGroups:()=>groups,toolGroupIds:{[toolId]:groups.map(group=>group.id)},filterGroupTypeForTool:()=>toolId==='order-flow-consolidated'?'OPTION_TRADES_CONSOLIDATED':'OPTION_TRADES_UNCONSOLIDATED',
    controlsStorageKey:'controls',gexStorage:{getItem:()=>null,setItem:(_key,value)=>writes.push(JSON.parse(value))},toolSeriesOptions:()=>[],syncNetDriftDisplayButtons(){},updateLiveState(){},
    clearTimeout(){},setTimeout:(callback,delay)=>{timers.push({callback,delay});return timers.length;},
    snapshotSelections:new Map(),snapshotKey:()=>tool.id,toolCursor:null,toolPayload:null,toolPayloadQuery:null,equityPageGeneration:0,
    optionTapeRequest,optionTapeSort,optionTapeFilterExpression,optionTapeField,optionTapeColumnFields,optionTapeSessionRange,optionTapeCursor,mergeOptionTapeRows,additionalToolRequest,dataRequestIdentity,
    equityPrintField,equityPrintColumnFields,equityPrintSort,equityPrintFilterExpression,equityPrintRequest,equityPrintCursor,mergeEquityLivePage,mergeLiveTapePage,EQUITY_PRINT_COLUMNS,EXCHANGE_NOTIFICATION_COLUMNS,equitySideColorToken,equityPrintColorToken,notificationColorToken,
    notificationField,notificationColumnFields,notificationSort,notificationFilterExpression,notificationRequest,notificationCursor,notificationReferenceSession,
    mountSessionDateControls,mountDarkPoolLevelLimit,matchesCurrentPayload:()=>false,popup(_anchor,_title,build){const menu=document.createElement('section');document.body.append(menu);build(menu);env.menu=menu;return menu;},mountOptionTapeSessionControls:configuration=>{env.session=configuration;env.sessionSyncs=0;return realCalendar?mountOptionTapeSessionControls(configuration):{sync(){env.sessionSyncs++;},destroy(){}};},
    GAINERS_COLUMNS,gainersModel,MARKET_SHARE_COLUMNS,marketShareTableModel,tableColumns:null,tableRows:[],tableRuntime:null,instanceKey:'test',CONSOLIDATED_COLUMNS,UNCONSOLIDATED_COLUMNS,flowStatisticsModel,
    themePaint:value=>value,compact:(value,money)=>String(money?'$':'')+value,
    createTableView:options=>{if(!realTable)return {setRows:(rows,config)=>tables.push({rows,config}),getColumns:()=>[],render(){}};const view=createTableView(options),setRows=view.setRows;view.setRows=(rows,config)=>{tables.push({rows,config});setRows(rows,config);};return view;},setSummary:items=>{env.summary=items;},
    window:{},frameVisible:true,toolRequestId:0,toolRequestInFlight:false,pendingLiveFrame:false,pollTimer:null,activeController:null,lastToolAttemptAt:0,lastToolSuccessAt:0,
    toolView:document.createElement('section'),updateInitialToolLoading(){},schedulePoll(){},updateToolTimestamp(){},renderSnapshotControl(){},
    activeChartInstance:null,activeChartUpdate:null,activeChartDispose:null,activeChartReset:null,refreshingCanvas:null,
    loadToolPayload:()=>new Promise((resolve,reject)=>requests.push({resolve,reject,body:plain(env.api.buildRequest(tool))})),
  };
  const metaStart=source.indexOf('  const CONTROL_META = {'),metaEnd=source.indexOf('\n  const q =',metaStart),render=actual('renderControls'),stop=render.indexOf("    if(tool.view==='volatilitySkew')");
  const functions=['makeControl','getControl','setControl','reflectFilterOverrides','syncDateControl','saveToolControls','optionTapeSessionScope','optionTapeHeaderFilters','optionTapeTableConfiguration','equityPrintHeaderFilters','equityPrintTableConfiguration','notificationHeaderFilters','notificationTableConfiguration','requestBase','maybeFilter','buildRequest','onControlsChanged','resetStage','showTable','renderFlowStatistics','renderToolPayload','loadActiveTool','receiveLiveToolFrame'];
  vm.runInNewContext(source.slice(metaStart,metaEnd)+functions.map(actual).join('\n')+render.slice(0,stop)+'\n}\nthis.api={reflectFilterOverrides,syncDateControl,renderControls,getControl,setControl,saveToolControls,buildRequest,onControlsChanged,optionTapeTableConfiguration,equityPrintTableConfiguration,notificationTableConfiguration,optionTapeSessionScope,renderToolPayload,loadActiveTool,receiveLiveToolFrame};',env);
  env.api.renderControls(tool);env.loadActiveTool=options=>{loads.push({options,body:plain(env.api.buildRequest(tool))});};
  return {env,tool,holder,nodes,writes,loads,requests,tables,timers,page,global,input:id=>env.q(`[data-control="${id}"]`,holder),get:env.api.getControl,set:env.api.setControl,request:()=>plain(env.api.buildRequest(tool)),configuration:()=>env.api.optionTapeTableConfiguration(tool),load:options=>env.api.loadActiveTool(options)};
}



test('actual Gainers toolbar omits unfiltered ticker but exposes saved and authoritative filters without changing requests',()=>{
  const unfiltered=harness({toolId:'gainers-losers'}),ticker=unfiltered.input('tickerOptional');assert.equal(ticker.closest('.control').hidden,true);
  const saved=harness({toolId:'gainers-losers',saved:{tickerOptional:'SPY'}});assert.equal(saved.input('tickerOptional').closest('.control').hidden,false);assert.deepEqual(saved.request().filter.tickers,['SPY']);assert.equal(descendants(saved.input('tickerOptional').closest('.control')).find(node=>node.tagName==='LABEL').textContent,'Active instrument filter');
  const overridden=harness({toolId:'gainers-losers',global:{tickers:['QQQ','SPY']}});assert.equal(overridden.input('tickerOptional').closest('.control').hidden,false);assert.deepEqual(overridden.request().filter.tickers,['QQQ','SPY']);
  saved.set('tickerOptional','');saved.env.api.onControlsChanged({target:saved.input('tickerOptional')});assert.equal(saved.input('tickerOptional').closest('.control').hidden,true);
  const industries=harness({toolId:'gainers-losers',saved:{industry:'SEMICONDUCTORS, SOFTWARE__INFRASTRUCTURE',sector:'TECHNOLOGY'}});assert.deepEqual(industries.request().filter.industries,['SEMICONDUCTORS','SOFTWARE__INFRASTRUCTURE']);assert.deepEqual(industries.request().filter.sectors,['TECHNOLOGY']);assert.equal(industries.input('industry').choiceConfiguration.searchable,true);industries.set('sector','FINANCIAL_SERVICES');industries.env.api.onControlsChanged({target:industries.input('sector')});assert.equal(industries.get('industry'),'');assert.ok(industries.input('industry').choices.some(([key])=>key==='BANKS__REGIONAL'));assert.equal(industries.input('industry').choices.some(([key])=>key==='SEMICONDUCTORS'),false);
});


test('actual Gainers compact table has themed top Columns, one header, fixed early widths and typed local header filters',async()=>{
  const h=harness({toolId:'gainers-losers',realTable:true,saved:{mode:'historical',date:'2026-10-16'}}),load=h.load();h.requests[0].resolve({data:{AAA:{bullishPremium:100,bearishPremium:50,volume:10,tradeCount:1},BBB:{bullishPremium:200,bearishPremium:20,volume:20,tradeCount:2}}});await load;
  const table=h.nodes.get('#toolTable'),view=h.env.tableRuntime,host=h.nodes.get('#gainersColumnControls'),config=h.tables.at(-1).config;assert.equal(host.className,'qtable-compact-column-controls');assert.equal(table.tHead.children.length,1);assert.equal(config.localHeaderFilters,true);assert.equal(config.inlineFilters,false);assert.equal(config.fillLastColumn,true);assert.equal(table.tHead.children[0].children[0].style.width,'70px');assert.equal(table.tHead.children[0].children.at(-1).style.width,'auto');
  const filter=id=>descendants(table.tHead).find(node=>node.dataset?.columnId===id).children.find(node=>node.className?.startsWith('qtable-header-filter'));
  assert.equal(filter('rank'),undefined);filter('bullishPremium').fire('click');let menu=h.env.document.body.children.find(node=>node.className==='qtable-header-menu'),form=descendants(menu).find(node=>node.tagName==='FORM'),input=descendants(form).find(node=>node.tagName==='INPUT');assert.equal(input.inputMode,'decimal');input.value='>=150';form.events.submit[0]({preventDefault(){}});assert.deepEqual(view.getVisibleRows().map(row=>row.ticker),['BBB']);
  filter('bullishPremium').fire('click');menu=h.env.document.body.children.find(node=>node.className==='qtable-header-menu');descendants(menu).find(node=>node.textContent==='Clear').fire('click');assert.equal(view.getVisibleRows().length,2);
  filter('ticker').fire('click');menu=h.env.document.body.children.find(node=>node.className==='qtable-header-menu');form=descendants(menu).find(node=>node.tagName==='FORM');input=descendants(form).find(node=>node.tagName==='INPUT');input.value='=AAA';form.events.submit[0]({preventDefault(){}});assert.deepEqual(view.getVisibleRows().map(row=>row.ticker),['AAA']);
  assert.equal(h.requests.length,1,'loaded-row filter does not invent a provider filter request');view.destroy();
});


test('both Market Share actual calendars preserve legacy date, clear same day and extend inclusive range without changing filter scope',()=>{
 for(const toolId of ['market-share','market-share-table']){
  const h=harness({toolId,realCalendar:true,saved:{mode:'historical',date:'2026-10-16',tickerOptional:'SPY'}});assert.equal(h.request().sessionDate,'2026-10-16');assert.equal(h.input('date').closest('.control').hidden,true);assert.equal(h.env.session.monthsVisible,2);
  byLabel(h.holder,'Session Date Range').fire('click');byLabel(h.env.menu,'Oct 16, 2026').fire('click');assert.equal(h.get('tapeSessionStart'),'');assert.equal(h.get('tapeSessionEnd'),'');byLabel(h.env.menu,'Oct 19, 2026').fire('click');assert.equal(h.request().sessionDate,'2026-10-19');byLabel(h.env.menu,'Oct 16, 2026').fire('click');assert.deepEqual(h.request().timeRange,{startTime:'2026-10-16T04:00:00.000Z',endTime:'2026-10-20T04:00:00.000Z'});assert.equal(h.request().sessionDate,undefined);assert.deepEqual(h.request().filter.tickers,['SPY']);
  h.global.sessionDate='2026-11-02';h.env.api.reflectFilterOverrides();assert.equal(h.request().sessionDate,'2026-11-02');assert.equal(h.request().timeRange,undefined);delete h.global.sessionDate;h.env.api.reflectFilterOverrides();assert.equal(h.request().timeRange.endTime,'2026-10-20T04:00:00.000Z');
 }
});
test('actual Market Share Table keeps raw full values and ALL footer with compact top Columns and current-sort visibility lock',async()=>{
 const h=harness({toolId:'market-share-table',realTable:true,saved:{mode:'historical',date:'2026-10-16'}}),load=h.load();h.requests[0].resolve({data:{BATS:{equityCallVolume:1234567,equityPutVolume:3,indexVolume:1,equityCallPremium:1234567,equityPutPremium:3,indexPremium:1,equityCallTradeCount:3,equityPutTradeCount:2,indexTradeCount:1},ALL:{equityCallVolume:999999999}}});await load;
 const table=h.nodes.get('#toolTable'),host=h.nodes.get('#marketShareColumnControls'),view=h.env.tableRuntime,config=h.tables.at(-1).config;assert.equal(host.className,'qtable-compact-column-controls');assert.equal(config.inlineFilters,false);assert.equal(config.localHeaderFilters,false);assert.equal(table.tHead.children.length,1);assert.equal(table.tBodies[0].children.length,1);assert.ok(descendants(table.tBodies[0]).some(node=>node.textContent==='1,234,567'));assert.ok(descendants(table.tBodies[0]).some(node=>node.textContent==='$1,234,567'));assert.equal(table.tFoot.children.length,1);assert.equal(table.tHead.children[0].children.at(-1).style.width,'auto');
 const choices=()=>descendants(host).filter(node=>node.type==='checkbox'&&node.disabled).map(node=>node.parent.children[1].textContent);assert.deepEqual(choices(),['Equity Volume']);view.setSort('totalPremium',-1);assert.deepEqual(choices(),['Total Premium']);assert.equal(descendants(table.tHead).some(node=>node.className?.startsWith('qtable-header-filter')),false);view.destroy();
});
