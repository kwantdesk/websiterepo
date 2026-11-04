import test from 'node:test';
import assert from 'node:assert/strict';
import {renderAdditionalChart,skewVisibilityState,setSkewVisibility} from '../../public/gex-data-app/additional-tool-renderers.js';
import {niceValueDomain,drawExposureBars,exposureStrikeWindow} from '../../public/gex-data-app/exposure-models.js';
import {timeDomain,timeX} from '../../public/gex-data-app/time-axis.js';
import {niceTicks} from '../../public/gex-data-app/chart-primitives.js';

const T0=1792157400000,T1=T0+60000;
// Actual licensed SPY/2026-10-16 fragments; complete captures remain local in
// tmp/gex-parity-20261103. No request or provider credential is used by tests.
const flow={data:{[T0]:{callSum:578802800,putSum:552105200,stockPrice:772.91},[T1]:{callSum:369184500,putSum:379543400,stockPrice:772.59}}};
const drift={data:{[T0]:{arv:0,iv:15.020370483398438,stockPrice:772.91},[T1]:{arv:11.83269707111541,iv:14.68658447265625,stockPrice:772.59}}};
const skew={stockPrice:762.74,data:{'2026-10-19':{'550.0':{CALL:.0476837158203125,PUT:110.48316955566406},'555.0':{CALL:.0476837158203125,PUT:107.71751403808594}},'2026-10-16':{'300.0':{CALL:2188.6348724365234}}}};
const term={stockPrice:762.74,data:{
  '2026-10-16':{'763.0':{CALL:{delta:.3900630024978912,iv:12.445449829101562,moneyType:'AT_THE_MONEY'},PUT:{delta:-.5997689270148917,iv:12.063980102539062,moneyType:'AT_THE_MONEY'}}},
  '2026-10-19':{'763.0':{CALL:{delta:.5049641052847087,iv:11.014938354492188,moneyType:'AT_THE_MONEY'},PUT:{delta:-.4945817921502665,iv:11.491775512695312,moneyType:'AT_THE_MONEY'}}},
}};
const oi={data:{'50.0':{callOpenInterest:47,putOpenInterest:72478},'1480.0':{callOpenInterest:22618,putOpenInterest:0}}};

function harness(){
  const specs=[],summaries=[],lines=[],fills=[],bars=[],labels=[],axisLabels=[],stack=[];
  const state={fillStyle:'#000',strokeStyle:'#000',lineWidth:1,globalAlpha:1};
  const ctx=new Proxy({
    save(){stack.push({...state});},restore(){Object.assign(state,stack.pop());},
    measureText:text=>({width:String(text).length*7}),
    fill(){fills.push({alpha:state.globalAlpha,color:state.fillStyle});},
    fillRect(...args){assert.ok(args.every(Number.isFinite));fills.push({args,color:state.fillStyle,alpha:state.globalAlpha});},
    fillText(text,...args){assert.ok(args.every(Number.isFinite));labels.push(String(text));},
  },{get(target,key){if(key in target)return target[key];if(key in state)return state[key];return(...args)=>{assert.ok(args.filter(value=>typeof value==='number').every(Number.isFinite),`${key} received a nonfinite coordinate`);};},set(_,key,value){state[key]=value;return true;}});
  const env={quantCanvas:spec=>{specs.push(spec);return {};},setSummary:summary=>summaries.push(summary),
    CHART_COLORS:{call:'#00FF00',put:'#FF0000',price:'#C687FF',primary:'#700FEC',grid:'#222'},themePaint:color=>color,
    quantLine(_,points,color){assert.ok(points.every(point=>point.every(Number.isFinite)));lines.push({points,color});},
    niceValueDomain,niceTicks,timeDomain,timeX,exposureStrikeWindow,
    drawAxisLabels(_,options){assert.ok(Number.isFinite(options.min)&&Number.isFinite(options.max));axisLabels.push(options);},drawHorizontalTicks(){},drawTimeLabels(){},drawChartCrosshair(){},
    drawExposureBars(ctx,width,height,rows,options){bars.push({rows,options});return drawExposureBars(ctx,width,height,rows,options);},
    formatPrice:value=>Number.isFinite(value)?'$'+value.toFixed(2):'—',compact:(value,money)=>Number.isFinite(value)?(money?'$':'')+String(value):'—',chartStrikeLabel:value=>String(value),displayChartTime:value=>new Date(value).toISOString(),gexTimeZone:()=> 'Australia/Brisbane',
  };
  const draw=(spec=specs.at(-1),override={})=>{const state={start:spec.initialWindow?.start??0,end:spec.initialWindow?.end??Math.max(0,spec.items.length-1),yWindow:[0,1],...override};spec.draw(ctx,900,540,state);return state;};
  const render=(view,payload,controls={})=>renderAdditionalChart({tool:{view},payload,controls,ticker:'SPY',sessionDate:'2026-10-16'},env);
  return {env,render,draw,specs,summaries,lines,fills,bars,labels,axisLabels};
}

test('Net Flow uses actual per-bucket dollars, summed headers and30% filled series rather than cumulative drift',()=>{
  const h=harness(),original=structuredClone(flow);assert.equal(h.render('netFlow',flow),true);
  const spec=h.specs[0];assert.equal(spec.timeScale,true);assert.equal(spec.items[0].call,5788028);assert.equal(spec.items[1].call,3691845);
  assert.deepEqual(spec.legend.map(row=>row.value),['$9.5 M','$9.3 M','$772.59']);
  assert.notEqual(spec.legend[0].value,'$'+spec.items.at(-1).call,'header sums all observed buckets without accumulating the plotted series');
  assert.deepEqual(h.summaries[0].slice(0,2),[['Calls','$9479873'],['Puts','$9316486']]);
  h.draw();assert.equal(h.fills.filter(fill=>fill.alpha===.3).length,2);assert.equal(h.lines.length,3);assert.ok(h.axisLabels.some(axis=>axis.rightSide&&axis.label==='Underlying ($)'));
  assert.deepEqual(flow,original);
});

test('Net Flow volume does not divide contract counts by100 and absent prices remain absent',()=>{
  const h=harness();h.render('netFlow',{data:{[T0]:{callSum:7,putSum:12},[T1]:{callSum:null,putSum:2}}},{flowMetric:'NET_VOLUME'});
  const spec=h.specs[0];assert.equal(spec.items[0].call,7);assert.equal(spec.items[1].call,null);assert.equal(spec.legend.length,2);
  assert.deepEqual(spec.legend.map(row=>row.value),['7','14']);
  assert.ok(spec.tooltipRows(spec.items[1]).includes('Call Volume: — (—)'));assert.equal(h.summaries[0][2][1],'—');h.draw();assert.ok(!h.axisLabels.some(axis=>axis.rightSide));
});

test('Net Flow premium headers and tooltips use reference precision without changing raw values',()=>{
  const h=harness(),payload={data:{[T0]:{callSum:120000000000,putSum:162000000000,stockPrice:700}}};
  h.render('netFlow',payload);assert.deepEqual(h.specs[0].legend.map(row=>row.value),['$1.2 B','$1.6 B','$700.00']);
  assert.equal(h.specs[0].items[0].put,1620000000);assert.ok(h.specs[0].tooltipRows(h.specs[0].items[0]).includes('Put Premium: $1.6 B (100.00% of total)'));
});

test('Net Flow forwards the actual clicked minute to individual trade drilldown',()=>{
  const h=harness(),clicked=[];h.env.onMinuteDetail=row=>clicked.push(row);h.render('netFlow',flow);const spec=h.specs[0];spec.onClick(spec.items[1]);spec.onClick(null);assert.equal(clicked.length,1);assert.equal(clicked[0],spec.items[1]);assert.equal(clicked[0].time,T1);assert.equal(clicked[0].call,3691845);
});

test('actual licensed volume buckets retain source two-decimal header precision',()=>{
  const h=harness();h.render('netFlow',{data:{[T0]:{callSum:29956,putSum:40002,stockPrice:772.91},[T1]:{callSum:18523,putSum:29348,stockPrice:772.59}}},{flowMetric:'NET_VOLUME'});
  assert.deepEqual(h.specs[0].legend.map(row=>row.value),['48.48 K','69.35 K','$772.59']);
});

test('Volatility Drift percentage-point values, measured zero ARV and regular-session filtering survive rendering',()=>{
  const h=harness();h.render('volatilityDrift',{data:{[T0-60000]:{iv:99,arv:99,stockPrice:800},...drift.data}});
  const spec=h.specs[0];assert.equal(spec.items.length,2);assert.equal(spec.items[0].arv,0);assert.equal(spec.items[0].iv,15.020370483398438);
  assert.deepEqual(spec.legend.map(row=>row.label),['ARV','IV','SPY']);assert.deepEqual(spec.legend.map(row=>row.value),['11.83%','14.69%','$772.59']);
  assert.deepEqual(spec.legend.slice(0,2).map(row=>row.color),['#A33DFF','#FFFF00']);h.draw();assert.equal(h.lines.length,3);
});

test('missing IV warm-up splits the real curve rather than drawing an invented zero',()=>{
  const h=harness(),payload={data:{[T0]:{iv:10,arv:null,stockPrice:700},[T1]:{iv:null,arv:2},[T1+60000]:{iv:12,arv:3,stockPrice:701}}};
  h.render('volatilityDrift',payload);h.draw();assert.equal(h.specs[0].items[0].arv,null);assert.equal(h.specs[0].items[1].iv,null);
  const ivLines=h.lines.filter(line=>line.color==='#FFFF00');assert.equal(ivLines.length,2);assert.ok(ivLines.every(line=>line.points.length===1));
});

test('volatility auto axes and tooltips omit integer decimals while Drift headers retain source always precision',()=>{
  const payload={data:{[T0]:{arv:0,iv:15,stockPrice:700},[T1]:{arv:0,iv:15,stockPrice:701}}},h=harness();h.render('volatilityDrift',payload);h.draw();
  assert.deepEqual(h.specs[0].legend.slice(0,2).map(row=>row.value),['0.00%','15.00%']);
  const tooltip=h.specs[0].tooltipRows(h.specs[0].items[0]);assert.ok(tooltip.includes('ARV: 0%'));assert.ok(tooltip.includes('IV: 15%'));
  const format=h.axisLabels[0].formatter;assert.equal(format(30),'30%');assert.equal(format(5),'5%');assert.equal(format(5.5),'5.50%');assert.equal(format(1.999),'2%');assert.equal(h.specs[0].items[0].iv,15);
  const term=harness();term.render('termStructure',{stockPrice:700,data:{'2026-10-19':{'700':{CALL:{iv:20,delta:.5,moneyType:'AT_THE_MONEY'}}}}});term.draw();assert.equal(term.axisLabels[0].formatter(20),'20%');
});

test('Volatility Skew averages only available legs and renders an expiry curve without altering dollars',()=>{
  const h=harness(),original=structuredClone(skew);h.render('volatilitySkew',skew);
  const spec=h.specs[0];assert.equal(spec.items.find(row=>row.strike===300).values[0],2188.6348724365234);
  assert.equal(spec.items.find(row=>row.strike===550).values[1],110.48316955566406,'source excludes a solver-floor leg below one percentage point before averaging');
  assert.equal(spec.legend[1].value,'$762.74');assert.deepEqual(spec.legend.map(row=>row.label),['IV','SPY']);assert.equal(spec.legend[0].color,'#FFFF00');h.draw();assert.deepEqual(skew,original);
  const calls=harness();calls.render('volatilitySkew',skew,{contractTypeOptional:'CALL',expiry:'2026-10-19'});assert.equal(calls.specs[0].items[0].values[0],null);calls.draw();assert.equal(calls.lines.length,0);
});

test('Volatility Skew initially selects±10%of observed spot without deleting the wings',()=>{
  const h=harness(),data={'2026-10-19':Object.fromEntries([500,650,700,750,800,850,1000].map(strike=>[String(strike),{CALL:10,PUT:12}]))};
  h.render('volatilitySkew',{stockPrice:762.74,data});const spec=h.specs[0];assert.deepEqual(spec.initialWindow,{start:2,end:4});assert.equal(spec.items.length,7);h.draw();
});

test('Skew traces each expiry own valid strike pairs without artificial union-lattice gaps',()=>{
  const payload={stockPrice:715,data:{'2026-10-16':{'700':{CALL:10},'710':{CALL:.5},'730':{CALL:20}},'2026-10-19':{'710':{CALL:30},'720':{CALL:40}}}},h=harness();
  h.render('volatilitySkew',payload,{contractTypeOptional:'CALL'});const drawState=h.draw();
  assert.deepEqual(h.specs[0].items.map(row=>row.strike),[700,710,720,730]);
  assert.equal(h.lines.length,2,'one continuous line per expiry, not one fragment per union strike');
  assert.deepEqual(h.lines.map(line=>line.points.length),[2,2]);
  assert.ok(h.lines[0].points[0][0]<h.lines[1].points[0][0]);assert.ok(h.lines[0].points[1][0]>h.lines[1].points[1][0]);
  assert.equal(h.specs[0].items[1].values[0],null,'tooltip has no invented expiry quote at the other expiry strike');
  const tooltip=h.specs[0].tooltipRows(h.specs[0].items[1],1,{...drawState,pointerX:h.lines[1].points[0][0]});assert.equal(tooltip.length,2,'reference tooltip lists only finite series actually observed at this strike');
});

test('Skew vertical navigator changes a stable full-observation IV viewport without altering quotes',()=>{
  const h=harness(),payload={stockPrice:715,data:{'2026-10-16':{'700':{CALL:10},'710':{CALL:20},'730':{CALL:80}},'2026-10-19':{'710':{CALL:30},'720':{CALL:40}}}};
  h.render('volatilitySkew',payload,{contractTypeOptional:'CALL'});const spec=h.specs[0],original=structuredClone(spec.items);
  assert.equal(spec.twoDimensional,true);assert.equal(spec.verticalValues.length,48);assert.equal(spec.verticalValues.reduce((sum,entry)=>sum+entry.value,0),5);
  assert.ok(spec.verticalValues.every(entry=>entry.position>=0&&entry.position<=1));
  h.draw();const full=h.axisLabels.at(-1);h.draw(spec,{yWindow:[.25,.75]});const zoom=h.axisLabels.at(-1);
  assert.equal(zoom.max-zoom.min,(full.max-full.min)/2);assert.equal((zoom.min+zoom.max)/2,(full.min+full.max)/2);
  h.draw(spec,{start:1,end:2});const horizontal=h.axisLabels.at(-1);assert.equal(horizontal.min,full.min);assert.equal(horizontal.max,full.max,'horizontal crop does not silently recalculate the IV navigator scale');
  assert.deepEqual(spec.items,original);assert.equal(spec.items.at(-1).values[0],80,'extreme actual IV is preserved, not clamped to a saved manual viewport');
});

test('Skew defaults to five chronological expiry curves and source HSL colors without dropping explicit expiries',()=>{
  const dates=Array.from({length:7},(_,index)=>`2026-10-${String(16+index).padStart(2,'0')}`),data=Object.fromEntries(dates.map((date,index)=>[date,{'750.0':{CALL:10+index,PUT:12+index},'760.0':{CALL:11+index,PUT:13+index}}]));
  const h=harness();h.render('volatilitySkew',{stockPrice:755,data});h.draw();assert.equal(h.specs[0].items[0].values.length,5);assert.equal(h.lines.length,5);
  assert.equal(h.lines[0].color,'hsl(0 100% 50%)');assert.equal(h.lines[1].color,'hsl(50.4 100% 52%)');
  const all=harness();all.render('volatilitySkew',{stockPrice:755,data},{expiry:dates.join(',')});all.draw();assert.equal(all.lines.length,7);
  const calls=harness();calls.render('volatilitySkew',{stockPrice:755,data},{contractTypeOptional:'CALL'});calls.draw();assert.equal(calls.lines[0].color,'hsl(108 100% 70%)');
  const puts=harness();puts.render('volatilitySkew',{stockPrice:755,data},{contractTypeOptional:'PUT'});puts.draw();assert.equal(puts.lines[0].color,'hsl(0 100% 70%)');
});

test('Skew visibility controls persist independent expiry and combined/leg selections, with explicit all-off and reset',()=>{
  const dates=Array.from({length:7},(_,index)=>`2026-10-${String(16+index).padStart(2,'0')}`),payload={stockPrice:755,data:Object.fromEntries(dates.map((date,index)=>[date,{'750.0':{CALL:10+index,PUT:20+index},'760.0':{CALL:11+index,PUT:21+index}}]))};
  assert.deepEqual(skewVisibilityState(payload).visibleExpiry,dates.slice(0,5));assert.deepEqual(skewVisibilityState(payload).visibleContractType,['BOTH']);
  const original={otherSetting:'preserved'},calls=setSkewVisibility(payload,original,{kind:'contractType',value:'CALL',checked:true});
  assert.deepEqual(original,{otherSetting:'preserved'});assert.deepEqual(calls.visibleContractType,['BOTH','CALL']);
  const legs=setSkewVisibility(payload,setSkewVisibility(payload,calls,{kind:'contractType',value:'BOTH',checked:false}),{kind:'contractType',value:'PUT',checked:true});
  const selected=setSkewVisibility(payload,setSkewVisibility(payload,legs,{kind:'expiry',value:'ALL',checked:false}),{kind:'expiry',value:dates[6],checked:true}),restored=JSON.parse(JSON.stringify(selected));
  assert.deepEqual(restored.visibleExpiry,[dates[6]]);assert.deepEqual(restored.visibleContractType,['CALL','PUT']);assert.equal(restored.otherSetting,'preserved');
  const h=harness();h.render('volatilitySkew',payload,restored);const drawState=h.draw();assert.equal(h.lines.length,2);assert.deepEqual(h.specs[0].items[0].values,[16,26]);
  assert.deepEqual(h.lines.map(line=>line.color),['hsl(108 100% 70%)','hsl(0 100% 70%)']);
  assert.ok(h.specs[0].tooltipRows(h.specs[0].items[0],0,{...drawState,pointerX:78}).some(text=>text.includes('CALL IV: 16%')));
  const off=setSkewVisibility(payload,restored,{kind:'contractType',value:'ALL',checked:false}),empty=harness();empty.render('volatilitySkew',payload,off);empty.draw();assert.equal(empty.specs[0].items.length,0);assert.equal(empty.lines.length,0);
  const reset=setSkewVisibility(payload,{...off,expiry:dates[6],contractTypeOptional:'PUT'},{reset:true});assert.deepEqual(reset,{otherSetting:'preserved'});assert.deepEqual(skewVisibilityState(payload,reset).visibleContractType,['BOTH']);
});

test('Skew stale visibility values cannot create nonexistent expiries or unsupported contract types',()=>{
  const state=skewVisibilityState(skew,{visibleExpiry:['2026-10-19','2026-10-19','2026-02-30','2027-01-01'],visibleContractType:['PUT','PUT','NOT_A_LEG']});
  assert.deepEqual(state.visibleExpiry,['2026-10-19']);assert.deepEqual(state.visibleContractType,['PUT']);
  assert.deepEqual(setSkewVisibility(skew,{custom:7},{kind:'contractType',value:'NOT_A_LEG'}),{custom:7});
});

test('Term Structure multi-expiry and strike selections filter exact noncontiguous contracts',()=>{
  const input={stockPrice:710,data:{'2026-10-19':{'700':{CALL:{iv:10,delta:.5,moneyType:'ATM'}},'710':{CALL:{iv:999,delta:.5,moneyType:'ATM'}},'730':{PUT:{iv:30,delta:-.5,moneyType:'ATM'}}},'2026-10-21':{'700':{CALL:{iv:888,delta:.5,moneyType:'ATM'}}},'2026-10-23':{'700':{CALL:{iv:20,delta:.5,moneyType:'ATM'}},'730':{PUT:{iv:40,delta:-.5,moneyType:'ATM'}}}}},before=structuredClone(input),h=harness();
  h.render('termStructure',input,{termExpirations:['2026-10-19','2026-10-23'],termStrikes:[700,730],expiry:'2026-10-21',minStrike:'710',maxStrike:'710'});h.draw();
  assert.deepEqual(h.specs[0].items.map(row=>row.expiration),['2026-10-19','2026-10-23']);
  assert.deepEqual(h.specs[0].items.map(row=>row.iv),[20,30]);assert.deepEqual(h.specs[0].items.map(row=>row.count),[2,2]);assert.deepEqual(input,before);
  const missing=harness();missing.render('termStructure',input,{termStrikes:[999]});missing.draw();assert.equal(missing.specs[0].items.length,0);
  const reset=harness();reset.render('termStructure',input,{termExpirations:[],termStrikes:[],expiry:'2026-10-21'});assert.equal(reset.specs[0].items.length,3);
});

test('Term Structure defaults to ATM contract mean, retains actual DTE spacing and permits delta filters',()=>{
  const h=harness(),original=structuredClone(term);h.render('termStructure',term);const spec=h.specs[0];
  assert.equal(spec.timeScale,true);assert.deepEqual(spec.items.map(row=>row.daysUntilExpiration),[0,3]);
  assert.deepEqual(spec.legend.map(row=>row.label),['IV','SPY']);assert.equal(spec.legend[1].value,'$762.74');assert.equal(spec.legend[0].color,'#FFFF00');
  assert.equal(spec.items[0].iv,(12.445449829101562+12.063980102539062)/2);assert.equal(spec.items[1].count,2);h.draw();assert.ok(!h.labels.includes('Days Until Expiration'));assert.equal(h.axisLabels[0].label,'Implied Volatility');assert.deepEqual(spec.tooltipRows(spec.items[1]),['3 Days Until Expiration','Implied Volatility: 11.25%']);assert.deepEqual(term,original);
  assert.ok(h.lines.every(line=>line.color==='#FFFF00'));
  const filtered=harness();filtered.render('termStructure',term,{deltaMin:'0',deltaMax:'.4'});assert.equal(filtered.specs[0].items[0].count,1);assert.equal(filtered.specs[0].items[1].iv,null);filtered.draw();
});

test('Open Interest strike bars preserve positive call/put contracts in both orientations',()=>{
  for(const orientation of ['HORIZONTAL','VERTICAL']){
    const h=harness(),original=structuredClone(oi);h.render('oiStrike',oi,{exposureOrientation:orientation,exposureDisplay:'SPLIT'});h.draw();
    const {rows,options}=h.bars[0];assert.equal(rows[0].call,47);assert.equal(rows[0].put,72478);assert.equal(rows[1].put,0);
    assert.equal(options.grouped,true);assert.equal(options.fromZero,true);assert.equal(options.display,'SPLIT');assert.equal(options.orientation,orientation);
    assert.equal(h.specs[0].zoomAxis,orientation==='VERTICAL'?'y':'x');assert.ok(h.fills.filter(fill=>fill.args).every(fill=>fill.args[2]>=0&&fill.args[3]>=0));assert.deepEqual(oi,original);
  }
});

test('Open Interest expiration, CALL/PUT selections and legacy NET never negate puts',()=>{
  const payload={data:{'2026-10-19':{callOpenInterest:100,putOpenInterest:200},'2026-10-20':{callOpenInterest:150,putOpenInterest:300}}};
  for(const choice of ['NET','CALL','PUT']){const h=harness();h.render('oiExpiration',payload,{exposureDisplay:choice});h.draw();assert.equal(h.bars[0].options.byExpiration,true);assert.equal(h.bars[0].options.display,choice==='NET'?'SPLIT':choice);assert.equal(h.bars[0].rows[0].put,200);assert.deepEqual(h.specs[0].legend.map(row=>row.label),choice==='NET'?['Calls','Puts']:[choice==='CALL'?'Calls':'Puts']);}
});

test('all three Open Interest source headers have plain Calls/Puts legends and reference title case',()=>{
  for(const [view,title,payload]of [['oiStrike','Open Interest By Strike - SPY',oi],['oiExpiration','Open Interest By Expiration - SPY',{data:{'2026-10-19':{callOpenInterest:10,putOpenInterest:20}}}],['oiTime','Open Interest / Time - SPY',{data:{'2026-10-19':{callOpenInterest:10,putOpenInterest:20}}}]]){
    const h=harness();h.render(view,payload);assert.equal(h.specs[0].title,title);assert.deepEqual(h.specs[0].legend.map(row=>row.label),['Calls','Puts']);assert.ok(h.specs[0].legend.every(row=>!Object.hasOwn(row,'value')));h.draw();
  }
});

test('Open Interest spot crop is a window of category indices, not numeric strike bounds',()=>{
  const h=harness(),strikes=Array.from({length:71},(_,index)=>600+index*5),data=Object.fromEntries(strikes.map(strike=>[String(strike),{callOpenInterest:100,putOpenInterest:200}]));
  h.render('oiStrike',{stockPrice:762.74,data});
  const spec=h.specs[0],[start,end]=exposureStrikeWindow(strikes,762.74);
  assert.deepEqual(spec.initialWindow,{start,end});assert.ok(start>0&&end<strikes.length-1);
  assert.ok(Number.isInteger(start)&&Number.isInteger(end));assert.ok(spec.items[start].strike<762.74&&spec.items[end].strike>762.74);h.draw();
});

test('Open Interest over time line/bar share identical measured rows and exclude malformed dates',()=>{
  const payload={data:{'2026-10-19':{callOpenInterest:100,putOpenInterest:200},'2026-10-20':{callOpenInterest:150,putOpenInterest:0},'2026-02-30':{callOpenInterest:999,putOpenInterest:999}}};
  const line=harness(),bar=harness();line.render('oiTime',payload,{oiChart:'line'});bar.render('oiTime',payload,{oiChart:'bar'});line.draw();bar.draw();
  assert.deepEqual(line.specs[0].items,bar.specs[0].items);assert.equal(line.specs[0].items.length,2);assert.equal(line.lines.length,2);assert.equal(bar.lines.length,0);assert.equal(bar.fills.filter(fill=>fill.args).length,3);assert.equal(line.specs[0].items[1].put,0);
  assert.deepEqual(line.summaries[0].slice(0,2),[['Call open interest','150'],['Put open interest','0']],'daily OI summary shows the last snapshot, never a sum of successive stocks');
});

test('OI history uses equal session spacing across weekends and a visible-range line scale',()=>{
  const payload={data:{'2025-01-02':{callOpenInterest:4500000,putOpenInterest:12000000},'2025-01-03':{callOpenInterest:4700000,putOpenInterest:13000000},'2025-01-06':{callOpenInterest:4600000,putOpenInterest:14000000}}},line=harness(),bar=harness();
  line.render('oiTime',payload,{oiChart:'line'});line.draw();bar.render('oiTime',payload,{oiChart:'bar'});bar.draw();
  const spec=line.specs[0],points=line.lines[0].points;assert.equal(spec.timeScale,false);assert.equal(points[1][0]-points[0][0],points[2][0]-points[1][0]);assert.ok(line.axisLabels[0].min>0);assert.equal(bar.axisLabels[0].min,0);
  const lineHover={pointerX:78+(870-78)/4};assert.equal(spec.tooltipRows(spec.items[2],2,lineHover)[0],'Jan 2, 2025');assert.equal(lineHover.hover,0,'an exact midpoint selects the earlier session');
  const barHover={pointerX:78+(870-78)/3};assert.equal(bar.specs[0].tooltipRows(bar.specs[0].items[2],2,barHover)[0],'Jan 2, 2025');assert.equal(barHover.hover,0,'grouped bars use ordinal half-slot centers');
});

test('OI / Time leg selection gates legend, tooltip, curves, bars and scale without rewriting source rows or navigator',()=>{
  const payload={data:{'2026-10-19':{callOpenInterest:80000,putOpenInterest:8},'2026-10-20':{callOpenInterest:90000,putOpenInterest:9}}},original=structuredClone(payload),all=harness();all.render('oiTime',payload);
  for(const oiChart of ['line','bar'])for(const oiLegs of ['CALL','PUT']){
    const h=harness(),key=oiLegs==='CALL'?'call':'put',label=oiLegs==='CALL'?'Calls':'Puts';h.render('oiTime',payload,{oiChart,oiLegs});h.draw();
    const spec=h.specs[0];assert.deepEqual(spec.legend.map(row=>row.label),[label]);assert.deepEqual(spec.items,all.specs[0].items);assert.deepEqual(spec.navigatorValues,all.specs[0].navigatorValues);
    assert.equal(spec.tooltipRows(spec.items[0]).length,2);assert.ok(spec.tooltipRows(spec.items[0])[1].startsWith(oiLegs==='CALL'?'Call Open Interest':'Put Open Interest'));
    if(oiChart==='line'){assert.equal(h.lines.length,1);assert.equal(h.lines[0].color,h.env.CHART_COLORS[key]);}else{const bars=h.fills.filter(fill=>fill.args);assert.equal(bars.length,2);assert.ok(bars.every(fill=>fill.color===h.env.CHART_COLORS[key]));}
    if(oiLegs==='PUT')assert.ok(h.axisLabels[0].max<100,'hidden large call inventory must not flatten the remaining put curve');
  }
  assert.deepEqual(payload,original);
  const strike=harness();strike.render('oiStrike',oi,{exposureDisplay:'PUT'});assert.deepEqual(strike.specs[0].legend.map(row=>row.label),['Puts']);assert.equal(strike.specs[0].items[0].call,47);
});

test('every additional view handles empty actual payloads without nonfinite canvas commands',()=>{
  for(const view of ['netFlow','volatilityDrift','volatilitySkew','termStructure','oiStrike','oiExpiration','oiTime']){const h=harness();assert.equal(h.render(view,{data:{}}),true,view);assert.equal(h.specs[0].items.length,0,view);h.draw();}
  const h=harness();assert.equal(h.render('unrelated',{data:{}}),false);assert.equal(h.specs.length,0);
});

test('malformed open-interest legs are missing observations rather than implicit zero contracts',()=>{
  const h=harness();h.render('oiTime',{data:{'2026-10-19':{callOpenInterest:[],putOpenInterest:false},'2026-10-20':{callOpenInterest:' ',putOpenInterest:'12'}}});
  assert.equal(h.specs[0].items[0].call,null);assert.equal(h.specs[0].items[0].put,null);assert.equal(h.specs[0].items[1].call,null);assert.equal(h.specs[0].items[1].put,12);h.draw();
});
