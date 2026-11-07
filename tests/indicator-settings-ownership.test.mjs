import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {CHART_INDICATOR_CATALOG,canonicalChartIndicatorId} from '../src/lib/chartIndicatorCatalog.ts';
import {defaultIndicatorSettings} from '../src/lib/chartIndicatorConfig.ts';
import {calculateIndicatorSeries} from '../src/lib/chartIndicatorEngine.ts';
import {INDICATOR_DEDICATED_CONTROL_KEYS} from '../src/lib/indicatorDedicatedControlKeys.ts';
const theme={primary:'#eeeeee',secondary:'#aaaaff',positive:'#22cc88',negative:'#ee3355',muted:'#777777'};
const candles=Array.from({length:20},(_,i)=>({timestamp:1700000000000+i*60000,open:100,high:102,low:99,close:101,volume:20,askVolume:12+i%4,bidVolume:8}));
test('public catalogue has unique IDs and no separately advertised legacy aliases',()=>{
 const ids=CHART_INDICATOR_CATALOG.map(x=>x.id);assert.equal(new Set(ids).size,ids.length);
 assert.equal(new Set(ids.map(canonicalChartIndicatorId)).size,ids.length);
});
test('dedicated editor ownership does not contain duplicate keys',()=>{
 for(const [id,keys]of Object.entries(INDICATOR_DEDICATED_CONTROL_KEYS)){assert.ok(CHART_INDICATOR_CATALOG.some(d=>d.id===id));assert.equal(new Set(keys).size,keys.length,id);}
});
test('histogram has one main plot colour; chosen line colour reaches visible output',()=>{
 const defaults=defaultIndicatorSettings('delta-cumulative-histogram');assert.equal(Object.hasOwn(defaults,'lineColor'),false);
 const run=color=>calculateIndicatorSeries({instanceId:'hist',indicatorId:'delta-cumulative-histogram',enabled:true,settings:{...defaults,displayStyle:'line',useThemeColors:false,plotColor:color}},candles,theme);
 for(const color of ['#123456','#ABCDEF']){const series=run(color)[0];assert.equal(series.color,color);assert.ok(series.data.every(p=>p.color===undefined));}
});
test('shared palette no longer duplicates individual controls in the main indicator editor',()=>{
 const source=fs.readFileSync('src/components/ChartIndicatorsControl.tsx','utf8');
 assert.match(source,/indicatorId=\{settingsDefinition.id\}\s+showIndividualColors=\{false\}/);
 assert.match(source,/INDICATOR_DEDICATED_CONTROL_KEYS\[settingsDefinition.id\]\?\.includes\(setting.key\)/);
 assert.match(source,/INDICATOR_DEDICATED_CONTROL_KEYS\[settingsDefinition.id\]\?\.includes\(key\)/);
});

test('dedicated control inventory stays aligned when settings editors change',()=>{
 execFileSync(process.execPath,['scripts/audits/generate-indicator-dedicated-control-keys.mjs','--check'],{stdio:'pipe'});
});
