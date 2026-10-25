import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {candleBodyWidth,paintCandlestick} from '../public/kwanty-app/candlestick-paint.js';

// Execute the installed normal Charts library's real renderer, not a duplicate
// test implementation. Same-colour solid borders have the same filled geometry.
const library=readFileSync(new URL('../node_modules/lightweight-charts/dist/lightweight-charts.development.mjs',import.meta.url),'utf8');
const reference={BitmapCoordinatesPaneRenderer:class {}};
vm.runInNewContext(library.slice(library.indexOf('function optimalCandlestickWidth('),library.indexOf('class PaneRendererBars '))+library.slice(library.indexOf('class PaneRendererCandlesticks '),library.indexOf('class SeriesCandlesticksPaneView '))+';globalThis.Renderer=PaneRendererCandlesticks;',reference);
const recorder=ratio=>{const rects=[];return {rects,fillRect(x,y,w,h){if(w>0&&h>0)rects.push([x,y,w,h]);},getTransform:()=>({a:ratio,d:ratio})};};

test('Kwanty body and wick pixels match the installed normal-chart renderer at every tested zoom/DPI',()=>{
 for(const ratio of [1,1.25,1.5,2,3])for(const spacing of [1,2,2.5,3,4,6,10,40,80])for(const [openY,closeY]of [[100.2,140.6],[140.6,100.2],[100.2,100.2]]){
  const normal=recorder(ratio),kwanty=recorder(ratio),candle={x:150.3,openY,closeY,highY:80.4,lowY:160.7,spacing,color:'#39bcfa'};
  const renderer=new reference.Renderer();renderer._internal_setData({_internal_barSpacing:spacing,_internal_wickVisible:true,_internal_borderVisible:false,_internal_visibleRange:{from:0,to:1},_internal_bars:[{_internal_x:candle.x,_internal_openY:openY,_internal_closeY:closeY,_internal_highY:candle.highY,_internal_lowY:candle.lowY,_internal_barColor:candle.color,_internal_barWickColor:candle.color}]});
  renderer._internal__drawImpl({context:normal,horizontalPixelRatio:ratio,verticalPixelRatio:ratio});
  paintCandlestick(kwanty,candle);
  const pixels=kwanty.rects.map(rect=>rect.map(value=>Math.round(value*ratio)));
  assert.deepEqual(pixels,normal.rects,`ratio ${ratio}, spacing ${spacing}, open ${openY}, close ${closeY}`);
 }
});

test('square dojis and true absent wicks do not acquire cosmetic high/low extensions',()=>{
 const ctx=recorder(2);const result=paintCandlestick(ctx,{x:10,openY:20,closeY:20,highY:20,lowY:20,spacing:10,color:'#fff'});
 assert.equal(ctx.rects.length,1);assert.equal(result.body.height,1);assert.equal(result.upper.height,0);assert.equal(result.lower.height,0);
 assert.equal(ctx.rects[0][3],.5,'doji occupies one device pixel, not a rounded pill');
});

test('wick rectangles ignore inherited thick/dashed line state and keep true high/low endpoints',()=>{
 const ctx=recorder(1.5);ctx.lineWidth=9;ctx.lineCap='round';
 const result=paintCandlestick(ctx,{x:10.6,openY:40,closeY:60,highY:20,lowY:90,spacing:12,color:'#fff'});
 assert.equal(result.upper.y,30);assert.equal(result.lower.y+result.lower.height,136);
 assert.equal(result.upper.width,1);assert.equal(ctx.lineWidth,9);assert.equal(ctx.lineCap,'round');
 assert.ok(ctx.rects.every(rect=>rect.every(Number.isFinite)));
});

test('zoom width has no former 18/24-pixel cap and is independent of missing neighbours',()=>{
 assert.ok(candleBodyWidth(80)>24);assert.ok(candleBodyWidth(40)>candleBodyWidth(10));
 const ctx=recorder(1),options={x:10,openY:40,closeY:60,highY:20,lowY:90,spacing:12,color:'#fff'};
 assert.deepEqual(paintCandlestick(ctx,options).body,paintCandlestick(ctx,{...options,x:10}).body);
 for(const invalid of [{spacing:0},{highY:50},{lowY:50},{x:NaN}])assert.equal(paintCandlestick(ctx,{...options,...invalid}),null);
});
