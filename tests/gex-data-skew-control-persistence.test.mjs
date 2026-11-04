import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {persistSurfaceSelections,restoreSurfaceSelections} from '../public/gex-data-app/surface-selection-storage.js';

const app=readFileSync(new URL('../public/gex-data-app/app.js',import.meta.url),'utf8');
const saveStart=app.indexOf('  function saveToolControls(){'),save=app.slice(saveStart,app.indexOf('\n  function ',saveStart+1));
test('actual control persistence keeps explicit hidden-all and multi-leg Skew selections through ordinary saves',()=>{
  const writes=[];
  const context={activeTool:{id:'volatility-skew',view:'volatilitySkew'},savedToolControls:{'volatility-skew':{visibleExpiry:[],visibleContractType:['CALL','PUT'],ticker:'QQQ'}},
    q:()=>({}),qa:()=>[{dataset:{control:'ticker'},value:'SPY'},{dataset:{control:'mode'},value:'historical'},{dataset:{control:'date'},value:'2026-10-16'}],
    gexStorage:{setItem:(_key,value)=>writes.push(JSON.parse(value))},controlsStorageKey:'isolated-controls',EMBEDDED:false,persistSurfaceSelections};
  vm.runInNewContext(save+'\nsaveToolControls();',context);
  assert.deepEqual(writes[0]['volatility-skew'],{visibleExpiry:[],visibleContractType:['CALL','PUT'],ticker:'SPY',mode:'historical',date:'2026-10-16'});
});

test('actual Term save retains legacy ranges until explicit empty selection arrays override them',()=>{
  const writes=[],id='term-structure',context={activeTool:{id,view:'termStructure'},savedToolControls:{[id]:{expiryStart:'2026-10-19',expiryEnd:'2026-12-01',minStrike:700,maxStrike:800}},
    q:()=>({}),qa:()=>[{dataset:{control:'ticker'},value:'SPY'},{dataset:{control:'moneyType'},value:'ATM'},{dataset:{control:'deltaMin'},value:'0'},{dataset:{control:'deltaMax'},value:'1'}],persistSurfaceSelections,
    gexStorage:{setItem:(_key,value)=>writes.push(JSON.parse(value))},controlsStorageKey:'isolated-controls',EMBEDDED:false};
  vm.runInNewContext(save+'\nthis.save=saveToolControls;',context);context.save();
  assert.deepEqual(writes[0][id],{expiryStart:'2026-10-19',expiryEnd:'2026-12-01',minStrike:700,maxStrike:800,ticker:'SPY',moneyType:'ATM',deltaMin:'0',deltaMax:'1'});
  context.savedToolControls[id].termExpirations=[];context.savedToolControls[id].termStrikes=[];context.save();
  assert.deepEqual(writes[1][id],{termExpirations:[],termStrikes:[],ticker:'SPY',moneyType:'ATM',deltaMin:'0',deltaMax:'1'});
});

function controlHarness(id,parameters,saved){
  class Node{
    constructor(className=''){this.className=className;this.children=[];this.dataset={};this.value='';this.parent=null;this.style={};}
    append(...nodes){for(const node of nodes){if(node.parent)node.parent.children=node.parent.children.filter(child=>child!==node);node.parent=this;this.children.push(node);}}
    replaceChildren(){this.children=[];}
    setAttribute(){}addEventListener(){}querySelector(){return null;}
    closest(){return this.parent;}
  }
  const holder=new Node(),walk=node=>[node,...node.children.flatMap(walk)],writes=[],view=id==='volatility-skew'?'volatilitySkew':'termStructure',controls=['mode','date','ticker',...(view==='termStructure'?['moneyType','deltaMin','deltaMax']:[])],defaults={mode:'latest',date:'',ticker:'QQQ',moneyType:'ATM',deltaMin:'0',deltaMax:'1'};
  const input=key=>walk(holder).find(node=>node.dataset.control===key),qa=(selector)=>walk(holder).filter(node=>selector==='[data-control]'?node.dataset.control:selector==='[data-term-selection]'?node.dataset.termSelection:false);
  const env={commonSessionDateControls:null,mountSessionDateControls:()=>({sync(){},destroy(){}}),popup(){},netDriftContractControls:null,activeTool:{id,view,controls},CONTROL_META:Object.fromEntries(controls.map(key=>[key,[key,'text']])),savedToolControls:saved?{[id]:structuredClone(saved)}:{},VIEW_PARAMETERS:new URLSearchParams(parameters),EMBEDDED:false,toolPayload:null,persistSurfaceSelections,restoreSurfaceSelections,
    q:selector=>selector==='#toolControls'?holder:input(selector.match(/data-control="([^"]+)"/)?.[1]),qa,
    makeControl(key){const wrap=new Node('control'),control=new Node();control.dataset.control=key;control.value=defaults[key];wrap.append(control);return wrap;},element:(_tag,className)=>new Node(className),
    setControl:(key,value)=>{const node=input(key);if(node)node.value=String(value);},getControl:key=>input(key)?.value,reflectFilterOverrides(){},syncDateControl(){},onControlsChanged(){},FILTER_GROUP_TOOLS:new Set([id]),
    gexStorage:{setItem:(_key,value)=>writes.push(JSON.parse(value))},controlsStorageKey:'isolated-controls'};
  const renderStart=app.indexOf('  function renderControls(tool)'),render=app.slice(renderStart,saveStart);
  vm.runInNewContext(render+save+'\nthis.render=renderControls;this.save=saveToolControls;',env);
  return {env,input,writes};
}

test('actual copied Skew restoration preserves normal ticker/date URL controls alongside non-DOM arrays',()=>{
  const h=controlHarness('volatility-skew','instance=copy&c_ticker=SPY&c_mode=historical&c_date=2026-10-16&c_visibleExpiry=%5B%5D&c_visibleContractType=%5B%22CALL%22%2C%22PUT%22%5D');
  h.env.render(h.env.activeTool);assert.equal(h.input('ticker').value,'SPY');assert.equal(h.input('date').value,'2026-10-16');h.env.save();
  assert.deepEqual(h.writes[0]['volatility-skew'],{visibleExpiry:[],visibleContractType:['CALL','PUT'],mode:'historical',date:'2026-10-16',ticker:'SPY'});
});

test('actual existing saved surface state wins over copied URL parameters',()=>{
  const saved={ticker:'QQQ',date:'2026-10-19',mode:'historical',visibleExpiry:['2026-10-19'],visibleContractType:['PUT']},h=controlHarness('volatility-skew','instance=copy&c_ticker=SPY&c_date=2026-10-16&c_visibleExpiry=[]',saved);
  h.env.render(h.env.activeTool);h.env.save();assert.equal(h.input('ticker').value,'QQQ');assert.equal(h.input('date').value,'2026-10-19');assert.deepEqual(h.writes[0]['volatility-skew'],saved);
});

test('actual copied Term restoration keeps empty arrays and ticker/date while delta controls remain saved',()=>{
  const h=controlHarness('term-structure','instance=copy&c_ticker=SPY&c_mode=historical&c_date=2026-10-16&c_termExpirations=[]&c_termStrikes=[]&c_deltaMin=0.25&c_deltaMax=0.75');
  h.env.render(h.env.activeTool);h.env.save();assert.deepEqual(h.writes[0]['term-structure'],{termExpirations:[],termStrikes:[],mode:'historical',date:'2026-10-16',ticker:'SPY',moneyType:'ATM',deltaMin:'0.25',deltaMax:'0.75'});
});

test('News polling is not coupled to the options market opening hours and fixed news history does not poll',()=>{
  const context={activeTool:{group:'News',liveMs:30000},apiStatus:{market:{open:false,optionsOpen:false,equitiesOpen:false}},
    masterReplay:null,pollTimer:42,clearTimeout:()=>{context.cleared=true;},buildRequest:()=>({timeRange:{startTime:'2026-10-16T00:00:00Z',endTime:'2026-10-17T00:00:00Z'}})};
  const market=app.slice(app.indexOf('  function toolMarketOpen(){'),app.indexOf('  function renderSnapshotControl('));
  const schedule=app.slice(app.indexOf('  function schedulePoll() {'),app.indexOf('  function refreshResumedTool() {'));
  vm.runInNewContext(market+schedule+'\nthis.open=toolMarketOpen();schedulePoll();',context);
  assert.equal(context.open,true);assert.equal(context.pollTimer,null);assert.equal(context.cleared,true);
});
