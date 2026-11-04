import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {heatCellDetailSeries,mergeHeatCellDetailRows,mountHeatCellDetailView} from '../../public/gex-data-app/heat-cell-detail-view.js';

const selection={ticker:'SPY',sessionDate:'2026-10-16',expirationDate:'2026-10-16',strikePrice:760,dataMode:'CALL_IMPLIED_VOLATILITY',request:{sessionDate:'2026-10-16',dataMode:'CALL_IMPLIED_VOLATILITY',filter:{ticker:'SPY'}}};
const row=(time,value,extra={})=>({time,receivedAtMs:time,basis:'observation',call:null,put:null,value,ticker:'SPY',expirationDate:'2026-10-16',strikePrice:760,dataMode:selection.dataMode,sourceUnit:'provider-native',...extra});
const receipt=(rows,extra={})=>({selection:{...selection,throughMs:10000},coverage:{kind:'observations-only',scanComplete:true,partial:false},nextCursor:null,rows,...extra});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('source scalar/contract chart contract retains exact IV units, null gaps and snapshot totals without summing',()=>{
  const scalar=heatCellDetailSeries([row(1000,20),row(2000,null),row(3000,25)],selection.dataMode);assert.equal(scalar.title,'Implied Volatility Heat Map Cell (Calls)');assert.deepEqual(scalar.series[0].points.map(point=>point.value),[20,null,25]);assert.equal(scalar.series[0].latest,25);assert.equal(scalar.series[0].color,'#00FF00');
  const paired=heatCellDetailSeries([row(1000,1,{call:10,put:9}),row(2000,2,{call:20,put:18})],'NET_VOLUME');assert.deepEqual(paired.series.map(series=>series.label),['Call Net Volume','Put Net Volume']);assert.deepEqual(paired.series.map(series=>series.latest),[20,18]);assert.equal(paired.series[1].color,'#FF0000');
  assert.deepEqual(heatCellDetailSeries([],'NET_VOLUME').series.map(series=>[series.key,series.label,series.latest]),[['call','Call Net Volume',null],['put','Put Net Volume',null]]);assert.deepEqual(heatCellDetailSeries([row(1000,null)],'NET_GAMMA_EXPOSURE').series.map(series=>series.label),['Call Net GEX','Put Net GEX']);
});

test('history page merge enforces exact cell/boundary, keeps zeros/null and newest duplicate receipt',()=>{
  const first=mergeHeatCellDetailRows([],receipt([row(2000,null),row(1000,0)]),selection);assert.deepEqual(first.map(row=>row.value),[0,null]);const second=mergeHeatCellDetailRows(first,receipt([row(1000,20,{receivedAtMs:3000})]),selection,10000);assert.deepEqual(second.map(row=>row.value),[20,null]);assert.deepEqual(first.map(row=>row.value),[0,null]);
  assert.throws(()=>mergeHeatCellDetailRows(first,receipt([],{selection:{...selection,throughMs:9999}}),selection,10000),/boundary/);assert.throws(()=>mergeHeatCellDetailRows(first,receipt([],{selection:{...selection,ticker:'QQQ',throughMs:10000}}),selection),/selection/);assert.throws(()=>mergeHeatCellDetailRows([],receipt([row(10001,2)]),selection),/observation/);assert.throws(()=>mergeHeatCellDetailRows([],receipt([row(1000,NaN)]),selection),/observation/);
});

class Element{
  constructor(tag,document){this.tagName=tag;this.ownerDocument=document;this.children=[];this.events={};this.style={};this.attributes={};this.classList={add(){}};this.clientWidth=600;this.calls=[];}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children.forEach(node=>{node.parent=null;});this.children=[];this.append(...nodes);}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(type,fn){(this.events[type]||=[]).push(fn);}
  removeEventListener(type,fn){this.events[type]=(this.events[type]||[]).filter(candidate=>candidate!==fn);}
  fire(type,event={}){if(!this.disabled)for(const fn of this.events[type]||[])fn({target:this,currentTarget:this,...event});}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;}
  get isConnected(){return this===this.ownerDocument.body||!!this.parent?.isConnected;}
  getBoundingClientRect(){return {width:600,height:320,left:0,top:0};}
  setPointerCapture(){}
  getContext(){return new Proxy({},{get:(_target,key)=>(...args)=>{this.calls.push([key,...args]);},set:()=>true});}
}
const walk=node=>[node,...node.children.flatMap(walk)],text=(node,value)=>walk(node).find(child=>child.textContent===value);
function harness({detached=false,formatTime=time=>'T'+time}={}){let disconnected=0,resize;const document={createElement:tag=>new Element(tag,document),defaultView:{devicePixelRatio:1,ResizeObserver:class{constructor(callback){resize=callback;}observe(){}disconnect(){disconnected++;}}}};document.body=document.createElement('body');const host=document.createElement('div');if(!detached)document.body.append(host);const requests=[];
  const api=mountHeatCellDetailView({host,selection,fetchPage:(body,signal)=>new Promise((resolve,reject)=>requests.push({body,signal,resolve,reject})),formatTime,formatValue:value=>value+'%',themePaint:value=>value});return {api,document,host,requests,resize:()=>resize(),get disconnected(){return disconnected;}};
}

test('source tooltip separates ticker, expiry/strike and Value while selected-zone hover time lives only on axis badge',async()=>{
  let clock='4:00 AM';const h=harness({formatTime:()=>clock});h.requests[0].resolve(receipt([row(1000,24.27),row(2000,29.8)]));await flush();const canvas=walk(h.host).find(node=>node.tagName==='canvas');canvas.fire('pointermove',{clientX:78});const tooltip=walk(h.host).find(node=>node.className==='chart-tooltip');assert.equal(tooltip.hidden,false);assert.ok(text(tooltip,'SPY'));assert.ok(text(tooltip,'Oct 16, 2026 $760'));assert.ok(walk(tooltip).find(node=>node.tagName==='hr'));assert.ok(text(tooltip,'Value:'));assert.ok(text(tooltip,'24.27%'));assert.equal(walk(tooltip).some(node=>node.textContent?.includes('4:00 AM')),false);assert.ok(canvas.calls.some(call=>call[0]==='fillText'&&call[1]==='4:00 AM'&&call[3]===309));
  clock='7:15 AM';canvas.fire('pointermove',{clientX:582});assert.ok(text(tooltip,'29.8%'));assert.ok(canvas.calls.some(call=>call[0]==='fillText'&&call[1]==='7:15 AM'&&call[3]===309));assert.equal(h.requests.length,1);h.api.destroy();
});

test('detached dialog construction activates once after synchronous append, with fixed plot height and source axis title',async()=>{
  const h=harness({detached:true});assert.equal(h.requests.length,0);h.document.body.append(h.host);await flush();assert.equal(h.requests.length,1);h.resize();h.resize();assert.equal(h.requests.length,1,'layout must not request repeatedly');h.requests[0].resolve(receipt([row(1000,29.802322)]));await flush();assert.equal(h.api.getRows()[0].value,29.802322);assert.ok(walk(h.host).some(node=>node.textContent?.includes('1 saved observation')));const plot=walk(h.host).find(node=>node.className==='quant-chart-plot'),canvas=plot.children.find(node=>node.tagName==='canvas');assert.equal(plot.style.height,'320px');assert.equal(plot.style.minHeight,'320px');assert.equal(plot.style.flex,'0 0 320px');assert.ok(canvas.calls.some(call=>call[0]==='fillText'&&call[1]==='Implied Volatility (Calls)'));h.api.destroy();
});

test('destroy before detached activation prevents all reads and later observer activation',async()=>{
  const h=harness({detached:true});h.api.destroy();h.document.body.append(h.host);await flush();h.resize();assert.equal(h.requests.length,0);assert.equal(h.host.children.length,0);assert.equal(h.disconnected,1);
});

test('later attachment can activate from first layout observation without polling',async()=>{
  const h=harness({detached:true});await flush();assert.equal(h.requests.length,0);h.document.body.append(h.host);h.resize();assert.equal(h.requests.length,1);await flush();h.resize();assert.equal(h.requests.length,1);h.api.destroy();
});

test('dialog chart makes one bounded archive request, explicit opaque paging freezes boundary and retains older rows',async()=>{
  const h=harness();assert.equal(h.requests.length,1);assert.deepEqual(Object.keys(h.requests[0].body).sort(),['request','sessionDate','expirationDate','strikePrice','limit'].sort());h.requests[0].resolve(receipt([row(1000,20),row(2000,21)],{nextCursor:'opaque-page-2',coverage:{kind:'observations-only',partial:true,scanComplete:false}}));await flush();assert.equal(h.requests.length,1);assert.ok(walk(h.host).some(node=>node.textContent?.includes('Partial history')));text(h.host,'Load more recorded observations').fire('click');assert.equal(h.requests.length,2);assert.equal(h.requests[1].body.cursor,'opaque-page-2');assert.equal(h.requests[1].body.throughMs,10000);h.requests[1].resolve(receipt([row(3000,22)]));await flush();assert.deepEqual(h.api.getRows().map(row=>row.value),[20,21,22]);assert.equal(text(h.host,'Load more recorded observations').hidden,true);assert.ok(text(h.host,'Implied Volatility Heat Map Cell (Calls)'));assert.ok(walk(h.host).some(node=>node.textContent==='Implied Volatility (22%)'));
  h.api.destroy();assert.equal(h.disconnected,1);assert.equal(h.requests[0].signal.aborted,true);assert.equal(h.host.children.length,0);
});

test('single real observation renders a point, never a manufactured full-session line; close discards delayed responses',async()=>{
  const h=harness();h.requests[0].resolve(receipt([row(1000,20)]));await flush();const canvas=walk(h.host).find(node=>node.tagName==='canvas');assert.ok(canvas.calls.some(call=>call[0]==='arc'));assert.ok(canvas.calls.filter(call=>call[0]==='lineTo').every(call=>call[1]===582),'only horizontal axis grid lines are drawn for a single observation');h.api.destroy();
  const pending=harness();pending.api.destroy();pending.requests[0].resolve(receipt([row(1000,20)]));await flush();assert.deepEqual(pending.api.getRows(),[]);assert.equal(pending.host.children.length,0);assert.equal(pending.requests[0].signal.aborted,true);
});

test('empty and unavailable archives stay localized; navigator, pan and zoom never request data',async()=>{
  const h=harness();h.requests[0].resolve(receipt([]));await flush();assert.ok(text(h.host,'No saved history for this cell.'));h.api.destroy();const populated=harness();populated.requests[0].resolve(receipt([row(1000,20),row(2000,21),row(3000,22)]));await flush();const canvas=walk(populated.host).find(node=>node.tagName==='canvas');canvas.fire('wheel',{deltaY:-1,preventDefault(){}});canvas.fire('pointerdown',{clientX:100,pointerId:1});canvas.fire('pointermove',{clientX:200});canvas.fire('pointerup');assert.equal(populated.requests.length,1);populated.api.destroy();assert.ok(Object.values(canvas.events).every(listeners=>listeners.length===0));
});

test('real metric overview has band and accessible handles, keyboard/reset control only the isolated window and dispose cleanly',async()=>{
  const h=harness();h.requests[0].resolve(receipt([row(1000,20),row(2000,21),row(3000,22)]));await flush();
  const find=label=>walk(h.host).find(node=>node.attributes['aria-label']===label),first=find('Cell history window start'),last=find('Cell history window end'),band=find('Cell history window selection'),overview=find('Cell metric history overview'),navigator=overview.parent;
  assert.equal(first.attributes.role,'slider');assert.equal(last.attributes['aria-valuenow'],'2');assert.ok(band);assert.ok(overview.calls.some(call=>call[0]==='lineTo'&&call[1]===300),'preview places the middle actual timestamp at its true midpoint');assert.equal(navigator.children.some(node=>node.tagName==='input'),false);
  first.fire('keydown',{key:'ArrowRight',preventDefault(){}});assert.equal(first.attributes['aria-valuenow'],'1');assert.equal(last.attributes['aria-valuenow'],'2');navigator.fire('dblclick',{preventDefault(){},stopPropagation(){}});assert.equal(first.attributes['aria-valuenow'],'0');assert.equal(last.attributes['aria-valuenow'],'2');assert.equal(h.requests.length,1);
  band.fire('pointerdown',{button:0,clientX:100,pointerId:1,preventDefault(){},stopPropagation(){}});assert.equal(band.events.pointermove.length,1);h.api.destroy();assert.ok(Object.values(band.events).every(listeners=>listeners.length===0));assert.ok(Object.values(navigator.events).every(listeners=>listeners.length===0));assert.ok(Object.values(first.events).every(listeners=>listeners.length===0));assert.ok(Object.values(last.events).every(listeners=>listeners.length===0));
});

test('one saved observation has concise singular partial-history copy',async()=>{
  const h=harness();h.requests[0].resolve(receipt([row(1000,20)],{coverage:{kind:'observations-only',partial:true,scanComplete:true}}));await flush();assert.ok(text(h.host,'1 saved observation · Partial history'));assert.equal(walk(h.host).some(node=>node.textContent?.includes('reconstructed')),false);h.api.destroy();
});

test('actual Heat Map detail branch owns chart/table cancellation and never touches main-map canvas refs',async()=>{
  const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),start=source.indexOf('  function openTradeDetail('),end=source.indexOf('\n  async function loadToolPayload',start),h=harness();h.api.destroy();let destroyed=0,chartDestroyed=0,dialog,request,tableOptions;
  const env={activeTool:{id:'heat-map'},buildRequest:()=>selection.request,requestBase:()=>({sessionDate:selection.sessionDate}),document:h.document,structuredClone,AbortController,OPTION_TRADE_DETAIL_ENDPOINT:'order-flow-unconsolidated',UNCONSOLIDATED_COLUMNS:[],CONSOLIDATED_COLUMNS:[],displayChartTime:String,compact:String,themePaint:value=>value,
    element:(tag,cls,value)=>{const node=h.document.createElement(tag);node.className=cls;node.textContent=value;return node;},showDataDialog:(_title,build)=>{dialog=h.document.createElement('dialog');h.document.body.append(dialog);build(dialog);},createTableView:options=>{tableOptions=options;return {setRows(){throw Error('Closed dialog must not accept delayed rows');},destroy(){destroyed++;}};},
    mountHeatCellDetailView:()=>({destroy(){chartDestroyed++;}}),toolFetch:(_endpoint,_body,signal)=>new Promise(resolve=>{request={signal,resolve};}),mergeOptionTapeRows:()=>[],unconsolidatedTradeRows:()=>[],optionTapeCursor:()=>null,optionTradeDetailTableSort:()=>({}),quantCanvas(){throw Error('Main map must not be replaced');},showVisual(){throw Error('Main map must remain visible');}};
  vm.runInNewContext(source.slice(start,end)+'\nthis.open=openTradeDetail;',env);env.open({title:'Heat Map Details',preview:'Cell',individual:true,requestOverride:{size:100},heatCell:selection});assert.ok(text(dialog,'Cell Trades'));assert.equal(tableOptions.inlineFilters,false);assert.ok(walk(dialog).some(node=>node.className==='trade-detail-scroll table-scroll'));dialog.fire('close');assert.equal(request.signal.aborted,true);assert.equal(destroyed,1);assert.equal(chartDestroyed,1);request.resolve({data:[]});await flush();dialog.fire('close');assert.equal(destroyed,1);
});
