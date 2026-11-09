import {surfaceForeground} from '../../public/gex-data-app/site-theme.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {heatMapCellPoint,heatMapTooltipRows} from '../../public/gex-data-app/additional-tool-renderers.js';
import {heatMetricFor,heatMapInitialWindow} from '../../public/gex-data-app/exposure-models.js';
import {abbreviate,currencyAbbreviated} from '../../public/gex-data-app/number-format.js';

const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),renderer=source.slice(source.indexOf('  function renderHeatMap(payload)'),source.indexOf('  function renderMarketMap(payload)'));
const expiries=Array.from({length:33},(_,index)=>new Date(Date.UTC(2026,9,16+index,12)).toISOString().slice(0,10)),strikes=Array.from({length:101},(_,index)=>713+index);
const data=Object.fromEntries(expiries.map((expiry,index)=>[expiry,Object.fromEntries(strikes.map(strike=>[strike,{callValue:index+strike,putValue:-strike}]))]));
function factory(invert=false,spot,{strikeLabel=value=>'$'+value,mode='NET_GAMMA_EXPOSURE',rawData=data}={}){
  if(arguments.length<2)spot=763;
  let spec;const raw=structuredClone(rawData),before=JSON.stringify(raw);
  const env={heatMapCellPoint,heatMapTooltipRows,heatMetricFor,heatMapInitialWindow,showVisual(){},
    activeTool:{id:'heat-map'},toolConfiguration:{},buildRequest:()=>({sessionDate:'2026-10-16',dataMode:mode,filter:{ticker:'SPY'}}),
    getControl:key=>({ticker:'SPY',heatMetric:mode,heatAxes:invert?'INVERTED':'NORMAL'})[key],
    q:()=>{throw Error('Heat Map must not read an unmeasured holder width.');},themePaint:value=>value,surfaceForeground,CHART_COLORS:{primary:'#700FEC'},
    chartStrikeLabel:strikeLabel,formatPrice:value=>'$'+value,compact:(value,money)=>money?currencyAbbreviated(value,2):abbreviate(value,2),heatCellColor:()=> '#700FEC',
    quantCanvas:value=>{spec=value;},setSummary(){},
  };
  vm.runInNewContext(renderer+';this.render=renderHeatMap;',env);env.render({data:raw,_spot:spot});assert.equal(JSON.stringify(raw),before);
  return spec;
}
for(const invert of [false,true])test(`actual Heat Map factory defers ${invert?'inverted':'normal'} geometry to measured canvas width and height`,()=>{
  const spec=factory(invert);assert.equal(typeof spec.initialWindow,'function');assert.equal(spec.twoDimensional,true);
  for(const [width,height] of [[1240,600],[900,420],[600,700]]){
    const actual=spec.initialWindow({width,height}),expected=heatMapInitialWindow(width,height,expiries,strikes,763,invert),verticalLength=invert?expiries.length:strikes.length;
    assert.equal(actual.start,expected.horizontal[0]);assert.equal(actual.end,expected.horizontal[1]);assert.deepEqual(Array.from(actual.yWindow),expected.vertical.map(index=>index/(verticalLength-1)));
  }
});
test('missing spot retains no fabricated initial window and leaves the normal full-view fallback available',()=>{
  const spec=factory(false,undefined);assert.equal(spec.initialWindow({width:1240,height:600}),null);
});

function drawnHorizontalLabels(spec,{width=1280,height=540,start=0,end=15,measure=text=>String(text).length*7}={}){
  const labels=[],ctx=new Proxy({measureText:text=>({width:measure(text)}),fillText:(text,x,y)=>{if(y===height-15)labels.push(String(text));}},{get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>{target[key]=value;return true;}});
  spec.draw(ctx,width,height,{start,end,yWindow:[0,.5]});return labels;
}
test('actual inverted Heat Map draws all25 strike labels when measured labels plus source12px gap fit each cell',()=>{
  const labels=drawnHorizontalLabels(factory(true,763),{start:strikes.indexOf(751),end:strikes.indexOf(775)});
  assert.deepEqual(labels,Array.from({length:25},(_,index)=>'$'+(751+index)));
});
test('strike label stride follows formatted glyph width rather than a fixed price-label width',()=>{
  const spec=factory(true,763,{strikeLabel:value=>'$'+value+'.00'}),labels=drawnHorizontalLabels(spec,{start:strikes.indexOf(751),end:strikes.indexOf(775)});
  // Seven measured glyphs at7px plus12px gap exceed the44.08px cells.
  assert.deepEqual(labels,Array.from({length:13},(_,index)=>'$'+(751+index*2)+'.00'));
});
test('only visible labels determine density; an off-screen long strike label cannot hide current ticks',()=>{
  const spec=factory(true,763,{strikeLabel:value=>value===713?'$123,456,789,012':'$'+value}),labels=drawnHorizontalLabels(spec,{start:strikes.indexOf(751),end:strikes.indexOf(775)});
  assert.equal(labels.length,25);assert.equal(labels[0],'$751');assert.equal(labels.at(-1),'$775');
});
test('source minimum24px label width remains in the stride even for very short labels',()=>{
  const spec=factory(true,763,{strikeLabel:()=> 'x'}),labels=drawnHorizontalLabels(spec,{width:803,start:strikes.indexOf(751),end:strikes.indexOf(775),measure:()=>1});
  // 625px/25=25px cells; source max(24,1)+12 requires every second tick.
  assert.equal(labels.length,13);
});
test('normal expiry-axis density also uses measured visible date labels rather than fixed110px',()=>{
  const spec=factory(false,763),labels=drawnHorizontalLabels(spec,{width:1500,measure:()=>60});
  assert.equal(labels.length,16);assert.equal(labels[0],new Date(expiries[0]+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}));
});

const deltaData=Object.fromEntries(expiries.map(expiry=>[expiry,Object.fromEntries(strikes.map(strike=>[strike,{value:-.012345}]))]));
function drawnCellLabels(spec,{width=1280,height=503,start=strikes.indexOf(751),end=strikes.indexOf(775),yWindow=[0,15/(expiries.length-1)]}={}){
  const labels=[],ctx=new Proxy({measureText:text=>({width:String(text).length*Number(/(\d+)px/.exec(ctx.font)?.[1]||11)*.6}),fillText:(text,x,y)=>{if(String(text)==='-0.01235'&&x>=128&&x<=width-50&&y>=10&&y<=height-34)labels.push({text,font:ctx.font});}},{get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>{target[key]=value;return true;}});
  spec.draw(ctx,width,height,{start,end,yWindow});return labels;
}
test('actual inverted PUT_DELTA fits every visible cell by shrinking its font while retaining all five decimals',()=>{
  const labels=drawnCellLabels(factory(true,763,{mode:'PUT_DELTA',rawData:deltaData}));assert.equal(labels.length,25*16);
  assert.ok(labels.every(label=>label.text==='-0.01235'));assert.ok(labels.every(label=>label.font==='700 8px Aleph, sans-serif'));
});
test('adaptive cell labels keep the source6px readability floor when columns become too narrow',()=>{
  const labels=drawnCellLabels(factory(true,763,{mode:'PUT_DELTA',rawData:deltaData}),{width:803});assert.equal(labels.length,0);
});
test('zoomed-in cell labels can grow to the source22px cap without changing the formatted value',()=>{
  const labels=drawnCellLabels(factory(true,763,{mode:'PUT_DELTA',rawData:deltaData}),{end:strikes.indexOf(752),yWindow:[0,1/(expiries.length-1)]});assert.equal(labels.length,4);assert.ok(labels.every(label=>label.font==='700 22px Aleph, sans-serif'));
});
test('source3000-cell density guard suppresses unreadable labels independently of raw cell data',()=>{
  const labels=drawnCellLabels(factory(true,763,{mode:'PUT_DELTA',rawData:deltaData}),{width:20300,height:10000,start:0,end:strikes.length-1,yWindow:[0,1]});assert.equal(labels.length,0);
});
