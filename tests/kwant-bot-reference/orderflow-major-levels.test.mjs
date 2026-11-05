import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {ORDERFLOW_MAJOR_LEVELS,orderflowMajorLevels,orderflowMajorSetting} from '../../public/kwanty-app/orderflow-major-levels.js';
import {editorRows,readEditorSetting,writeEditorSetting} from '../../public/kwanty-app/settings-editor.js';
import {makeOrderflowSeries} from '../../public/kwanty-app/orderflow-chart.js';

test('effective source clean defaults enable latest major levels and independently disable next',()=>{
 assert.deepEqual(orderflowMajorLevels('net-gex').map(value=>value.field),['zero_mcall','zero_mput']);assert.deepEqual(orderflowMajorLevels('net-convexity').map(value=>value.field),['z_mlgamma','z_msgamma']);
 assert.deepEqual(orderflowMajorLevels('aggregate-dex'),[]);assert.equal(ORDERFLOW_MAJOR_LEVELS.length,8);assert.equal(orderflowMajorSetting({},'one_mcall').display,false);
});
test('selected metric expiry never hides independently enabled latest or next major overlays',()=>{
 const settings={zero_mcall:{display:false},one_mcall:{display:true,color:'#123456'},one_mput:{display:true}};
 const levels=orderflowMajorLevels('gex-orderflow',settings);assert.deepEqual(levels.map(value=>value.field),['zero_mput','one_mcall','one_mput']);assert.equal(levels[1].color,'#123456');
 const record={timestamp:1793728800,ticker:'SPX',spot:7580,zgr:5,ogr:7,zero_mput:7570,one_mcall:7600,one_mput:7560};
 for(const expiry of ['zero','one','both']){const model=makeOrderflowSeries({records:[record],metric:'net-gex',expiry,settings:{majorLevels:levels}});assert.deepEqual(model.levels.map(value=>value.values[0].value),[7570,7600,7560]);}
});
test('convexity uses real z/o raw fields while settings retain source zero/one names',()=>{
 const levels=orderflowMajorLevels('convexity-orderflow',{zero_mlgamma:{display:false},one_mlgamma:{display:true},one_msgamma:{display:true}});assert.deepEqual(levels.map(value=>value.field),['z_msgamma','o_mlgamma','o_msgamma']);
 assert.equal(orderflowMajorLevels('net-gex',{one_mlgamma:{display:true}}).some(value=>value.field==='o_mlgamma'),false);
});
test('editor exposes all eight independent settings and a toggle affects only its actual major field',()=>{
 const rows=editorRows({package:'orderflow',panels:[{metric:'net-gex'}]});for(const definition of ORDERFLOW_MAJOR_LEVELS)assert.ok(rows.some(row=>row[0]===definition.key));assert.ok(!rows.some(row=>row[0]==='major_call_gamma'));
 const settings={};assert.equal(readEditorSetting(settings,'one_mcall').display,false);writeEditorSetting(settings,'one_mcall',{display:true,color:'#abcdef'},true);assert.equal(orderflowMajorLevels('net-gex',settings).find(value=>value.field==='one_mcall').color,'#abcdef');assert.equal(readEditorSetting(settings,'one_mput').display,false);
});
test('legacy hidden/custom style preferences survive without enabling new next fields',()=>{
 const settings={major_call_gamma:{display:false,color:'#ff0000',isCustomized:true},major_put_gamma:{color:'#112233',size:3,isCustomized:true}},before=structuredClone(settings);
 assert.equal(orderflowMajorSetting(settings,'zero_mcall').display,false);assert.equal(orderflowMajorSetting(settings,'one_mcall').display,false);const levels=orderflowMajorLevels('net-gex',settings);assert.equal(levels.length,1);assert.equal(levels[0].color,'#112233');assert.equal(levels[0].size,3);assert.deepEqual(settings,before);
});

test('actual app painting wires independent major fields without an expiry gate and keeps Metric heading free of internal IDs',()=>{
 const app=readFileSync(new URL('../../public/kwanty-app/app.js',import.meta.url),'utf8'),assignment=/s\.candleBucketMs=interval;s\.majorLevels=orderflowMajorLevels\(panel\.metric,s\);/.exec(app)?.[0];assert.ok(assignment);
 for(const expiry of ['zero','one','both']){const env={s:{one_mcall:{display:true}},panel:{metric:'net-gex',expiry},interval:180000,orderflowMajorLevels};vm.runInNewContext(assignment,env);assert.equal(env.s.candleBucketMs,180000);assert.deepEqual(env.s.majorLevels.map(level=>level.field),['zero_mcall','zero_mput','one_mcall']);}
 assert.match(app,/select\.setAttribute\('aria-label','Metric'\)/);assert.doesNotMatch(app,/aria-label','Metric '\+panel\.id/);assert.match(app,/label\.htmlFor=select\.id/);
});

test('actual OrderFlow control loop omits combine only for source vanna and charm families',()=>{
 const app=readFileSync(new URL('../../public/kwanty-app/app.js',import.meta.url),'utf8'),start=app.indexOf("for(const [key,name]of [['showSpot','spot'],['combine','combine']])"),end=app.indexOf('box.append(checks)',start);assert.ok(start>=0&&end>start);const loop=app.slice(start,end);
 for(const metric of ['net-vanna','net-charm','net-gex']){const labels=[],env={panel:{metric},ORDERFLOW_METRICS:{[metric]:{noCombine:['net-vanna','net-charm'].includes(metric)}},el:tag=>({append(...items){if(tag==='label')labels.push(items.at(-1));},addEventListener(){}}),document:{createTextNode:value=>value},checks:{append(){}},drawAll(){},persist(){}};vm.runInNewContext(loop,env);assert.deepEqual(labels,metric==='net-gex'?['spot','combine']:['spot']);}
});

test('actual inline source flow filter uses existing per-ticker settings on blur/Enter and resets on doubleclick',()=>{
 const source=readFileSync(new URL('../../public/kwanty-app/app.js',import.meta.url),'utf8'),code=source.slice(source.indexOf('function orderflowThresholdKey('),source.indexOf('function renderOrderControls('));const state={settings:{orderflow:{flowThresholds:{SPX:{'dex orderflow':12}}}}};let draws=0,writes=0;
 const element=tag=>({tag,children:[],events:{},append(...children){this.children.push(...children);},setAttribute(key,value){this[key]=value;},addEventListener(key,callback){this.events[key]=callback;},blur(){this.events.blur?.();}}),env={state,el:element,panelTicker:panel=>panel.ticker||'SPX',document:{createTextNode:value=>value},drawAll(){draws++;},persist(){writes++;}};vm.runInNewContext(code+';this.key=orderflowThresholdKey;this.mount=mountOrderflowThreshold;',env);
 for(const metric of ['net-vanna','net-charm','net-gex','net-convexity','aggregate-dex','dex-orderflow','gex-orderflow','convexity-orderflow'])for(const combine of [false,true]){const box=element('section');env.mount({metric,combine,ticker:'SPX'},box);assert.equal(box.children.length,metric.endsWith('-orderflow')||combine&&!['net-vanna','net-charm'].includes(metric)?1:0);}
 const box=element('section');env.mount({metric:'dex-orderflow',ticker:'SPX'},box);const input=box.children[0].children[0];assert.equal(input.value,'12');assert.equal(input.min,'0');assert.equal(input.step,'1');input.value='25';assert.equal(state.settings.orderflow.flowThresholds.SPX['dex orderflow'],12);input.events.blur();assert.equal(state.settings.orderflow.flowThresholds.SPX['dex orderflow'],25);input.value='30';input.events.keydown({key:'Enter'});assert.equal(state.settings.orderflow.flowThresholds.SPX['dex orderflow'],30);input.events.dblclick();assert.equal(state.settings.orderflow.flowThresholds.SPX['dex orderflow'],0);assert.equal(draws,3);assert.equal(writes,3);input.value='-4';input.events.blur();assert.equal(input.value,'0');assert.equal(writes,3);assert.equal(state.settings.orderflow.flowThresholds.QQQ,undefined);
});
