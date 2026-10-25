import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {reorderWorkspacePanels} from '../public/kwanty-app/workspace-chrome.js';
import {restoreOrderPanel} from '../public/kwanty-app/models.js';
import {createStateSources} from '../public/kwanty-app/state-sources.js';
import {calculateKwantyStudies,kwantyIndicatorReason} from '../src/lib/kwantyIndicatorAdapter.ts';
import {calculateIndicatorSeries} from '../src/lib/chartIndicatorEngine.ts';
import {createReplayPrefixReader} from '../public/kwanty-app/replay-cursor.js';
const require=createRequire(import.meta.url),read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8'),app=read('public/kwanty-app/app.js');

test('actual browser entry is a strict ES module with no accidentally hoisted boot guards',()=>{
 const tree=require('next/dist/compiled/acorn').parse(app,{ecmaVersion:'latest',sourceType:'module'});
 assert.ok(tree.body.some(node=>node.type==='ImportDeclaration'&&node.source.value.includes('workspace-chrome')));
 assert.equal(app.match(/workspaceChrome=mountWorkspaceChrome\(/g)?.length,1);
 assert.ok(app.indexOf('const state=')<app.indexOf('state.classicPanels=restoreStatePanels'));
 assert.ok(app.indexOf('const stateSources=')<app.indexOf('const classicSources='));
 assert.ok(app.indexOf('workspaceChrome=mountWorkspaceChrome(')>app.indexOf("syncMasterReplayControls();\nparent.postMessage"));
});

test('chart reorder preserves every panel/settings/drawing reference and supports more than three',()=>{
 const panels=Array.from({length:8},(_,id)=>({id:String(id),ticker:id%2?'QQQ':'SPX',drawingsByTicker:{}}));
 const next=reorderWorkspacePanels(panels,'7','1');assert.equal(next.length,8);assert.equal(next[1],panels[7]);assert.equal(panels[1].id,'1');
 assert.equal(reorderWorkspacePanels(panels,'missing','1'),panels);
 const restored=restoreOrderPanel(panels,[],{id:'new',ticker:'NDX'});assert.equal(restored.panels.length,9);assert.equal(restored.panels[8].ticker,'NDX');
});

test('Classic independent sources use Classic package, share ticker prices and reject another session',async()=>{
 const panels=[{ticker:'SPX',gexCategory:'gex_full'},{ticker:'QQQ',gexCategory:'gex_zero'},{ticker:'SPX',gexCategory:'gex_zero'}],queries=[],prices=[];
 const date='2026-10-23',timestamp=Date.parse(date+'T14:00:00Z')/1000;
 const source=createStateSources({packageName:'classic',onChange(){},api:async path=>{const q=new URLSearchParams(path.split('?')[1]);queries.push(q);return {ticker:q.get('ticker'),package:'classic',category:q.get('category'),sessionDate:date,data:[{ticker:q.get('ticker'),category:q.get('category'),timestamp,spot:q.get('ticker')==='SPX'?6000:600}]};},createPrices:()=>{const price={setActive(){},select(){},dispose(){}};prices.push(price);return price;}});
 source.reconcile(panels,{date,live:false,active:true});await source.refresh();assert.equal(prices.length,2);assert.equal(queries.length,3);assert.ok(queries.every(q=>q.get('package')==='classic'));assert.equal(source.get(panels[0]).records[0].spot,6000);assert.equal(source.get(panels[1]).records[0].spot,600);
 source.reconcile(panels,{date:'2026-10-22',live:false,active:true});await source.refresh({force:true});assert.match(source.get(panels[0]).error,/MISMATCH/);assert.equal(source.get(panels[0]).records.length,0);source.dispose();
});

test('actual Classic selectors use each panel source at the shared replay cutoff',()=>{
 const a={id:'a',ticker:'SPX'},b={id:'b',ticker:'QQQ'},sources=new Map([[a,{envelope:{},records:[{timestamp:100,ticker:'SPX'},{timestamp:102,ticker:'SPX'}]}],[b,{envelope:{},records:[{timestamp:101,ticker:'QQQ'},{timestamp:103,ticker:'QQQ'}]}]]),prefix=createReplayPrefixReader();
 const ctx={state:{package:'classic',classicPanels:[a,b],replayIndex:null},masterReplay:{timestampMs:102000},activeClassicPanel:()=>a,classicSources:{get:panel=>sources.get(panel)},profileReplay:{select:(_,row)=>row,ready:()=>true,error:()=>false}};ctx.beforeMaster=rows=>prefix(rows,ctx.masterReplay.timestampMs);
 vm.runInNewContext(app.slice(app.indexOf('function currentRecords('),app.indexOf('async function restoreOrderflowSession(')),ctx);
 assert.equal(ctx.selectedPayload(a).timestamp,102);assert.equal(ctx.selectedPayload(b).timestamp,101);ctx.masterReplay.timestampMs=100000;assert.equal(ctx.selectedPayload(b),null);assert.equal(ctx.selectedPayload(a).timestamp,100);
});

test('Kwanty studies are the same normal-chart calculations and never use future OHLC',()=>{
 const start=Date.UTC(2026,9,23,14),candles=Array.from({length:80},(_,i)=>({timestamp:start+i*60000,open:100+i/10,high:102+i/10,low:99+i/10,close:101+i/10})),theme={primary:'#fff',secondary:'#ccc',positive:'#0f0',negative:'#f00',muted:'#888'};
 const instance={instanceId:'ma',indicatorId:'moving-average',enabled:true,settings:{length:5}};
 const result=calculateKwantyStudies([instance],candles,theme,'SPX',start+40*60000)[0];
 assert.deepEqual(result.series,calculateIndicatorSeries(instance,candles,theme,{instrument:'SPX',replayTimestampMs:start+40*60000}));
 assert.ok(result.series[0].data.every(point=>point.time*1000<=start+40*60000));
 const later=candles.map((c,i)=>i>40?{...c,high:10000,close:9999}:c);assert.deepEqual(calculateKwantyStudies([instance],later,theme,'SPX',start+40*60000)[0].series,result.series);
 assert.equal(kwantyIndicatorReason('moving-average',candles),null);assert.match(kwantyIndicatorReason('vwap',candles),/reported traded volume/);assert.match(kwantyIndicatorReason('cumulative-volume-delta',candles),/classified executions/);assert.match(kwantyIndicatorReason('big-blocks-options',candles),/adapter/);
});

test('chrome and drawings are connected in all modes while native settings remain on the right',()=>{
 const chrome=read('public/kwanty-app/workspace-chrome.js'),css=read('public/kwanty-app/site.css');
 assert.match(chrome,/onTicker\(ticker.value\)/);assert.match(chrome,/onIndicators/);assert.match(chrome,/onResize\(\)/);
 assert.match(app,/attachChartTools\(chart\)/);assert.match(app,/function attachChartTools[\s\S]*?attachStateDrawingTools/);
 assert.match(app,/function buildStateCharts[\s\S]*?attachStateDrawingTools/);
 assert.match(css,/header>nav\{grid-column:2;grid-row:1;justify-self:center\}/);assert.match(css,/\.chart-top-controls\{grid-column:1;grid-row:1/);
 assert.match(app,/classicPanels:state.classicPanels/);assert.match(app,/workspaceLayouts:state.workspaceLayouts/);
 const panes=read('src/components/ChartIndicatorPanes.tsx');
 assert.equal((panes.match(/ownerDocument.defaultView/g)||[]).length,3);
 assert.doesNotMatch(panes,/window.addEventListener\("pointer/);
});
