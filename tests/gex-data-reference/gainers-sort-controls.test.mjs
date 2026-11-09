import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {gainersModel} from '../../public/gex-data-app/options-models.js';
const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');
const metricLiteral=source.match(/rankMetric: (\[\[.*?\]\]),/)[1];
const choices=vm.runInNewContext(metricLiteral);
function harness(tool='gainers-losers'){
 const values={rankMetric:'bullishPremium',rankDirection:'-1'};let saved;
 const env={activeTool:{id:tool},CONTROL_OPTIONS:{rankMetric:choices},setControl:(key,value)=>values[key]=value,saveToolControls:()=>saved={...values}};
 vm.runInNewContext(source.slice(source.indexOf('  function syncGainersHeaderSort('),source.indexOf('  function showTable('))+'\nthis.sort=syncGainersHeaderSort;',env);
 return{env,values,get saved(){return saved;}};
}
test('actual header observer keeps rank selector and persisted ascending direction aligned across new payloads',()=>{
 const h=harness();h.env.sort({key:'bearishPremium',direction:1});assert.deepEqual(h.saved,{rankMetric:'bearishPremium',rankDirection:'1'});
 const payload={AAA:{bullishPremium:500,bearishPremium:10},BBB:{bullishPremium:20,bearishPremium:200}};
 assert.deepEqual(gainersModel(payload,h.values.rankMetric,Number(h.values.rankDirection)).rows.map(r=>r.ticker),['AAA','BBB']);
 h.env.sort({key:'bearishPremium',direction:-1});assert.equal(h.saved.rankDirection,'-1');assert.deepEqual(gainersModel(payload,h.values.rankMetric,Number(h.values.rankDirection)).rows.map(r=>r.ticker),['BBB','AAA']);
});
test('every sortable Gainers field has a corresponding selector value, without touching other tables',()=>{
 for(const key of ['ticker','bearishPremium','bullishPremium','premiumRatio','volume','tradeCount','premium']){const h=harness();h.env.sort({key,direction:1});assert.equal(h.saved.rankMetric,key);}
 const h=harness('equity-prints');h.env.sort({key:'premium',direction:1});assert.equal(h.saved,undefined);assert.equal(h.values.rankMetric,'bullishPremium');
});
