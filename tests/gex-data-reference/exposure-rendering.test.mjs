import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {drawExposureBars,exposureStrikeWindow} from '../../public/gex-data-app/exposure-models.js';
import {abbreviate,abbreviatedTick,currencyAuto} from '../../public/gex-data-app/number-format.js';

const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');
function actual(name){
  const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name);
  const rest=source.slice(start),next=/\r?\n {0,2}function /.exec(rest);
  return next?rest.slice(0,next.index):rest;
}
function harness(payload,{byExpiration=false,orientation='HORIZONTAL'}={}){
  let spec,bounds;const controls={ticker:'SPY',greek:'GAMMA',representation:'PER_ONE_PERCENT_MOVE',exposureDisplay:'NET',exposureOrientation:orientation};
  const ctx=new Proxy({measureText:text=>({width:String(text).length*7})},{get:(object,key)=>key in object?object[key]:(()=>{})});
  const env={getControl:key=>controls[key],number:value=>Number(value)||0,exposureStrikeWindow,abbreviatedTick,currencyAuto,
    q:()=>({selectedOptions:[{text:'Per 1% Move'}]}),compact:value=>abbreviate(value,2),formatPrice:value=>'$'+Number(value).toFixed(2),chartStrikeLabel:currencyAuto,
    CHART_COLORS:{call:'call',put:'put',primary:'primary'},toolConfiguration:{hideCrosshairs:false,hideAxisTitles:false},
    quantCanvas:value=>{spec=value;},setSummary(){},drawExposureBars(...args){bounds=drawExposureBars(...args);return bounds;},
  };
  vm.runInNewContext(['unwrapArchive','aggregateExposure','aggregateExposureTool','renderExposureProfileQuant'].map(actual).join('\n')+'\nthis.render=renderExposureProfileQuant;',env);
  env.render(payload,byExpiration);
  const state={start:0,end:spec.items.length-1,pointerX:0,pointerY:0,hover:null};
  spec.draw(ctx,900,540,state);
  return {spec,bounds,state};
}
const irregular={data:{SPY:{stockPrice:105,exposureMap:{'2026-10-16':{'100':{callExposure:10,putExposure:-5},'101':{callExposure:20,putExposure:-8},'110':{callExposure:30,putExposure:-9}}}}}};

test('actual exposure strike tooltip follows numeric geometry when an ordinal hover initially selects the wrong strike',()=>{
  const payload=structuredClone(irregular),before=structuredClone(payload),{spec,bounds,state}=harness(payload);
  state.pointerX=bounds.categoryPixel(spec.items[1],1);state.pointerY=200;
  const initialIndex=Math.round((state.pointerX-78)/(900-78-78)*(spec.items.length-1));
  assert.equal(initialIndex,0,'fixture must reproduce the generic ordinal mis-pick');state.hover=initialIndex;
  const rows=spec.tooltipRows(spec.items[initialIndex],initialIndex,state);
  assert.equal(state.hover,1);assert.ok(rows[0].includes('$101'));assert.deepEqual(payload,before);
});

test('actual expiration tooltip uses centered category bins instead of generic endpoint spacing',()=>{
  const dates=['2026-10-16','2026-10-19','2026-10-23','2026-11-20','2026-12-18'],payload={data:{SPY:{stockPrice:760,exposureMap:Object.fromEntries(dates.map((date,index)=>[date,{'760':{callExposure:100+index,putExposure:-10}}]))}}},before=structuredClone(payload),{spec,bounds,state}=harness(payload,{byExpiration:true});
  const first=bounds.categoryPixel(spec.items[0],0),second=bounds.categoryPixel(spec.items[1],1);
  state.pointerX=first+.4*(second-first);state.pointerY=200;
  const initialIndex=Math.round((state.pointerX-78)/(900-78-78)*(spec.items.length-1));
  assert.equal(initialIndex,1,'pointer is closer to actual first bin but ordinal endpoints choose second');state.hover=initialIndex;
  const rows=spec.tooltipRows(spec.items[initialIndex],initialIndex,state);
  assert.equal(state.hover,0);assert.ok(rows[0].includes('Oct 16, 2026'));assert.deepEqual(payload,before);
});

test('actual vertical exposure tooltip retains nearest category geometry',()=>{
  const {spec,bounds,state}=harness(irregular,{orientation:'VERTICAL'});
  state.pointerY=bounds.categoryPixel(spec.items[1],1);state.pointerX=300;state.hover=0;
  const rows=spec.tooltipRows(spec.items[0],0,state);
  assert.equal(state.hover,1);assert.ok(rows[0].includes('$101'));
});

test('actual exposure headers and tooltips use the source auto headline versus explicit two-decimal leg precision',()=>{
  const payload={data:{SPY:{stockPrice:760,exposureMap:{'2026-10-16':{'760':{callExposure:1_500_000_000,putExposure:-300_000_000}}}}}},before=structuredClone(payload);
  for(const byExpiration of [false,true]){
    const {spec,bounds,state}=harness(payload,{byExpiration});
    state.pointerX=bounds.categoryPixel(spec.items[0],0);state.pointerY=200;state.hover=0;
    const rows=spec.tooltipRows(spec.items[0],0,state);
    assert.ok(rows[0].includes('SPY'));assert.ok(rows[0].includes(byExpiration?'Oct 16, 2026':'$760'));
    assert.ok(rows.includes('Call GEX: 1.50 B'));assert.ok(rows.includes('Put GEX: -300 M'));assert.ok(rows.includes('Net GEX: 1.20 B'));
    assert.equal(spec.legend[0].value,'1.2 B');
    if(!byExpiration)assert.equal(spec.legend.find(item=>item.label==='SPY').value,'$760');
  }
  assert.deepEqual(payload,before);
});
