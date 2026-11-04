import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutMarketSharePieLabels,drawMarketSharePie,EXCHANGE_GROUP_COLORS,exchangeColor} from '../../public/gex-data-app/options-models.js';
import {installTheme} from '../../public/gex-data-app/site-theme.js?v=1';
const descriptors=angles=>angles.map((midAngle,index)=>({midAngle,halfHeight:14,textWidth:index%2?42:56,lines:[`EX${index}`,'12.34%']}));
test('source angular label relaxation retains fixed .31 radius, real slice angles and finite deterministic leaders',()=>{
 const labels=descriptors([1.48,1.5,1.52,1.54,1.56,1.58,1.60,1.62,1.64]),before=structuredClone(labels);
 for(const width of [320,640,1280]){const result=layoutMarketSharePieLabels(labels,width,320,99.2);assert.equal(result.radius,99.2);assert.deepEqual(result,layoutMarketSharePieLabels(labels,width,320,99.2));assert.deepEqual(labels,before);assert.ok(result.labels.some(label=>label.angle!==label.midAngle));for(const label of result.labels){assert.ok([label.angle,label.y,label.textX,label.elbowX].every(Number.isFinite));assert.ok(Math.abs(label.elbowX-(width/2+Math.cos(label.angle)*109.2))<1e-8);assert.equal(label.textX,label.elbowX+16*label.direction);}}
});
test('actual source pie radius does not shrink for long labels and leaders use radial plus twelve-pixel elbows',()=>{
 const calls=[],ctx=new Proxy({measureText:text=>({width:text.length*7})},{get(target,key){if(key in target)return target[key];return(...args)=>calls.push({method:key,args,color:target.fillStyle});},set(target,key,value){target[key]=value;return true;}}),entries=[{name:'Very long actual exchange label',value:20,color:'#123456'},{name:'GEMX',value:30,color:'#654321'},{name:'NOM',value:50,color:'#abcdef'}],before=structuredClone(entries),result=drawMarketSharePie(ctx,640,640,entries,{formatPercent:value=>value*100+'%'});
 assert.equal(result.radius,198.4);assert.deepEqual(result.cumulativeAngles,[.2,.5,1]);assert.deepEqual(entries,before);const arcs=calls.filter(call=>call.method==='arc');assert.equal(arcs.length,3);assert.equal(arcs[0].args[3],-Math.PI/2);for(const label of result.labels){const radial=[label.elbowX,label.y],horizontal=[label.elbowX+12*label.direction,label.y];assert.ok(calls.some(call=>call.method==='lineTo'&&call.args.every((value,index)=>Math.abs(value-radial[index])<1e-8)));assert.ok(calls.some(call=>call.method==='lineTo'&&call.args.every((value,index)=>Math.abs(value-horizontal[index])<1e-8)));}assert.deepEqual(calls.filter(call=>call.method==='fillText'&&call.args[0].endsWith('%')).map(call=>call.args[0]).sort(),['20%','30%','50%']);
});
test('bounded angular solver handles crowded labels without changing slice or input order',()=>{
 const started=performance.now();for(let pass=0;pass<200;pass++){const labels=descriptors(Array.from({length:19},(_,index)=>((index*37+pass*13)%360)*Math.PI/180-Math.PI/2)),before=structuredClone(labels),layout=layoutMarketSharePieLabels(labels,320,320,99.2);assert.equal(layout.labels.length,19);assert.equal(layout.radius,99.2);assert.deepEqual(labels,before);assert.ok(layout.labels.every(label=>[label.angle,label.y,label.textX].every(Number.isFinite)));}assert.ok(performance.now()-started<3000);
});
test('verified venue identity defaults stay muted and distinct while explicit page palette overrides still apply',async()=>{
 const oldDocument=globalThis.document,oldFetch=globalThis.fetch;globalThis.document={documentElement:{style:{setProperty(){},removeProperty(){}},setAttribute(){}}};globalThis.fetch=async()=>({ok:true,json:async()=>[]});try{
 await installTheme({background:'#000000',primary:'#ff00ff',accent:'#00ffff',bullish:'#00ff00',bearish:'#ff0000',warning:'#ffff00'});assert.deepEqual(Object.fromEntries(Object.entries(EXCHANGE_GROUP_COLORS)),{BOX:'#9d2c2c',CBOE:'#139853',MEMX:'#b4ac18',MIAX:'#b46b18',NASDAQ:'#125ea4',NYSE:'#711ac9',UNKNOWN:'gray'});assert.equal(exchangeColor('C2'),'#139853EE');assert.equal(exchangeColor('NQEX'),'#125ea4BB');
 await installTheme({chartPrimary:'#aa00ff',accent:'#00aaff',bullish:'#00ffaa',bearish:'#ff00aa',warning:'#aaff00'});assert.equal(EXCHANGE_GROUP_COLORS.NASDAQ,'#00aaff');assert.equal(EXCHANGE_GROUP_COLORS.BOX,'#ff00aa');await installTheme({});assert.equal(EXCHANGE_GROUP_COLORS.NASDAQ,'#125ea4');
 }finally{globalThis.document=oldDocument;globalThis.fetch=oldFetch;}
});
