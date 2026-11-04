import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {squarifyTreemap} from '../../public/gex-data-app/chart-primitives.js';
import {drawMarketMapFrame,marketMapTooltipRows,marketMapHeaderTooltipRows,observeMarketMapIndustries,marketMapIndustryChoices} from '../../public/gex-data-app/market-map-presentation.js';
import {MARKET_MAP_SLIDER_MAX,MARKET_MAP_CAMERA_IDENTITY,marketMapMaxZoom,clampMarketMapCamera,wheelMarketMapCamera,panMarketMapCamera,marketMapCameraWindows,applyMarketMapWindow,marketMapWorldPoint} from '../../public/gex-data-app/market-map-interaction-model.js';
const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');
function context(){const calls=[],stack=[];return {calls,save(){stack.push({font:this.font,textAlign:this.textAlign});},restore(){Object.assign(this,stack.pop());},beginPath(){},rect(...rect){calls.push({kind:'clipRect',rect});},clip(){},fillRect(...rect){calls.push({kind:'fill',rect});},strokeRect(){},measureText(text){return {width:text.length*6};},fillText(text,x,y){calls.push({kind:'text',text,x,y,font:this.font,align:this.textAlign});}};}
function harness(data,{width=400,height=200,savedCamera}={}){
  let dimensions={width,height},chartOptions,stored=savedCamera?JSON.stringify(savedCamera):null,chart,changes=0,tooltipHidden=false;
  const ctx=context(),listeners={},canvas={style:{},parentElement:{append(){}},addEventListener(name,callback){listeners[name]=callback;},getBoundingClientRect(){return {left:0,top:0};},setPointerCapture(){}},shell={classList:{add(){}},append(){},querySelector(){return {setAttribute(){tooltipHidden=true;}};}};
  const controls={mapGroup:'INDUSTRY',mode:'historical',date:'2026-10-16',sector:'',industry:''};
  const env={number:Number,marketMapIndustryInventory:new Map(),marketMapIndustrySession:null,observeMarketMapIndustries,marketMapIndustryChoices,marketMapTooltipRows,marketMapHeaderTooltipRows,drawMarketMapFrame,squarifyTreemap,MARKET_MAP_SLIDER_MAX,MARKET_MAP_CAMERA_IDENTITY,marketMapMaxZoom,clampMarketMapCamera,wheelMarketMapCamera,panMarketMapCamera,marketMapCameraWindows,applyMarketMapWindow,marketMapWorldPoint,
    getControl:key=>controls[key],setControl:(key,value)=>{controls[key]=value;},onControlsChanged(){changes++;},apiStatus:{market:{}},todayOffset:()=>'',instanceKey:'test',compact:String,gexStorage:{getItem:()=>stored,setItem:(_key,value)=>{stored=value;}},themePaint:value=>value,q:()=>({setChoices(){}}),element:()=>({}),bindZoomNavigator:()=>({sync(){}}),setSummary(){},activeChartReset:null,
    quantCanvas(options){chartOptions=options;chart={shell,canvas,redraw(){if(dimensions.width<=0||dimensions.height<=0){options.draw(ctx,dimensions.width,dimensions.height);return;}options.draw(ctx,dimensions.width,dimensions.height);}};return chart;}};
  vm.runInNewContext(source.slice(source.indexOf('  function renderMarketMap('),source.indexOf('  function aggregateExposureTool('))+'\nthis.render=renderMarketMap;',env);env.render({data});
  return {ctx,controls,env,get options(){return chartOptions;},draw(w,h){dimensions={width:w,height:h};chart.redraw();},fire(name,extra={}){listeners[name]?.({clientX:50,clientY:60,button:0,pointerId:1,preventDefault(){},...extra});},camera:()=>JSON.parse(stored),get changes(){return changes;},get tooltipHidden(){return tooltipHidden;}};
}
const row=(industry,size,change=1)=>({industry,sector:'TECHNOLOGY',size,currentValue:100+change,previousValue:100,companyName:'Example'});
test('actual Market Map path uses screen labels after zoom, uncapped font and post-tile header truncation/suppression',()=>{
  const ctx=context(),groups=[{name:'SEMICONDUCTORS',weight:1,rows:[{ticker:'TEST',weight:1,change:1}]}];
  const draw=(width,height,zoom)=>{ctx.calls.length=0;return drawMarketMapFrame(ctx,{groups,grouping:'NONE',width,height,camera:{zoomX:zoom,zoomY:zoom,offsetX:0,offsetY:0},paint:value=>value});};
  draw(30,30,1);assert.equal(ctx.calls.some(call=>call.kind==='text'),false);draw(30,30,2);assert.ok(ctx.calls.some(call=>call.text==='TEST'&&call.font==='bold 12px Aleph, sans-serif'));assert.ok(ctx.calls.some(call=>call.text==='+1%'));draw(300,300,1);assert.ok(ctx.calls.some(call=>call.text==='TEST'&&call.font==='bold 60px Aleph, sans-serif'));
  const h=harness({BIG:row('SEMICONDUCTORS',9999),SMALL:row('EXTREMELY_LONG_INDUSTRY_NAME',1)});const texts=h.ctx.calls.filter(call=>call.kind==='text');assert.ok(texts.some(call=>call.text==='Semiconductors'));assert.equal(texts.some(call=>call.text.includes('Extremely')),false);assert.equal(h.ctx.calls.at(-1).kind,'text','visible headers painted after all tile fills');
  const narrow=harness({ONE:row('EXTREMELY_LONG_INDUSTRY_NAME',1)},{width:90,height:100});const header=narrow.ctx.calls.filter(call=>call.kind==='text'&&call.align==='left').at(-1);assert.ok(header.text.endsWith('…'));assert.ok(header.text.length*6<=82);assert.ok(narrow.ctx.calls.some(call=>call.kind==='clipRect'&&call.rect[2]===90&&call.rect[3]===16));
});
test('actual Market Map hover distinguishes header from ticker, suppresses pan tooltip and only header click filters',()=>{
  const h=harness({NVDA:row('SEMICONDUCTORS',1)},{savedCamera:{zoomX:2,zoomY:2,offsetX:0,offsetY:0}});
  assert.deepEqual(Array.from(h.options.tooltipRows(null,0,{pointerX:20,pointerY:10})),['Semiconductors','Click to filter for this industry']);
  const ticker=h.options.tooltipRows(null,0,{pointerX:50,pointerY:100});assert.equal(ticker[0],'NVDA');assert.equal(ticker.at(-1).parts[0].text,'Underlying Price: $101 (');
  h.fire('pointerdown',{clientX:50,clientY:100});h.fire('pointerup',{clientX:50,clientY:100});assert.equal(h.changes,0);
  h.fire('pointerdown',{clientX:50,clientY:100});h.fire('pointermove',{clientX:60,clientY:100});assert.deepEqual(Array.from(h.options.tooltipRows(null,0,{pointerX:50,pointerY:100})),[]);assert.equal(h.tooltipHidden,true);h.fire('pointerup',{clientX:60,clientY:100});assert.equal(h.changes,0);
  h.fire('pointerdown',{clientX:20,clientY:10});h.fire('pointerup',{clientX:20,clientY:10});assert.equal(h.controls.industry,'SEMICONDUCTORS');assert.equal(h.changes,1);
});
test('actual measured resize resets camera only after positive dimension change; repeat/zero/ordinary refresh preserve zoom',()=>{
  const data={NVDA:row('SEMICONDUCTORS',1)},savedCamera={zoomX:2,zoomY:3,offsetX:-10,offsetY:-20},h=harness(data,{savedCamera});
  h.draw(400,200);h.fire('wheel',{deltaY:-1});const zoomed=h.camera();assert.ok(zoomed.zoomX>2);h.draw(0,0);h.draw(400,200);assert.deepEqual(h.camera(),zoomed);
  const refresh=harness(data,{savedCamera:zoomed});refresh.draw(400,200);assert.deepEqual(refresh.camera(),zoomed);
  h.draw(500,200);assert.deepEqual(h.camera(),MARKET_MAP_CAMERA_IDENTITY);h.fire('wheel',{deltaY:-1});const resized=h.camera();h.draw(500,200);assert.deepEqual(h.camera(),resized);
});
