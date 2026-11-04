import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {additionalToolRequest} from '../public/gex-data-app/additional-tool-requests.js';
import {prepareDarkPoolLevels} from '../public/gex-data-app/equity-renderers.js';
import {equityPrintRequest} from '../public/gex-data-app/equity-print-interaction-model.js';
import {notificationRequest} from '../public/gex-data-app/exchange-notification-interaction-model.js';
const app=readFileSync(new URL('../public/gex-data-app/app.js',import.meta.url),'utf8');
test('Interval Map starts at the reference five-minute interval without changing other tools',()=>{
 assert.match(app,/if \(id === "period" && activeTool\?\.id === "interval-map"\) input.value = "5m"/);
});
test('Dark Pool Levels uses its only accepted date selector: sessionDateRange',()=>{
  const values={ticker:'SPY',rangeStart:'2026-10-16',rangeEnd:'2026-10-16'};
  const context={additionalToolRequest,requestBase:()=>({sessionDate:'2026-10-19'}),getControl:key=>values[key]||'',toolCursor:null,
    getFilterOverrides:()=>({page:{},global:{}}),resolveFilterOverride:()=>({type:'NONE'}),FILTER_GROUP_TOOLS:new Set()};
  vm.runInNewContext(app.slice(app.indexOf('  function maybeFilter('),app.indexOf('  async function toolFetch('))+'\nthis.build=buildRequest;',context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.build({id:'dark-pool-levels',controls:[]}))),{filter:{ticker:'SPY'},sessionDateRange:{startDate:'2026-10-16',endDate:'2026-10-16'}});
  context.resolveFilterOverride=({isTicker})=>isTicker?{type:'NONE'}:{type:'VALUE',value:'2026-10-15'};
  const request=context.build({id:'dark-pool-levels',controls:[]});assert.equal(request.sessionDate,undefined);assert.equal(request.sessionDateRange.startDate,'2026-10-15');
});
test('Dark Pool Levels defaults select Top N by notional, then display price descending',()=>{
 const rows=prepareDarkPoolLevels({data:{100:{notionalValue:1000,tradeCount:1,size:10},101:{notionalValue:2000,tradeCount:3,size:30},102:{notionalValue:10,tradeCount:100,size:1000}}},{limit:2});
 assert.deepEqual(rows.map(row=>row.price),[101,100]);assert.equal(rows[0].rank,1);assert.equal(rows[0].tradeFraction,.75);assert.equal(rows[0].volumeFraction,.75);
 assert.match(app,/levelMetric: \[\["price", "Price"\]/);
});

test('Equity Prints allows the unfiltered full-market tape without inventing a ticker',()=>{
 const values={};const context={additionalToolRequest,masterReplay:null,equityPrintRequest,equityPrintHeaderFilters:()=>[],requestBase:()=>({sessionDate:'2026-10-16'}),getControl:key=>values[key]||'',toolCursor:null,getFilterOverrides:()=>({page:{},global:{}}),resolveFilterOverride:()=>({type:'NONE'}),FILTER_GROUP_TOOLS:new Set()};
 vm.runInNewContext(app.slice(app.indexOf('  function maybeFilter('),app.indexOf('  async function toolFetch('))+'\nthis.build=buildRequest;',context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.build({id:'equity-prints',controls:[]}))),{sessionDate:'2026-10-16',size:100,sort:{field:'TRADE_TIME',direction:'DESCENDING'}});
 values.ticker='SPY';assert.equal(context.build({id:'equity-prints',controls:[]}).filter.ticker,'SPY');
 assert.match(app,/if\(optionalTicker\)input.add\(new Option\('All instruments',''\)\)/);
});

test('contract statistics preserve multi moneyness and side selections as canonical OR arrays',()=>{
 const values={moneyType:'ITM, ATM',tradeSide:'ASK, ABOVE_ASK'};
 const context={additionalToolRequest,notificationRequest,notificationHeaderFilters:()=>[],masterReplay:null,requestBase:()=>({sessionDate:'2026-10-16'}),getControl:key=>values[key]||'',toolCursor:null,getFilterOverrides:()=>({page:{},global:{}}),resolveFilterOverride:()=>({type:'NONE'}),FILTER_GROUP_TOOLS:new Set()};
 vm.runInNewContext(app.slice(app.indexOf('  function maybeFilter('),app.indexOf('  async function toolFetch('))+'\nthis.build=buildRequest;',context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.build({id:'contract-statistics',controls:[]}).filter)),{moneyTypes:['IN_THE_MONEY','AT_THE_MONEY'],tradeSideCodes:['ASK','ABOVE_ASK']});
 values.moneyType='';values.tradeSide='';assert.equal(context.build({id:'contract-statistics',controls:[]}).filter,undefined);
 values.notificationType='LUDP, REG_SHO';assert.deepEqual(JSON.parse(JSON.stringify(context.build({id:'exchange-notifications',controls:[]}).filter.types)),['LUDP','REG_SHO']);
});

test('IV Rank supports independent call/put selection and clearing both restores an unrestricted rolling request',()=>{
 const values={ticker:'SPY',lookback:'365',maturity:'1',contractTypeOptional:'CALL, PUT'},context={additionalToolRequest,requestBase:()=>({sessionDate:'2026-11-02'}),getControl:key=>values[key]??'',toolCursor:null,getFilterOverrides:()=>({page:{},global:{}}),resolveFilterOverride:()=>({type:'NONE'}),FILTER_GROUP_TOOLS:new Set()};
 vm.runInNewContext(app.slice(app.indexOf('  function maybeFilter('),app.indexOf('  async function toolFetch('))+'\nthis.build=buildRequest;',context);
 const build=()=>JSON.parse(JSON.stringify(context.build({id:'iv-rank',controls:[]})));
 assert.deepEqual(build(),{filter:{ticker:'SPY',contractTypes:['CALL','PUT']},lookBackPeriod:365,maturity:1});
 values.contractTypeOptional='CALL';assert.deepEqual(build().filter.contractTypes,['CALL']);values.contractTypeOptional='';assert.deepEqual(build().filter,{ticker:'SPY'});assert.ok(!('sessionDate' in build()));
 values.maturity='0';assert.throws(build,/maturity.*1 and 365/);
});
