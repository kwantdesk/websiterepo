import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {additionalToolRequest} from '../public/gex-data-app/additional-tool-requests.js';
import {optionTapeRequest,optionTapeSort,optionTapeFilterExpression,optionTapeSessionRange} from '../public/gex-data-app/option-tape-interaction-model.js';
import {newsFeedRequest,newsDayRange} from '../public/gex-data-app/news-feed-model.js';
import {resolveFilterOverride,normalizeAPIExpression,expirationFilterForTool} from '../public/gex-data-app/preferences-model.js';
import {UNCONSOLIDATED_COLUMNS,OPTION_TRADE_DETAIL_ENDPOINT} from '../public/gex-data-app/option-trade-detail-model.js';
import {filterFieldsForTool} from '../public/gex-data-app/filter-editor-model.js';
import {OPTIONS_FLOW_TOOLS} from '../src/lib/optionsFlowTools.ts';
import {GEX_DATA_TOOLS,validateGexDataRequest} from '../src/lib/gexDataPolicy.ts';

const app=readFileSync(new URL('../public/gex-data-app/app.js',import.meta.url),'utf8');
const definitions=vm.runInNewContext(app.slice(app.indexOf('const TOOL_DEFINITIONS = [')+'const TOOL_DEFINITIONS = '.length,app.indexOf('\n  ];',app.indexOf('const TOOL_DEFINITIONS = ['))+5));
const ids=['order-flow-unconsolidated','net-flow','volatility-drift','volatility-skew','term-structure','open-interest-by-strike','open-interest-by-expiration','open-interest-over-time','open-interest-change'];
const plain=value=>JSON.parse(JSON.stringify(value));
function requestFor(tool,values={},page={},global={}){
  const context={additionalToolRequest,optionTapeRequest,optionTapeSort,optionTapeFilterExpression,optionTapeSessionRange,masterReplay:null,newsFeedRequest,gexTimeZone:()=> 'Australia/Brisbane',structuredClone,requestBase:()=>({sessionDate:'2026-11-02'}),
    getControl:key=>tool.controls.includes(key)?values[key]||'':'',toolCursor:null,
    getFilterOverrides:()=>({page,global}),resolveFilterOverride,normalizeAPIExpression,expirationFilterForTool,
    FILTER_GROUP_TOOLS:new Set(['order-flow-unconsolidated','net-flow']),getFilterGroups:()=>[],toolGroupIds:{}};
  const headerStart=app.indexOf('  function optionTapeHeaderFilters('),headerTail=app.slice(headerStart),headerEnd=/\n  (?:async )?function /.exec(headerTail)?.index;
  assert.ok(headerStart>0&&headerEnd>0);
  vm.runInNewContext(headerTail.slice(0,headerEnd)+app.slice(app.indexOf('  function maybeFilter('),app.indexOf('  async function toolFetch('))+'\nthis.build=buildRequest;',context);
  return plain(context.build(tool));
}

test('nine additional catalogue tools have distinct licensed routes and real chart-picker entries',()=>{
  assert.equal(definitions.length,31);
  assert.ok(definitions.every(tool=>Object.hasOwn(GEX_DATA_TOOLS,tool.endpoint)));
  assert.ok(OPTIONS_FLOW_TOOLS.every(tool=>tool.toolId!=='exposure-forecast'));
  const routes=[];
  for(const id of ids){
    const matches=definitions.filter(tool=>tool.id===id);assert.equal(matches.length,1,id);
    const tool=matches[0];assert.equal(tool.endpoint,id);
    const route=GEX_DATA_TOOLS[tool.endpoint];assert.equal(route.surface,'options');
    routes.push(`/v1/options/tool/${route.path||tool.endpoint}`);
    const panel=OPTIONS_FLOW_TOOLS.filter(tool=>tool.source==='gex-data'&&tool.toolId===id);
    assert.equal(panel.length,1,id);assert.equal(panel[0].id,`options-flow:gex-data:${id}`);
    const request=requestFor(tool,{ticker:'SPY',flowMetric:'NET_VOLUME',period:'5m'});
    assert.deepEqual(plain(validateGexDataRequest(tool.endpoint,request)),request);
  }
  assert.equal(new Set(routes).size,9);
  assert.ok(routes.includes('/v1/options/tool/order-flow/unconsolidated'));
  assert.ok(routes.includes('/v1/options/tool/net-flow'));
  assert.ok(!routes.includes('/v1/options/tool/net-drift'));
});

test('individual execution tape and drilldown share raw schema without consolidated-only fields',()=>{
  assert.equal(OPTION_TRADE_DETAIL_ENDPOINT,'order-flow-unconsolidated');
  assert.ok(UNCONSOLIDATED_COLUMNS.some(column=>column.key==='premium'));
  assert.ok(UNCONSOLIDATED_COLUMNS.some(column=>column.key==='optionPrice'&&column.type==='priceSide'));
  assert.ok(UNCONSOLIDATED_COLUMNS.every(column=>column.key!=='tradeConsolidationType'));
  assert.match(app,/tool\.id==='order-flow-unconsolidated'\?UNCONSOLIDATED_COLUMNS:CONSOLIDATED_COLUMNS/);
  assert.match(app,/columns:individual\?UNCONSOLIDATED_COLUMNS:CONSOLIDATED_COLUMNS/);
  assert.ok(!filterFieldsForTool('order-flow-unconsolidated').some(field=>field.api==='TRADE_CONSOLIDATION_TYPE'));
  assert.ok(filterFieldsForTool('order-flow-consolidated').some(field=>field.api==='TRADE_CONSOLIDATION_TYPE'));
});

test('actual request path applies page/global overrides before final endpoint-specific projection',()=>{
  const page={tickers:['QQQ'],expirationDate:'2026-11-06',sessionDate:'2026-10-30'};
  for(const id of ['volatility-drift','open-interest-by-strike','open-interest-over-time']){
    const tool=definitions.find(tool=>tool.id===id);
    const request=requestFor(tool,{ticker:'SPY',expiry:'2026-11-20'},page);
    assert.equal(request.filter.ticker,'QQQ',id);
    assert.equal(request.filter.expirationDate,'2026-11-06',id);
    assert.equal(request.filter.expirationDates,undefined,id);
    assert.equal(request.sessionDate,id==='open-interest-over-time'?undefined:'2026-10-30',id);
    assert.deepEqual(plain(validateGexDataRequest(id,request)),request);
  }
  const tool=definitions.find(tool=>tool.id==='net-flow');
  const request=requestFor(tool,{ticker:'SPY',flowMetric:'NET_VOLUME',period:'5m'},page);
  assert.equal(request.dataMode,'NET_VOLUME');assert.equal(request.filter.ticker,'QQQ');assert.equal(request.aggregationPeriod,undefined);assert.ok(!tool.controls.includes('period'),'the reference Net Flow chart uses fixed one-minute observations and drilldown windows');
  assert.match(app,/return additionalToolRequest\(tool.id,controls,body\)/);
});

test('News Feed catalogue and actual final request preserve multiple ticker overrides and website-zone history',()=>{
  const tool=definitions.find(tool=>tool.id==='news-articles');assert.ok(tool);assert.equal(tool.endpoint,'news-articles');assert.equal(tool.view,'newsFeed');
  assert.ok(OPTIONS_FLOW_TOOLS.some(panel=>panel.id==='options-flow:gex-data:news-articles'));
  const page={tickers:['QQQ','SPY'],sessionDate:'2026-11-01',expirationDate:'2026-11-06'};
  const request=requestFor(tool,{mode:'latest',tickerOptional:'AAPL',newsTopic:'EARNINGS,TECH',newsBody:'SHOW'},page);
  assert.deepEqual(request.filter,{tickers:['QQQ','SPY'],topics:['EARNINGS','TECH']});
  assert.deepEqual(request.timeRange,newsDayRange('2026-11-01','Australia/Brisbane'));assert.equal(request.includeBody,true);assert.equal(request.sessionDate,undefined);
  assert.deepEqual(plain(validateGexDataRequest('news-articles',request)),request);
});
