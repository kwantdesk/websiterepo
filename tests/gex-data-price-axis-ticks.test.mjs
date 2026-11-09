import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {niceValueDomain} from '../public/gex-data-app/exposure-models.js';

const app=readFileSync(new URL('../public/gex-data-app/app.js',import.meta.url),'utf8');
test('price grids and labels use the same domain ticks without a second rounding pass',()=>{
 const positions=[],labels=[];
 const ctx={save(){},restore(){},beginPath(){},moveTo(x,y){positions.push(y);},lineTo(){},stroke(){},fillText(text,x,y){labels.push({text,y});}};
 const context={themePaint:x=>x,CHART_COLORS:{grid:'#333'},toolConfiguration:{hideAxisTitles:true},niceTicks(){throw new Error('second rounding pass');},compact:String};
 vm.runInNewContext(app.slice(app.indexOf('  function drawAxisLabels('),app.indexOf('  function drawChartCrosshair('))+'\nthis.grid=drawHorizontalTicks;this.labels=drawAxisLabels;',context);
 const {min,max,ticks}=niceValueDomain(743.4,753.2);
 assert.deepEqual(ticks,[742,744,746,748,750,752,754]);
 context.grid(ctx,78,1200,12,468,min,max,String,ticks);
 context.labels(ctx,{left:78,right:1200,top:12,bottom:468,min,max,ticks,formatter:String});
 assert.deepEqual(labels.map(x=>Number(x.text)),ticks);
 assert.deepEqual(labels.map(x=>x.y-4),positions);
 assert.equal(positions[0],468);assert.equal(positions.at(-1),12);
});
