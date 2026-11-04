import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {niceValueDomain,MAX_PAIN_STYLES} from '../../public/gex-data-app/exposure-models.js';
import {currencyAuto} from '../../public/gex-data-app/number-format.js';

const app=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),start=app.indexOf('  function renderMaxPainTimeQuant('),source=app.slice(start,app.indexOf('\n  function ',start+1));
function harness(payload){
  let spec;const lines=[],texts=[],ctx=new Proxy({measureText:text=>({width:String(text).length*7}),fillText:(text,x,y)=>{assert.ok(Number.isFinite(x)&&Number.isFinite(y));texts.push({text,x,y});}},{get:(target,key)=>target[key]??((...args)=>assert.ok(args.filter(v=>typeof v==='number').every(Number.isFinite)))});
  const env={getControl:()=> 'SPY',parsePrices:()=>payload.spot==null?[]:[{spot:payload.spot}],quantCanvas:value=>{spec=value;},setSummary(){},CHART_COLORS:{primary:'primary',price:'curve',grid:'grid'},themePaint:v=>v,currencyAuto,formatPrice:currencyAuto,chartStrikeLabel:currencyAuto,MAX_PAIN_STYLES,niceValueDomain,toolConfiguration:{},drawChartCrosshair(){},
    quantLine(_ctx,points,color){assert.ok(points.every(point=>point.every(Number.isFinite)));lines.push({points,color});}};
  vm.runInNewContext(source+'\nthis.render=renderMaxPainTimeQuant;',env);env.render(payload);
  return {spec,lines,texts,draw:(state={start:0,end:spec.items.length-1})=>spec.draw(ctx,900,540,state)};
}

test('actual Max Pain / Time retains real dollar values and delivered expiry order, rejecting missing values and invalid dates',()=>{
  const h=harness({data:{'2027-01-15':730,'2026-10-16':770,'2026-10-19':null,'2026-10-20':'','2026-10-21':false,'2026-02-30':500,'2026-10-22':'771'}});
  assert.deepEqual(Array.from(h.spec.items,row=>[row.date,row.value]),[['2027-01-15',730],['2026-10-16',770]]);h.draw();
});

test('actual expiry line and nearest tooltip use identical category bounds and earlier midpoint selection',()=>{
  const h=harness({data:{'2026-10-16':770,'2026-10-20':771,'2027-01-15':730},spot:762.74});h.draw();
  assert.equal(h.spec.plotLeft,94);assert.equal(h.spec.plotRight,28);assert.deepEqual(Array.from(h.lines[0].points,p=>p[0]),[94,483,872]);assert.equal(h.spec.legend[0].color,'primary');assert.equal(h.lines[0].color,'curve','reference deliberately uses a lighter primary shade for its curve');
  const state={pointerX:483};assert.deepEqual(Array.from(h.spec.tooltipRows(h.spec.items[0],0,state)),['Oct 20, 2026','Max Pain Strike Price: $771']);assert.equal(state.hover,1);assert.equal(state.hoverRatio,.5);
  const tie={pointerX:94+389/2};assert.equal(h.spec.tooltipRows(h.spec.items[2],2,tie)[0],'Oct 16, 2026');assert.equal(tie.hover,0);
  assert.equal(h.spec.legend[1].value,'$762.74');assert.ok(h.texts.some(row=>row.text==='Last Price: $762.74'));
});

test('single-expiry view and its crosshair center the real observation',()=>{
  const h=harness({data:{'2026-10-16':770},spot:760});h.draw();assert.equal(h.lines[0].points[0][0],483);
  const state={pointerX:800};assert.equal(h.spec.tooltipRows(h.spec.items[0],0,state)[1],'Max Pain Strike Price: $770');assert.equal(state.hoverRatio,.5);assert.equal(h.spec.legend[1].value,'$760');
});

test('fractional zoom keeps category coordinates aligned and date labels use available measured width',()=>{
  const data=Object.fromEntries(Array.from({length:33},(_,i)=>[new Date(Date.UTC(2026,9,16+i)).toISOString().slice(0,10),760+i])),h=harness({data});h.draw();
  assert.ok(h.texts.filter(row=>row.text.includes(', 2026')).length>5);
  h.draw({start:0,end:2,rawStart:.5,rawEnd:1.5});assert.equal(h.lines.at(-1).points[1][0],483);
  const state={pointerX:483};assert.equal(h.spec.tooltipRows(h.spec.items[0],0,state)[0],'Oct 17, 2026');assert.equal(state.hoverRatio,.5);
});

test('empty and malformed responses never produce nonfinite canvas commands or a made-up zero strike',()=>{
  for(const payload of [{data:{}},{data:{'2026-10-16':null}},{data:{invalid:770}}]){const h=harness(payload);assert.equal(h.spec.items.length,0);h.draw();}
});
