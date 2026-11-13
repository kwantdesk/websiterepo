import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { CHART_INDICATOR_CATALOG } from '../src/lib/chartIndicatorCatalog.ts';
import { calculateIndicatorSeries } from '../src/lib/chartIndicatorEngine.ts';
import * as ticks from '../src/lib/indicatorAxisTicks.ts';
import * as sampling from '../src/lib/chartIndicatorPaneSampling.ts';
import * as barWidth from '../src/lib/chartBarWidth.ts';
import * as histogramWidth from '../src/lib/indicatorHistogramWidth.ts';
import * as coordinates from '../src/lib/paneCoordinateContinuity.ts';
import * as continuity from '../src/lib/cvdRenderContinuity.ts';
import { subscribeIndicatorPaneFrames } from '../src/lib/indicatorPaneViewport.ts';

function frames() {
  let id=0;const queue=new Map();
  return {queue,requestAnimationFrame(fn){queue.set(++id,fn);return id;},cancelAnimationFrame(i){queue.delete(i);},paint(){const batch=[...queue.values()];queue.clear();for(const fn of batch)fn();}};
}
function harness() {
  const window=frames(),instances=new Map(),listeners=new Set();let active=null,dirty=false;
  const hook=init=>{const index=active.cursor++;if(!(index in active.slots))active.slots[index]=init();return active.slots[index];};
  const effects=[];
  const react={memo:fn=>fn,useMemo:fn=>fn(),useCallback:fn=>fn,
    useRef:value=>hook(()=>({current:value})),
    useState:value=>{const slot=hook(()=>({value:typeof value==='function'?value():value}));return [slot.value,next=>{slot.value=typeof next==='function'?next(slot.value):next;dirty=true;}];},
    useEffect:(fn,deps)=>{const slot=hook(()=>({deps:null,dispose:null}));if(!slot.deps||deps.some((d,i)=>!Object.is(d,slot.deps[i]))){effects.push(()=>{slot.dispose?.();slot.deps=deps;slot.dispose=fn();});}},
  };
  const jsx=(type,props,key)=>({type,key,props:props??{}});
  const mocks={'react':react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'lucide-react':new Proxy({},{get:()=>()=>null}),
    '@/components/useSuperTrendLivePanes':{useSuperTrendLivePanes:groups=>groups},
    '@/components/useLiveDeltaPanes':{useLiveDeltaPanes:groups=>groups},
    '@/lib/liveDeltaPanes':{isFullHistoryPriceStudy:()=>false,isLivePriceStudy:()=>false,isLiveCumulativeVolumeStudy:()=>false},
    '@/components/SuperTrendPaneLabels':{default:()=>null},'@/components/KstPanePlot':{default:()=>null},
    '@/lib/superTrendPaneScale':{SuperTrendPaneScale:class {retain(){}resolve(_key,series,domain){return domain(series);}}},
    '@/lib/indicatorAxisTicks':ticks,'@/lib/chartIndicatorPaneSampling':sampling,'@/lib/chartBarWidth':barWidth,'@/lib/indicatorHistogramWidth':histogramWidth,'@/lib/paneCoordinateContinuity':coordinates,
    '@/lib/cvdRenderContinuity':continuity,'@/lib/indicatorPaneViewport':{subscribeIndicatorPaneFrames}};
  const module={exports:{}};
  const baseline=process.env.KWANT_PANE_VIEWPORT_BASELINE;
  const paneSource=baseline
    ? execFileSync('git',['show',`${baseline==='1'?'3966b6769b415de4e25405188cd97395b21e2668':baseline}:src/components/ChartIndicatorPanes.tsx`],{encoding:'utf8'})
    : fs.readFileSync('src/components/ChartIndicatorPanes.tsx','utf8');
  vm.runInNewContext(ts.transpileModule(paneSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,
    {module,exports:module.exports,require:name=>{assert.ok(name in mocks,name);return mocks[name];},window,document:{addEventListener(){},removeEventListener(){}},console});
  // Exercise the actual Chart subscription callback, not a test-only substitute.
  const sf=ts.createSourceFile('Chart.tsx',fs.readFileSync('src/components/Chart.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback;
  function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='subscribeIndicatorViewport')callback=n.initializer.arguments[0];ts.forEachChild(n,visit);}visit(sf);assert.ok(callback,'Chart must pass a direct native viewport subscription');
  const scale={subscribeVisibleLogicalRangeChange:fn=>listeners.add(fn),unsubscribeVisibleLogicalRangeChange:fn=>listeners.delete(fn)};
  const chartRef={current:{timeScale:()=>scale}};
  const subscribe=vm.runInNewContext(ts.transpileModule('('+callback.getText(sf)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{chartRef});
  const times=[1,2,3];let spacing=50,offset=100;
  const groups=[{key:'cvd',title:'CVD',indicatorId:'cumulative-volume-delta',series:[{key:'cvd-values',label:'CVD',placement:'pane',kind:'candlestick',color:'#00ff00',data:times.map(time=>({time,value:time*5,open:time*5-2,high:time*5+1,low:time*5-3,close:time*5}))}]},
    {key:'stats',title:'KWANT Stats',indicatorId:'kwant-stats',series:[],stats:{showHeader:false,autoFormat:true,coloringDeviation:1,positiveColor:'#00ff00',negativeColor:'#ff0000',neutralColor:'#aaaaaa',textColor:'#ffffff',headerColor:'#000000',metrics:[{key:'totalVolume',label:'VOL',format:'number',tone:'neutral',threshold:0}],bars:times.map(time=>({time,values:{totalVolume:time*100}}))}}];
  const props={groups,coordinateScope:'NQ:1m',width:800,leftInset:36,priceScaleWidth:64,height:240,chartHeight:600,bottom:24,viewportVersion:0,subscribeViewport:subscribe,paneHeights:{cvd:120,stats:120},collapsedPanes:{},paneLayout:{},timeToX:time=>offset+spacing*time,onResizePane(){},onTogglePane(){},onMovePane(){}};
  function render(fn,p,key){const old=active;active=instances.get(key)??{slots:[]};active.cursor=0;instances.set(key,active);const element=fn(p);active=old;return expand(element,key);}
  function expand(element,key){if(element==null||typeof element!=='object')return element;if(Array.isArray(element))return element.map((e,i)=>expand(e,key+'/'+(e?.key??i)));if(typeof element.type==='function')return render(element.type,element.props,key+'/'+(element.key??element.type.name));return {...element,props:{...element.props,children:expand(element.props.children,key+'/children')}};}
  function tree(){dirty=false;const result=render(module.exports.default,props,'root');while(effects.length)effects.shift()();return result;}
  const descendants=(node,fn,result=[])=>{if(Array.isArray(node)){node.forEach(n=>descendants(n,fn,result));return result;}if(node&&typeof node==='object'){if(fn(node))result.push(node);descendants(node.props?.children,fn,result);}return result;};
  return {window,listeners,props,groups,tree,descendants,get dirty(){return dirty;},move(nextOffset,nextSpacing){offset=nextOffset;spacing=nextSpacing;for(const fn of listeners)fn();},dispose(){for(const instance of instances.values())for(const slot of instance.slots)slot?.dispose?.();},nativeCoordinates:()=>times.map(t=>offset+spacing*t-36)};
}

test('actual CVD candles and KWANT Stats cells follow every pan/zoom frame while parent Chart props remain unchanged',()=>{
  const h=harness();h.tree();h.window.paint();
  const source=JSON.stringify(h.groups);
  for(const [offset,spacing]of [[100,50],[130,70],[90,100],[170,110],[60,150]]){
    h.move(offset,spacing);h.move(offset,spacing);assert.equal(h.window.queue.size,1,'coalesce native events per frame');
    h.window.paint();assert.equal(h.dirty,true,'pane updates before a gesture-settle timer');
    const result=h.tree();
    const cvd=h.descendants(result,n=>n.type==='line'&&n.props.stroke==='#00ff00'&&n.props.y1!==n.props.y2);
    assert.deepEqual(Array.from(cvd,n=>n.props.x1),h.nativeCoordinates(),'CVD wick centers align under the current price candles');
    const cells=h.descendants(result,n=>n.type==='text'&&['100','200','300'].includes(String(n.props.children)));
    assert.deepEqual(Array.from(cells,n=>n.props.x),h.nativeCoordinates(),'QuantStats columns align to those same candles');
    assert.equal(h.props.viewportVersion,0,'no parent Chart viewport render is needed');
  }
  assert.equal(JSON.stringify(h.groups),source,'navigation does not mutate CVD or stats values');h.dispose();assert.equal(h.listeners.size,0);
});

test('removing all panes cancels queued viewport work; re-adding binds again and unmount detaches',()=>{
  const h=harness();h.tree();h.move(150,60);assert.equal(h.window.queue.size,1);
  h.props.groups=[];h.tree();assert.equal(h.listeners.size,0);assert.equal(h.window.queue.size,0);
  h.props.groups=h.groups;h.tree();assert.equal(h.listeners.size,1);h.dispose();assert.equal(h.listeners.size,0);assert.equal(h.window.queue.size,0);
});

test('chart recreation rebinds the pane viewport listener instead of retaining a disposed chart',()=>{
  const h=harness();h.tree();assert.equal(h.listeners.size,1);const next=new Set();
  h.props.subscribeViewport=listener=>{next.add(listener);return()=>next.delete(listener);};h.tree();assert.equal(h.listeners.size,0);assert.equal(next.size,1);h.dispose();assert.equal(next.size,0);
});

function axisIn(h,key){return h.descendants(h.tree(),n=>n.props?.['data-indicator-axis']===key)[0];}

test("sparse Book Speed measurements render at the configured width across zoom levels", () => {
  const h = harness();
  try {
    h.props.groups = [{ key: "book", title: "Book Speed", indicatorId: "book-speed",
      series: [{ key: "bid", label: "Bid", placement: "pane", kind: "histogram", color: "#12ab34",
        histogramFixedWidth: 2.5, includeZeroInScale: true, data: [{ time: 1, value: 2 }, { time: 3, value: 4 }] }] }];
    for (const spacing of [50, 150]) {
      h.tree();
      h.move(100, spacing);
      h.window.paint();
      const [path] = h.descendants(h.tree(), node => node.type === "path" && node.props.fill === "#12ab34");
      assert.ok(path);
      assert.deepEqual([...path.props.d.matchAll(/h([\d.]+)v/g)].map(match => Number(match[1])), [2.5, 2.5]);
    }
  } finally {
    h.dispose();
  }
});
function nativeAxisMultiplier(height,startY,currentY){
  const source=fs.readFileSync('node_modules/lightweight-charts/dist/lightweight-charts.development.mjs','utf8');
  const start=source.indexOf('    _internal_scaleTo(x) {'),end=source.indexOf('    _internal_endScale()',start);
  assert.ok(start>=0&&end>start);let multiplier;
  const scaleTo=vm.runInNewContext('({'+source.slice(start,end)+'})._internal_scaleTo',{ensureNotNull:value=>value});
  scaleTo.call({_internal_isPercentage:()=>false,_internal_isIndexedTo100:()=>false,_private__scaleStartPoint:height-startY,_private__height:height,_internal_setMode(){},_private__priceRangeSnapshot:{_internal_clone:()=>({_internal_scaleAroundCenter:value=>{multiplier=value;}})},_internal_setPriceRange(){}},currentY);
  return multiplier;
}
function wickGeometry(h){return h.descendants(h.tree(),n=>n.type==='line'&&n.props.stroke==='#00ff00'&&n.props.y1!==n.props.y2).map(n=>({x:n.props.x1,top:n.props.y1,bottom:n.props.y2}));}
function axisPointer(axis,{shift=false,pointerId=7,button=0}={}){
  const listeners=new Map(),targetListeners=new Map(),capture=new Set();
  const view={addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)};
  const height=axis.props.style.height,top=axis.props.style.top;
  const target={ownerDocument:{defaultView:view},getBoundingClientRect:()=>({top,height}),setPointerCapture:id=>capture.add(id),hasPointerCapture:id=>capture.has(id),releasePointerCapture:id=>capture.delete(id),addEventListener:(key,fn)=>targetListeners.set(key,fn),removeEventListener:key=>targetListeners.delete(key)};
  const event=(offset,id=pointerId)=>({pointerId:id,clientY:top+offset,preventDefault(){},stopPropagation(){}});
  axis.props.onPointerDown({...event(height/2),button,shiftKey:shift,currentTarget:target});
  return {height,listeners,capture,move:(offset,id)=>listeners.get('pointermove')?.(event(offset,id)),end:()=>listeners.get('pointerup')?.(event(height/2)),cancel:()=>listeners.get('pointercancel')?.(event(height/2)),lose:()=>targetListeners.get('lostpointercapture')?.(event(height/2))};
}

test('CVD right-axis drag stretches the rendered plot using a fixed press-time range, independently of the chart',()=>{
  const h=harness(),original=JSON.stringify(h.groups),initial=wickGeometry(h),axis=axisIn(h,'cvd');
  assert.ok(axis);const pointer=axisPointer(axis);
  pointer.move(pointer.height*.2,99);assert.deepEqual(wickGeometry(h),initial,'unrelated pointers cannot affect this gesture');
  pointer.move(pointer.height*.2);const stretched=wickGeometry(h);
  assert.ok(Math.abs(stretched[0].bottom-stretched[0].top)>Math.abs(initial[0].bottom-initial[0].top));
  const ratio=Math.abs((initial[0].bottom-initial[0].top)/(stretched[0].bottom-stretched[0].top));
  assert.ok(Math.abs(ratio-nativeAxisMultiplier(pointer.height,pointer.height/2,pointer.height*.2))<1e-9,'matches the installed native price-axis scale gesture');
  assert.deepEqual(stretched.map(p=>p.x),initial.map(p=>p.x));
  pointer.move(pointer.height*.2);assert.deepEqual(wickGeometry(h),stretched,'same pointer position must not compound the scale');
  pointer.end();assert.equal(pointer.listeners.size,0);assert.equal(pointer.capture.size,0);
  h.move(150,40);h.window.paint();assert.deepEqual(wickGeometry(h).map(p=>[p.top,p.bottom]),stretched.map(p=>[p.top,p.bottom]),'horizontal chart movement preserves the chosen value range');
  assert.equal(JSON.stringify(h.groups),original,'no source values were changed');assert.equal(h.props.viewportVersion,0);h.dispose();
});

test('Shift-axis drag moves the value range without stretching; double-click restores automatic scale',()=>{
  const h=harness(),initial=wickGeometry(h),pointer=axisPointer(axisIn(h,'cvd'),{shift:true});
  pointer.move(pointer.height*.7);const moved=wickGeometry(h);
  assert.notEqual(moved[0].top,initial[0].top);
  assert.ok(Math.abs((moved[0].bottom-moved[0].top)-(initial[0].bottom-initial[0].top))<1e-9);
  pointer.end();axisIn(h,'cvd').props.onDoubleClick({preventDefault(){},stopPropagation(){}});
  assert.deepEqual(wickGeometry(h),initial);h.dispose();
});

test('every numeric lower pane has its own drag axis; tables and collapsed panes do not',()=>{
  const h=harness(),data=[{time:1,value:10},{time:2,value:20},{time:3,value:30}];
  h.props.groups=[...h.groups,{key:'volume',title:'Volume',indicatorId:'volume',series:[{key:'vol',kind:'histogram',color:'#aabbcc',data}]},{key:'rsi',title:'RSI',indicatorId:'rsi',series:[{key:'rsi-line',kind:'line',color:'#ddeeff',data}]}];
  h.props.height=480;h.props.paneHeights={cvd:120,stats:120,volume:120,rsi:120};
  assert.equal(axisIn(h,'stats'),undefined);
  for(const key of ['volume','rsi']){
    const axis=axisIn(h,key);assert.ok(axis);assert.equal(axis.props['aria-valuenow'],100);
    const pointer=axisPointer(axis);pointer.move(pointer.height*.25);pointer.end();
    assert.notEqual(axisIn(h,key).props['aria-valuenow'],100);assert.equal(axisIn(h,'cvd').props['aria-valuenow'],100);
  }
  h.props.collapsedPanes={rsi:true};assert.equal(axisIn(h,'rsi'),undefined);h.dispose();
});

test('axis capture loss, cancellation and component disposal release all drag listeners',()=>{
  for(const end of ['lose','cancel','dispose']){
    const h=harness(),pointer=axisPointer(axisIn(h,'cvd'));assert.equal(pointer.listeners.size,3);
    if(end==='dispose')h.dispose();else pointer[end]();
    assert.equal(pointer.listeners.size,0,end);assert.equal(pointer.capture.size,0,end);
    if(end!=='dispose')h.dispose();
  }
  const h=harness(),pointer=axisPointer(axisIn(h,'cvd'),{button:2});assert.equal(pointer.listeners.size,0);h.dispose();
});

test('numeric pane intervals follow the rendered scale and stay clear of pane controls', () => {
  const h = harness();
  try {
    h.props.groups = [h.groups[0]];
    h.props.paneHeights = {cvd: 230};
    h.props.height = 230;
    h.props.priceScaleWidth = 100;
    const read = () => {
      const root = h.tree();
      const axis = h.descendants(root, n => n.props?.['aria-label'] === 'CVD value scale')[0];
      assert.ok(axis);
      const labels = h.descendants(axis, n => n.type === 'text');
      assert.ok(labels.length >= 3);
      assert.equal(new Set(labels.map(n => n.props.children)).size, labels.length);
      const control = h.descendants(root, n => n.props?.['aria-label'] === 'Minimize CVD pane')[0];
      assert.ok(control.props.style.right > 100);
      return labels.map(n => [n.props.children, n.props.y]);
    };
    const before = read();
    const drag = axisPointer(axisIn(h,'cvd'), {shift:true});
    drag.move(drag.height * .8);
    drag.end();
    assert.notDeepEqual(read(), before);
  } finally {
    h.dispose();
  }
});

test('percent and independent price series keep separate scales and empty panes omit invented ticks', () => {
  const h = harness();
  try {
    h.props.height = 220;
    h.props.paneHeights = {iv: 220};
    const rank = {key:'rank', kind:'line', data:[{time:1,value:29},{time:3,value:60}]};
    const price = {key:'price', kind:'line', label:'SPX', independentScale:true, data:[{time:1,value:5900},{time:3,value:6100}]};
    h.props.groups = [{key:'iv', title:'IV Rank', indicatorId:'implied-volatility-rank', percentageAxis:true,
      fixedDomain:{min:0,max:100}, secondaryAxisSeriesKey:'price', series:[rank,price]}];
    const getLabels = name => {
      const axis = h.descendants(h.tree(), n => n.props?.['aria-label'] === name)[0];
      return h.descendants(axis, n => n.type === 'text' && n.props.dominantBaseline === 'central');
    };
    const rankLabels = getLabels('IV Rank percentage scale');
    const priceLabels = getLabels('SPX value scale');
    assert.ok(rankLabels.length > 1 && rankLabels.every(n => n.props.children.endsWith('%') && n.props.textAnchor === 'end'));
    assert.ok(priceLabels.length > 1 && priceLabels.every(n => !n.props.children.endsWith('%') && n.props.textAnchor === 'start'));
    h.props.groups[0].series = [{...rank, data:[]}];
    assert.equal(getLabels('IV Rank percentage scale').length, 0);
  } finally {
    h.dispose();
  }
});

test('axis spacing and precision adapt to tight, signed and abbreviated ranges', () => {
  const labels = (min,max,height) => ticks.indicatorAxisTicks({min,max},height).map(t => t.label);
  assert.deepEqual(labels(91,95,155), ['91','92','93','94','95']);
  assert.deepEqual(labels(-98000,-95000,100), ['-98K','-97K','-96K','-95K']);
  assert.deepEqual(labels(-0.005,0.005,240), ['-0.005','-0.004','-0.003','-0.002','-0.001','0','0.001','0.002','0.003','0.004','0.005']);
  assert.ok(labels(90.1,95,25).length > 0);
});

test('every catalog study emitting numeric pane data uses the shared graduated axis', t => {
  const h = harness();
  try {
    h.props.height = 240;
    const candles = Array.from({length:300}, (_, i) => {
      const close = 1000 + i * .1 + Math.sin(i / 5) * 5;
      return {timestamp:(i+1)*60_000, open:close-.25, high:close+1, low:close-1,
        close, volume:80 + i % 20, bidVolume:30, askVolume:50 + i % 20, delta:20 + i % 20};
    });
    const theme = {primary:'#fff', secondary:'#ccc', positive:'#0f0', negative:'#f00', muted:'#aaa'};
    const checked = [];
    for (const {id,name} of CHART_INDICATOR_CATALOG) {
      const series = calculateIndicatorSeries({instanceId:id, indicatorId:id, enabled:true, settings:{}},candles,theme,
        {instrument:'NQ',tickSize:.25})
        .filter(plot => plot.placement === 'pane' && plot.data.length)
        .map(plot => ({...plot,data:plot.data.slice(-3).map((point,i) => ({...point,time:i+1}))}));
      if (!series.some(plot => !plot.excludeFromAutoScale && !plot.horizontalPriceLine)) continue;
      h.props.groups = [{key:id,title:name,indicatorId:id,series}];
      h.props.paneHeights = {[id]:240};
      const valueAxes = h.descendants(h.tree(), node => node.type === 'g' && node.props?.['aria-label']?.endsWith(' value scale'));
      assert.ok(valueAxes.length, name);
      for (const axis of valueAxes) {
        const labels = h.descendants(axis, node => node.type === 'text');
        assert.ok(labels.length >= 2, name);
        assert.equal(new Set(labels.map(label => label.props.children)).size, labels.length, name);
      }
      checked.push(id);
    }
    assert.ok(checked.length >= 15);
    t.diagnostic(checked.join(', '));
  } finally {
    h.dispose();
  }
});

test("shared pane legends omit repeated headings and retain distinct plot names", () => {
  const h = harness();
  try {
    const series = (key, label) => ({ key, label, placement: "pane", kind: "line",
      color: "#123abc", data: [{ time: 1, value: 10 }, { time: 2, value: 12 }] });
    const title = "Cumulative Delta Candlestick";
    h.props.groups = [{
      key: "delta", title, indicatorId: "delta-cumulative-candlestick",
      series: [series("main", title), series("average", "Average"), series("repeat", " average ")],
    }];
    const labels = () => h.descendants(h.tree(), n => n.type === "text").map(n => n.props.children);
    assert.equal(labels().filter(label => label === title).length, 1);
    assert.equal(labels().filter(label => String(label).trim().toLowerCase() === "average").length, 1);

    h.props.groups = [{
      key: "adx", title: "ADX (14)", indicatorId: "average-directional-index-adx",
      series: [series("adx", "ADX"), series("plus", "+DI"), series("minus", "-DI")],
    }];
    assert.equal(labels().includes("ADX"), false);
    assert.ok(labels().includes("ADX (14)"));
    assert.ok(labels().includes("+DI"));
    assert.ok(labels().includes("-DI"));
    h.props.groups[0].showHeader = false;
    assert.ok(labels().includes("ADX"), "keep the legend name when the heading is hidden");
  } finally {
    h.dispose();
  }
});
