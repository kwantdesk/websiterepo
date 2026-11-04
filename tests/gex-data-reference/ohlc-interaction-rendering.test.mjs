import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {priceChartRows,priceChartTooltipRows,priceContractSelection,stockPriceSessionRows} from '../../public/gex-data-app/ohlc-interaction-model.js';
import {priceChartPresentation,priceChartBounds,drawPriceCandles,drawOptionVolume} from '../../public/gex-data-app/equity-renderers.js';
import {niceValueDomain} from '../../public/gex-data-app/exposure-models.js';
import {timeDomain,timeX} from '../../public/gex-data-app/time-axis.js';
import {currencyAuto,abbreviate,abbreviatedTick} from '../../public/gex-data-app/number-format.js';

const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');
function actual(name){const start=source.indexOf('  function '+name+'('),end=source.indexOf('\n  function ',start+1);assert.ok(start>=0&&end>start);return source.slice(start,end);}
const T=Date.parse('2026-10-16T13:30:00Z');
const point=(openPrice,closePrice,highPrice=Math.max(openPrice??0,closePrice??0)+1,lowPrice=Math.min(openPrice??0,closePrice??0)-1)=>({openPrice,closePrice,highPrice,lowPrice});
const texts=rows=>Array.from(rows).flatMap(row=>typeof row==='string'?[row]:row.separator?[]:row.columns?texts(row.columns.flat()):[row.parts.map(part=>part.text).join('')]);

test('Stock New York slice includes 09:30 and 16:15, excludes surrounding minutes, handles winter and summer offsets',()=>{
  for(const start of ['2026-01-02T14:30:00Z','2026-07-01T13:30:00Z']){
    const time=Date.parse(start),rows=[-60000,0,405*60000,406*60000].map(offset=>({time:time+offset})),before=structuredClone(rows);
    assert.deepEqual(stockPriceSessionRows(rows),[rows[1],rows[2]]);assert.deepEqual(rows,before);
  }
});

test('Stock source fallback preserves all premarket-only, after-hours-only and inverted-bound observations',()=>{
  for(const rows of [[{time:T-3600000},{time:T-60000}],[{time:T+8*3600000},{time:T+9*3600000}],[{time:T-60000},{time:T+8*3600000}]])assert.deepEqual(stockPriceSessionRows(rows),rows);
});

test('Explicit zero open/close sentinels carry observed values while high/low and raw history remain untouched',()=>{
  const payload={data:{[T]:point(0,0,0,0),[T+60000]:point(100,102,105,99),[T+120000]:point(0,0,103,101),[T+180000]:point(null,104,106,100)}},before=structuredClone(payload);
  const result=priceChartRows(payload);assert.equal(result.rawRows.length,4);assert.equal(result.rows.length,3);
  assert.deepEqual(result.rows.map(row=>[row.open,row.close,row.high,row.low]),[[100,102,105,99],[100,102,103,101],[null,104,106,100]]);
  assert.deepEqual(payload,before);assert.equal(result.rawRows[2].open,0);
});

test('Contracts retain extended-hours primary data and do not fabricate independent underlying observations',()=>{
  const payload={data:{[T-3600000]:{...point(2,3),volume:100},[T+8*3600000]:{...point(3,4),volume:200}}};
  const rows=priceChartRows(payload,{option:true}).rows;assert.equal(rows.length,2);assert.ok(rows.every(row=>row.spot===null));
  assert.equal(texts(priceChartTooltipRows(rows[0],{option:true,ticker:'SPY',expirationDate:'2026-10-16',strikePrice:760,contractType:'CALL'})).at(-2),'Underlying: —');
});

test('Missing high/low observations never acquire invented wicks or a fabricated candle body',()=>{
  const payload={data:{[T]:point(100,101,null,null)}},rows=priceChartRows(payload).rows;
  assert.equal(rows[0].high,null);assert.equal(rows[0].low,null);
  let painted=0;const ctx={beginPath(){painted++;},fillRect(){painted++;}};
  drawPriceCandles(ctx,rows,()=>10,value=>value,20);assert.equal(painted,0);
  assert.equal(payload.data[T].highPrice,null);assert.equal(payload.data[T].lowPrice,null);
});

test('Source OHLC tooltip has full labels, automatic currency and semantic per-value colors without an invented clock or percentage',()=>{
  const rows=priceChartTooltipRows({open:100,close:102,low:99,high:105},{ticker:'SPY'});
  assert.deepEqual(texts(rows),['SPY','Open: $100','Close: $102','Low: $99','High: $105']);
  assert.deepEqual(rows.find(row=>row.columns).columns.flat().map(row=>row.parts[1].tone),['bullish','bullish','bearish','bullish']);
  const equal=priceChartTooltipRows({open:100,close:100,low:100,high:100},{ticker:'SPY'});assert.ok(equal.find(row=>row.columns).columns.flat().every(row=>row.parts[1].tone===null));
});

test('Contract OSI description, true underlying, volume precision and non-mutating selection',()=>{
  const selected=priceContractSelection({ticker:'QQQ',osi:'SPY261016P00760000'});
  assert.deepEqual(selected,{ticker:'SPY',expirationDate:'2026-10-16',strikePrice:760,contractType:'PUT'});
  const rows=priceChartTooltipRows({open:1,close:1.25,low:.5,high:2,spot:761.1,volume:1235},{option:true,...selected});
  assert.deepEqual(texts(rows),['SPY','October 16, 2026 $760 Put','Open: $1','Close: $1.25','Low: $0.50','High: $2','Underlying: $761.10','Option Volume: 1.24 K']);
});

function harness(controls={},view='ohlc'){
  const specs=[],axes=[],labels=[],candleCalls=[];
  const env={getControl:key=>controls[key]??({ticker:'SPY',chartType:'candles',contractType:'CALL',expiry:'2026-10-16',strike:'760'})[key]??'',
    priceChartRows,priceContractSelection,priceChartTooltipRows,priceChartPresentation,priceChartBounds,niceValueDomain,timeDomain,timeX,currencyAuto,abbreviate,abbreviatedTick,
    CHART_COLORS:{primary:'#FFF',price:'price',call:'green',put:'red'},themePaint:value=>value,actionForeground:()=> '#000',toolConfiguration:{hideCrosshairs:false},
    quantCanvas:spec=>specs.push(spec),setSummary(){},quantLine(){},drawPriceCandles:(...args)=>{candleCalls.push(args);return drawPriceCandles(...args);},drawOptionVolume,
    drawHorizontalTicks(){},drawAxisLabels:(_,options)=>axes.push(options),drawTimeLabels(){},drawChartCrosshair(){},chartStrikeLabel:currencyAuto,
    displayChartTime:time=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}).format(time),
  };
  vm.runInNewContext(actual('renderOhlcQuant')+'\nthis.render=renderOhlcQuant;',env);
  const ctx=new Proxy({measureText:text=>({width:String(text).length*7}),fillText:text=>labels.push(text)},{get:(target,key)=>key in target?target[key]:(...args)=>assert.ok(args.filter(value=>typeof value==='number').every(Number.isFinite)),set:(target,key,value)=>{target[key]=value;return true;}});
  return {env,specs,axes,labels,candleCalls,render:payload=>env.render(payload,{view,title:view==='ohlc'?'Stock Price / Time':'Contract Price / Time'}),draw:state=>specs[0].draw(ctx,900,540,state)};
}

test('Actual Stock renderer keeps untrimmed header close, genuine RTH candle wicks and hovered minute on the axis',()=>{
  const h=harness();h.render({data:{[T-60000]:point(90,91),[T]:point(100,102,106,98),[T+60000]:point(102,103,104,99),[T+8*3600000]:point(110,111)}});
  const spec=h.specs[0];assert.equal(spec.items.length,2);assert.equal(spec.legend[0].value,'$111');
  assert.deepEqual(texts(spec.tooltipRows(spec.items[0])),['SPY','Open: $100','Close: $102','Low: $98','High: $106']);
  h.draw({start:0,end:1,hover:0,hoverRatio:.25,pointerX:150,pointerY:100});assert.equal(h.candleCalls[0][1][0].high,106);assert.equal(h.candleCalls[0][1][0].low,98);assert.ok(h.labels.some(label=>/9:30/.test(label)));
});

test('Actual Contract renderer uses Contract legend, includes full contract tooltip, and retains missing underlying as absent',()=>{
  const h=harness({},'optionOhlc');h.render({data:{[T]:{...point(2,3),volume:1235},[T+60000]:{...point(3,4),volume:2345}}});
  assert.deepEqual(Array.from(h.specs[0].legend,item=>item.label),['Contract']);assert.equal(h.specs[0].legend[0].value,'$4');
  assert.equal(texts(h.specs[0].tooltipRows(h.specs[0].items[0]))[1],'October 16, 2026 $760 Call');h.draw({start:0,end:1});
  assert.equal(h.axes.some(axis=>axis.rightSide),false);assert.equal(h.axes.find(axis=>axis.label==='Option Volume').formatter(12350),'12.35 K');assert.equal(h.axes.find(axis=>axis.label==='Option Volume').formatter(1250),'1.25 K');
});

test('OHLC axis time badge respects crosshair visibility and exact finite plot bounds, including the volume pane',()=>{
  for(const [pointerX,pointerY]of [[77,100],[871,100],[150,11],[150,507],[NaN,100],[150,NaN]]){
    const h=harness();h.render({data:{[T]:point(100,101),[T+60000]:point(101,102)}});h.draw({start:0,end:1,hover:0,pointerX,pointerY});assert.equal(h.labels.length,0);
  }
  const hidden=harness();hidden.env.toolConfiguration.hideCrosshairs=true;hidden.render({data:{[T]:point(100,101)}});hidden.draw({start:0,end:0,hover:0,pointerX:150,pointerY:100});assert.equal(hidden.labels.length,0);
  const volume=harness({},'optionOhlc');volume.render({data:{[T]:{...point(2,3),volume:10}}});volume.draw({start:0,end:0,hover:0,pointerX:150,pointerY:500});assert.ok(volume.labels.some(label=>/9:30/.test(label)));
});

test('Actual generic tooltip renderer keeps strings/numbers and colors only confirmed semantic value parts as text',()=>{
  const env={CHART_COLORS:{call:'green',put:'red'},element:(tag,cls,text)=>({tag,textContent:text,style:{},children:[],append(node){this.children.push(node);}})};
  vm.runInNewContext(actual('chartTooltipRow')+'\nthis.render=chartTooltipRow;',env);
  assert.equal(env.render('Plain legacy tooltip',0).tag,'b');assert.equal(env.render(123,1).textContent,123);
  const node=env.render({parts:[{text:'Open: '},{text:'$100',tone:'bullish'},{text:'<script>literal</script>',tone:'bearish'}]},1);
  assert.equal(node.children[1].style.color,'green');assert.equal(node.children[2].style.color,'red');assert.equal(node.children[2].textContent,'<script>literal</script>');assert.equal(Object.hasOwn(node,'innerHTML'),false);
});

test('Actual OHLC tooltip DOM uses source two-column Open/Close vs Low/High layout, separators and Contract-only footer',()=>{
  const env={CHART_COLORS:{call:'green',put:'red'},element:(tag,cls,text)=>({tag,className:cls,textContent:text,style:{},children:[],append(node){this.children.push(node);}})};
  vm.runInNewContext(actual('chartTooltipRow')+'\nthis.render=chartTooltipRow;',env);
  const row={open:100,close:101,high:102,low:99,spot:760,volume:1235};
  for(const option of [false,true]){
    const model=priceChartTooltipRows(row,{option,ticker:'SPY',expirationDate:'2026-10-16',strikePrice:760,contractType:'CALL'}),nodes=model.map(env.render);
    assert.equal(nodes.filter(node=>node.tag==='hr').length,option?2:1);
    const grids=nodes.filter(node=>node.className==='chart-tooltip-ohlc-grid');assert.equal(grids.length,option?2:1);
    assert.equal(grids[0].children.length,2);assert.deepEqual(grids[0].children.map(column=>column.children.map(metric=>metric.children.map(part=>part.textContent).join(''))),[['Open: $100','Close: $101'],['Low: $99','High: $102']]);
    if(option){assert.equal(nodes[1].textContent,'October 16, 2026 $760 Call');assert.equal(grids[1].children.length,1);assert.deepEqual(grids[1].children[0].children.map(node=>node.textContent),['Underlying: $760','Option Volume: 1.24 K']);}
  }
  const css=readFileSync(new URL('../../public/gex-data-app/styles.css',import.meta.url),'utf8');assert.match(css,/\.chart-tooltip \.chart-tooltip-ohlc-grid\s*\{[^}]*display:\s*grid/);
});
