import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {niceValueDomain} from '../../public/gex-data-app/exposure-models.js';
import {averagedIvRank} from '../../public/gex-data-app/chart-primitives.js';
import {currencyAuto,percentagePointsAuto} from '../../public/gex-data-app/number-format.js';
const app=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),start=app.indexOf('  function renderIvRankQuant('),source=app.slice(start,app.indexOf('\n  function ',start+1));
const leg=(lastIv,windowMinIv=10,windowMaxIv=30)=>({lastIv,windowMinIv,windowMaxIv});
function harness(payload){
 let spec;const lines=[],texts=[],ctx=new Proxy({measureText:text=>({width:String(text).length*7}),fillText:(text,x,y)=>{assert.ok(Number.isFinite(x)&&Number.isFinite(y));texts.push({text,x,y});}},{get:(target,key)=>target[key]??((...args)=>assert.ok(args.filter(v=>typeof v==='number').every(Number.isFinite)))});
 const env={getControl:()=> 'SPY',averagedIvRank,quantCanvas:value=>{spec=value;},setSummary(){},CHART_COLORS:{primary:'primary',price:'spot',grid:'grid'},themePaint:v=>v,currencyAuto,percentagePointsAuto,formatPrice:currencyAuto,chartStrikeLabel:currencyAuto,niceValueDomain,toolConfiguration:{},drawChartCrosshair(){},quantLine(_ctx,points,color){assert.ok(points.every(point=>point.every(Number.isFinite)));lines.push({points,color});}};
 vm.runInNewContext(source+'\nthis.render=renderIvRankQuant;',env);env.render(payload);
 return {spec,lines,texts,draw:(state={start:0,end:spec.items.length-1})=>spec.draw(ctx,900,540,state)};
}
test('actual IV Rank averages inputs before ranking and uses only the sorted union of genuine rank/stock dates',()=>{
 const h=harness({data:{'2026-10-21':{contractTypeToIVData:{CALL:leg(22)}},'2026-10-19':{},'2026-10-20':{stockPrice:761},'2026-10-16':{stockPrice:760,contractTypeToIVData:{CALL:leg(22),PUT:leg(8,5,15)}},'2026-10-22':null,invalid:{stockPrice:100}}});h.draw();
 assert.deepEqual(Array.from(h.spec.items,row=>row.date),['2026-10-16','2026-10-20','2026-10-21']);assert.equal(h.spec.items[0].rank,50);
 assert.equal(h.spec.legend[0].value,'60.00%');assert.equal(h.spec.legend[1].value,'$761');assert.equal(h.lines.filter(line=>line.color==='#FFFF00').length,2,'missing rank must split the line');assert.equal(h.lines.find(line=>line.color==='spot').points.length,2);
 assert.deepEqual(Array.from(h.spec.tooltipRows(h.spec.items[1])),['Oct 20, 2026','Underlying Price: $761']);assert.deepEqual(Array.from(h.spec.tooltipRows(h.spec.items[2])),['Oct 21, 2026','IV Rank: 60%']);
});
test('single-session rank, stock, nearest tooltip and crosshair share the centered category coordinate',()=>{
 const h=harness({data:{'2026-10-16':{stockPrice:760.5,contractTypeToIVData:{CALL:leg(19.5)}}}});h.draw();assert.ok(h.lines.every(line=>line.points[0][0]===450));
 const state={pointerX:800};assert.deepEqual(Array.from(h.spec.tooltipRows(h.spec.items[0],0,state)),['Oct 16, 2026','IV Rank: 47.50%','Underlying Price: $760.50']);assert.equal(state.hoverRatio,.5);assert.equal(h.spec.legend[0].value,'47.50%');
});
test('rank and stock curves retain category spacing across weekends and fractional zoom',()=>{
 const h=harness({data:{'2026-10-16':{stockPrice:760,contractTypeToIVData:{CALL:leg(19)}},'2026-10-19':{stockPrice:761,contractTypeToIVData:{CALL:leg(20)}},'2026-10-20':{stockPrice:762,contractTypeToIVData:{CALL:leg(21)}}}});h.draw();assert.deepEqual(Array.from(h.lines[0].points,p=>p[0]),[78,450,822]);
 h.draw({start:0,end:2,rawStart:.5,rawEnd:1.5});assert.equal(h.lines.at(-1).points[1][0],450);const state={pointerX:450};assert.equal(h.spec.tooltipRows(h.spec.items[0],0,state)[0],'Oct 19, 2026');assert.equal(state.hover,1);
});
test('AUTO percentages round before formatting and never infer values from absent inputs',()=>{
 for(const [value,text]of [[15.5,'15.50%'],[15,'15%'],[14.999,'15%'],[0,'0%'],[null,'—'],['','—'],[NaN,'—']])assert.equal(percentagePointsAuto(value),text);
 for(const payload of [{data:{}},{data:{'2026-10-16':{stockPrice:null}}},{data:{'2026-10-16':null}}]){const h=harness(payload);assert.equal(h.spec.items.length,0);h.draw();}
});
