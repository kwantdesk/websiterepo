import {notificationReferenceSession} from '../../public/gex-data-app/exchange-notification-interaction-model.js';
import {numericControlChoices} from '../../public/gex-data-app/numeric-control-options.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {optionTapeRequest,optionTapeSort,optionTapeFilterExpression,optionTapeField,optionTapeColumnFields,optionTapeSessionRange,optionTapeCursor,mergeOptionTapeRows} from '../../public/gex-data-app/option-tape-interaction-model.js';
import {additionalToolRequest} from '../../public/gex-data-app/additional-tool-requests.js';
import {toolControlDefault} from '../../public/gex-data-app/tool-control-defaults.js';
import {resolveFilterOverride,normalizeAPIExpression,expirationFilterForTool} from '../../public/gex-data-app/preferences-model.js';
import {restoreSurfaceSelections,persistSurfaceSelections} from '../../public/gex-data-app/surface-selection-storage.js';
import {dataRequestIdentity} from '../../public/gex-data-app/live-chart-model.js';
import {CONSOLIDATED_COLUMNS,flowStatisticsModel} from '../../public/gex-data-app/options-models.js';
import {UNCONSOLIDATED_COLUMNS} from '../../public/gex-data-app/option-trade-detail-model.js';
import {validateGexDataRequest} from '../../src/lib/gexDataPolicy.ts';

const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),plain=value=>JSON.parse(JSON.stringify(value));
const definitions=vm.runInNewContext(source.slice(source.indexOf('const TOOL_DEFINITIONS = [')+'const TOOL_DEFINITIONS = '.length,source.indexOf('\n  ];',source.indexOf('const TOOL_DEFINITIONS = ['))+5));
function actual(name){const start=new RegExp(`^  (?:async )?function ${name}\\(`,'m').exec(source);assert.ok(start,name);const tail=source.slice(start.index+start[0].length),end=/^  (?:async )?function /m.exec(tail);assert.ok(end);return source.slice(start.index,start.index+start[0].length+end.index);}
class Node{
  constructor(tag='div',document){this.tagName=tag.toUpperCase();this.ownerDocument=document;this.dataset={};this.children=[];this.options=[];this._value='';this._type='';this.style={};this.attributes={};this.events={};this.classList={add(){},remove(){},toggle(){}};this.textContent='';}
  get value(){return this._value;}set value(value){const text=String(value);this._value=this._type==='number'&&text!==''&&(!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)||!Number.isFinite(Number(text)))?'':text;}
  get type(){return this._type;}set type(value){this._type=value;this.value=this._value;}
  append(...children){for(const child of children){child.remove?.();child.parent=this;this.children.push(child);}}
  prepend(...children){this.append(...children);this.children=[...children,...this.children.filter(child=>!children.includes(child))];}
  replaceChildren(...children){this.children.forEach(child=>{child.parent=null;});this.children=[];this.append(...children);}
  insertBefore(child,reference){this.append(child);const before=this.children.indexOf(reference);if(before>=0){this.children.pop();this.children.splice(before,0,child);}}
  add(option){this.options.push(option);this.children.push(option);if(this.options.length===1)this.value=option.value;}
  closest(){return this.parent;}setAttribute(key,value){this.attributes[key]=value;}addEventListener(event,callback){(this.events[event]||=[]).push(callback);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
}
const descendants=node=>[node,...node.children.flatMap(descendants)];
function harness({toolId='order-flow-consolidated',saved,copied,page={},global={},groups=[]}={}){
  const document={createElement:tag=>new Node(tag,document),createElementNS:(_namespace,tag)=>new Node(tag,document)},holder=document.createElement('div'),nodes=new Map([['#toolControls',holder]]),writes=[],loads=[],requests=[],tables=[],timers=[];
  const tool=definitions.find(tool=>tool.id===toolId),getNode=key=>{if(!nodes.has(key))nodes.set(key,document.createElement('div'));return nodes.get(key);};
  const env={document,console,structuredClone,AbortController,Date,toolControlDefault,numericControlChoices,activeTool:tool,CONTROL_OPTIONS:{},commonSessionDateControls:null, netDriftContractControls:null,masterReplay:null,
    instrumentChoices:()=>[['SPY','SPY'],['QQQ','QQQ']],Option:function(text,value){this.text=text;this.value=value;this.children=[];},
    element:(tag,className='',text='')=>{const node=document.createElement(tag);node.className=className;node.textContent=String(text);return node;},
    q:(selector,root)=>selector.startsWith('#')?getNode(selector):selector==='.flow-statistics'?getNode('#toolTableWrap').children.find(child=>child.className==='flow-statistics'):descendants(root||holder).find(node=>node.dataset?.control===/data-control="([^"]+)"/.exec(selector)?.[1]),
    qa:(_selector,root=holder)=>descendants(root).filter(node=>node.dataset?.control),todayOffset:()=> '2026-11-02',
    savedToolControls:saved?{[toolId]:structuredClone(saved)}:{},VIEW_PARAMETERS:new URLSearchParams(copied?{instance:'copy',...copied}:{}),EMBEDDED:false,
    getFilterOverrides:()=>({page,global}),resolveFilterOverride,normalizeAPIExpression,expirationFilterForTool,restoreSurfaceSelections,persistSurfaceSelections,
    setChoiceValue:(control,value)=>{control.value=value;},multiChoiceDropdown:()=>document.createElement('input'),
    apiStatus:{market:{sessionDate:'2026-11-02',optionsSessionDate:'2026-11-02'}},FILTER_GROUP_TOOLS:new Set([toolId]),getFilterGroups:()=>groups,toolGroupIds:{[toolId]:groups.map(group=>group.id)},filterGroupTypeForTool:()=>toolId==='order-flow-consolidated'?'OPTION_TRADES_CONSOLIDATED':'OPTION_TRADES_UNCONSOLIDATED',
    controlsStorageKey:'controls',gexStorage:{getItem:()=>null,setItem:(_key,value)=>writes.push(JSON.parse(value))},toolSeriesOptions:()=>[],syncNetDriftDisplayButtons(){},updateLiveState(){},
    clearTimeout(){},setTimeout:(callback,delay)=>{timers.push({callback,delay});return timers.length;},
    snapshotSelections:new Map(),snapshotKey:()=>tool.id,toolCursor:null,toolPayload:null,toolPayloadQuery:null,
    optionTapeRequest,optionTapeSort,optionTapeFilterExpression,optionTapeField,optionTapeColumnFields,optionTapeSessionRange,optionTapeCursor,mergeOptionTapeRows,additionalToolRequest,dataRequestIdentity,notificationReferenceSession,
    popup(){},mountOptionTapeSessionControls:configuration=>{env.session=configuration;env.sessionSyncs=0;return {sync(){env.sessionSyncs++;},destroy(){}};},
    tableColumns:null,tableRows:[],tableRuntime:null,instanceKey:'test',CONSOLIDATED_COLUMNS,UNCONSOLIDATED_COLUMNS,flowStatisticsModel,
    themePaint:value=>value,compact:(value,money)=>String(money?'$':'')+value,
    createTableView:()=>({setRows:(rows,config)=>tables.push({rows,config}),getColumns:()=>[],render(){}}),setSummary:items=>{env.summary=items;},
    window:{},frameVisible:true,toolRequestId:0,toolRequestInFlight:false,pendingLiveFrame:false,pollTimer:null,activeController:null,lastToolAttemptAt:0,lastToolSuccessAt:0,
    toolView:document.createElement('section'),updateInitialToolLoading(){},schedulePoll(){},updateToolTimestamp(){},renderSnapshotControl(){},
    activeChartInstance:null,activeChartUpdate:null,activeChartDispose:null,activeChartReset:null,refreshingCanvas:null,
    loadToolPayload:()=>new Promise((resolve,reject)=>requests.push({resolve,reject,body:plain(env.api.buildRequest(tool))})),
  };
  const metaStart=source.indexOf('  const CONTROL_META = {'),metaEnd=source.indexOf('\n  const q =',metaStart),render=actual('renderControls'),stop=render.indexOf("    if(tool.view==='volatilitySkew')");
  const functions=['makeControl','getControl','setControl','reflectFilterOverrides','syncDateControl','saveToolControls','optionTapeSessionScope','optionTapeHeaderFilters','optionTapeTableConfiguration','requestBase','maybeFilter','buildRequest','onControlsChanged','resetStage','syncGainersHeaderSort','showTable','renderFlowStatistics','renderToolPayload','loadActiveTool'];
  vm.runInNewContext(source.slice(metaStart,metaEnd)+functions.map(actual).join('\n')+render.slice(0,stop)+'\n}\nthis.api={renderControls,getControl,setControl,saveToolControls,buildRequest,onControlsChanged,optionTapeTableConfiguration,optionTapeSessionScope,renderToolPayload,loadActiveTool};',env);
  env.api.renderControls(tool);env.loadActiveTool=options=>{loads.push({options,body:plain(env.api.buildRequest(tool))});};
  return {env,tool,nodes,writes,loads,requests,tables,timers,page,global,input:id=>env.q(`[data-control="${id}"]`,holder),get:env.api.getControl,set:env.api.setControl,request:()=>plain(env.api.buildRequest(tool)),configuration:()=>env.api.optionTapeTableConfiguration(tool),load:options=>env.api.loadActiveTool(options)};
}

for(const toolId of ['order-flow-consolidated','order-flow-unconsolidated']){
test(`${toolId}: actual factory restores copied sort/filter/date state and saved values take precedence`,()=>{
  const filters=[{id:'premium',field:'PREMIUM',operator:'GREATER_THAN',value:100000}],copied={c_mode:'historical',c_date:'2026-10-16',c_ticker:'SPY',c_tapeSortField:'STRIKE_PRICE',c_tapeSortDirection:'ASCENDING',c_tapeFilters:JSON.stringify(filters),c_tapeSessionStart:'2026-10-16',c_tapeSessionEnd:'2026-10-19'};
  const h=harness({toolId,copied});assert.equal(h.get('ticker'),'SPY');assert.equal(h.get('tapeSortField'),'STRIKE_PRICE');assert.equal(h.input('tapeFilters').type,'hidden');assert.deepEqual(h.request().sort,{field:'STRIKE_PRICE',direction:'ASCENDING'});
  assert.deepEqual(h.request().filterExpression,optionTapeFilterExpression(filters,toolId));assert.deepEqual(h.request().timeRange,optionTapeSessionRange({startDate:'2026-10-16',endDate:'2026-10-19'}).timeRange);assert.equal(h.request().sessionDate,undefined);
  h.env.api.saveToolControls();const saved=h.writes.at(-1)[toolId];assert.equal(saved.tapeFilters,JSON.stringify(filters));assert.equal(saved.tapeSessionEnd,'2026-10-19');
  const restored=harness({toolId,saved,copied:{...copied,c_ticker:'QQQ',c_tapeSortField:'PREMIUM'}});assert.equal(restored.get('ticker'),'SPY');assert.equal(restored.get('tapeSortField'),'STRIKE_PRICE');assert.deepEqual(plain(validateGexDataRequest(toolId,h.request())),h.request());
});
test(`${toolId}: legacy historical controls migrate once, explicit Current wins, overrides never overwrite saved range`,()=>{
  const old=harness({toolId,saved:{mode:'historical',date:'2026-10-16',ticker:'SPY'}});assert.equal(old.get('tapeSessionStart'),'2026-10-16');assert.equal(old.get('tapeSessionEnd'),'2026-10-16');assert.equal(old.request().sessionDate,'2026-10-16');
  const current=harness({toolId,copied:{c_mode:'historical',c_date:'2026-10-16',c_tapeSessionStart:'',c_tapeSessionEnd:''},global:{sessionDate:'2026-10-30'}});assert.equal(current.get('tapeSessionStart'),'');assert.equal(current.env.session.getScope().disabled,true);assert.equal(current.request().sessionDate,'2026-10-30');assert.equal(current.request().timeRange,undefined);
  delete current.global.sessionDate;assert.equal(current.get('mode'),'latest');if(toolId==='order-flow-consolidated')assert.deepEqual(current.request().timeRange,{startTime:'2026-11-02T14:30:00.000Z',endTime:'2026-11-03T05:00:00.000Z'});else assert.equal(current.request().sessionDate,'2026-11-02');
  const range=harness({toolId,saved:{tapeSessionStart:'2026-10-16',tapeSessionEnd:'2026-10-19'},page:{sessionDate:'2026-10-23'}});assert.equal(range.request().sessionDate,'2026-10-23');assert.equal(range.request().timeRange,undefined);assert.equal(range.get('tapeSessionStart'),'2026-10-16');delete range.page.sessionDate;assert.ok(range.request().timeRange);
});
test(`${toolId}: Session picker changes are saved through actual controls, including Current and full range`,()=>{
  const h=harness({toolId,saved:{mode:'historical',date:'2026-10-16',ticker:'SPY'}});h.env.toolCursor=['old'];
  h.env.session.onChange({startDate:'2026-10-16',endDate:'2026-10-19'});assert.equal(h.env.toolCursor,null);assert.equal(h.get('mode'),'historical');assert.ok(h.request().timeRange);assert.equal(h.input('date').closest().hidden,true);assert.equal(h.timers.at(-1).delay,180);
  h.env.session.onChange({startDate:'',endDate:''});assert.equal(h.get('mode'),'latest');if(toolId==='order-flow-consolidated'){assert.deepEqual(h.request().timeRange,{startTime:'2026-11-02T14:30:00.000Z',endTime:'2026-11-03T05:00:00.000Z'});assert.equal(h.request().sessionDate,undefined);}else{assert.equal(h.request().timeRange,undefined);assert.equal(h.request().sessionDate,'2026-11-02');}assert.equal(h.writes.at(-1)[toolId].tapeSessionStart,'');
});
test(`${toolId}: atomic provider sort and typed header filters retain scope, compose groups, reset cursor and avoid no-op requests`,()=>{
  const group={id:'g1',type:toolId==='order-flow-consolidated'?'OPTION_TRADES_CONSOLIDATED':'OPTION_TRADES_UNCONSOLIDATED',expression:{field:'VOLUME',operation:'GREATER_THAN',values:[1000]}},h=harness({toolId,saved:{mode:'historical',date:'2026-10-16',ticker:'SPY'},groups:[group]});
  h.env.toolCursor=['opaque'];const config=h.configuration();config.onSortChange({id:'contract',key:'strikePrice',field:'STRIKE_PRICE',direction:1});assert.equal(h.env.toolCursor,null);assert.equal(h.loads.length,1);assert.deepEqual(h.loads[0].body.sort,{field:'STRIKE_PRICE',direction:'ASCENDING'});assert.equal(h.loads[0].body.filter.ticker,'SPY');assert.equal(h.loads[0].body.sessionDate,'2026-10-16');assert.equal(h.loads[0].options.retainSortPage,true);config.onSortChange({field:'STRIKE_PRICE',direction:1});assert.equal(h.loads.length,1);
  config.onFilterChange({id:'premium',key:'premium',field:'PREMIUM',operator:'GREATER_THAN',value:100000});assert.equal(h.loads.length,2);assert.equal(h.loads[1].body.filterExpression.filters.length,2);assert.deepEqual(h.loads[1].body.filterExpression.filters[1],optionTapeFilterExpression([{field:'PREMIUM',operator:'GREATER_THAN',value:100000}],toolId));
  config.onFilterChange({id:'premium',key:'premium',field:'PREMIUM',operator:null});assert.equal(h.loads.length,3);assert.deepEqual(h.loads[2].body.filterExpression,normalizeAPIExpression({conjunction:'AND',filters:[group.expression]}));assert.equal(h.get('tapeFilters'),'[]');
  config.onSortChange({id:'contract',field:'STRIKE_PRICE',direction:null});assert.deepEqual(h.loads.at(-1).body.sort,{field:'TRADE_TIME',direction:'DESCENDING'});assert.throws(()=>config.onFilterChange({field:'PREMIUM',operator:'CONTAINS',value:'100'}));assert.equal(h.loads.length,4);
});
test(`${toolId}: rendering forwards server header menus and four full-session rings, not page-row totals`,()=>{
  const h=harness({toolId,saved:{mode:'historical',date:'2026-10-16',ticker:'SPY'}}),statistics={CALL:{ASK:{tradeCount:100,premium:10000000,volume:100000}},PUT:{BID:{tradeCount:200,premium:20000000,volume:200000}}};
  h.env.api.renderToolPayload(h.tool,{data:[{id:'one',ticker:'SPY',premium:1}],statistics});const {config}=h.tables.at(-1);assert.equal(config.headerMenu,true);assert.equal(typeof config.onSortChange,'function');assert.equal(typeof config.onFilterChange,'function');assert.deepEqual(config.columns.find(column=>column.key==='contract').filterFields.map(field=>field.field),['TICKER','EXPIRATION_DATE','STRIKE_PRICE','CONTRACT_TYPE']);
  const rings=h.env.q('#toolTableWrap').children.find(child=>child.className==='flow-statistics');assert.equal(rings.children.length,4);const text=descendants(rings).map(node=>node.textContent).join('|');assert.match(text,/200000 \/ 100000/);assert.match(text,/\$20000000 \/ \$10000000/);assert.doesNotMatch(text,/\$1 \/ \$0/);
  for(const id of ['date','time']){const column=config.columns.find(column=>column.id===id);assert.equal(column.sortField,'TRADE_TIME');assert.equal(column.filterFields.length,0,'source Date/Time headers sort but do not expose column filtering');}
});
test(`${toolId}: clicked Date/Time header persists across response redraw, saved restore and copied URLs without adding another DTO field`,()=>{
  const h=harness({toolId,saved:{mode:'historical',date:'2026-10-16',ticker:'SPY'}}),payload={data:[{id:'trade',tradeTime:1792180800000}]};
  assert.equal(h.configuration().sortId,'time');const original=h.request();
  for(const id of ['date','time']){
    h.configuration().onSortChange({id,key:'tradeTime',field:'TRADE_TIME',direction:-1});assert.equal(h.loads.length,0,'changing only the indicated header must not refetch identical provider order');assert.equal(h.get('tapeSortColumn'),id);
    h.env.api.renderToolPayload(h.tool,payload);const config=h.tables.at(-1).config;assert.equal(config.sortId,id);assert.equal(config.sortKey,'TRADE_TIME');assert.deepEqual(h.request(),original,'UI-only column is never added to the API DTO');
    const saved=h.writes.at(-1)[toolId];assert.equal(saved.tapeSortColumn,id);const restored=harness({toolId,saved});assert.equal(restored.configuration().sortId,id);
    const copied=harness({toolId,copied:{c_mode:'historical',c_date:'2026-10-16',c_ticker:'SPY',c_tapeSortColumn:id,c_tapeSortField:'TRADE_TIME',c_tapeSortDirection:'DESCENDING'}});assert.equal(copied.configuration().sortId,id);assert.deepEqual(copied.request().sort,{field:'TRADE_TIME',direction:'DESCENDING'});
  }
});
}

test('Unconsolidated global and page ticker overrides keep every ticker and preserve filters',()=>{
  const h=harness({toolId:'order-flow-unconsolidated',global:{tickers:['SPY','QQQ']},saved:{ticker:'AMD',expiry:'2026-10-23',strike:705.5}});assert.deepEqual(h.request().filter.tickers,['SPY','QQQ']);assert.equal(h.request().filter.ticker,undefined);assert.deepEqual(h.request().filter.strikePrices,[705.5]);h.page.tickers=['NDX','SPX'];assert.deepEqual(h.request().filter.tickers,['NDX','SPX']);
});
test('actual paged tape lifecycle preserves first-page statistics, deduplicates IDs, clones opaque cursors, and excludes response-only flags from query identity',async()=>{
  const h=harness({toolId:'order-flow-unconsolidated',saved:{ticker:'SPY'}}),statistics={CALL:{ASK:{tradeCount:1000,premium:500000,volume:20000}}};
  const first=h.load();assert.equal(h.requests[0].body.includeStatistics,true);h.requests[0].resolve({data:[{id:'a'},{id:'b',premium:1}],statistics,nextSearchAfter:['t','id-b']});await first;
  const query=h.env.toolPayloadQuery,cursor=h.env.toolCursor;assert.deepEqual(plain(cursor),['t','id-b']);assert.notEqual(cursor,h.env.toolPayload.nextSearchAfter);
  const more=h.load({append:true});assert.equal(h.requests[1].body.includeStatistics,false);assert.deepEqual(h.requests[1].body.searchAfter,['t','id-b']);h.requests[1].resolve({data:[{id:'b',premium:2},{id:'c'}],statistics:{},nextSearchAfter:['u','id-c']});await more;
  assert.deepEqual(h.env.toolPayload.data.map(row=>row.id),['a','b','c']);assert.equal(h.env.toolPayload.data[1].premium,2);assert.equal(h.env.toolPayload.statistics,statistics);assert.equal(h.env.toolPayloadQuery,query);
  const prior=h.env.toolPayload,refresh=h.load();assert.equal(h.requests[2].body.includeStatistics,true);assert.equal(h.env.toolPayload,prior,'metadata flag change must not blank the current tape while refreshing');h.requests[2].reject(Error('Unavailable'));await refresh;assert.equal(h.env.toolPayload,prior);
});
