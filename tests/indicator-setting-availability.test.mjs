import test from 'node:test';
import assert from 'node:assert/strict';
import { indicatorSettingDisabledReason as reason } from '../src/lib/indicatorSettingAvailability.ts';
import { calculateIndicatorSeries } from '../src/lib/chartIndicatorEngine.ts';
import { defaultIndicatorSettings } from '../src/lib/chartIndicatorConfig.ts';
import { INDICATOR_GRADIENTS } from '../src/lib/indicatorPalettes.ts';
const theme={primary:'#eee',secondary:'#aaa',positive:'#0f0',negative:'#f00',muted:'#888'};
const candles=Array.from({length:240},(_,i)=>({timestamp:Date.UTC(2026,10,5,14)+i*60000,open:100+i/20,close:101+Math.sin(i/4)*3,high:105+i/20,low:90,volume:10+i%40,askVolume:7+i%28,bidVolume:3+i%12,delta:4+i%28-i%12}));
const run=(id,patch)=>calculateIndicatorSeries({instanceId:'test',indicatorId:id,enabled:true,settings:{...defaultIndicatorSettings(id),...patch}},candles,theme,{instrument:'NQ',tickSize:.25});
test('CVD filter controls name their actual dependency and change the filtered plot when enabled',()=>{
 assert.ok(reason('cumulative-volume-delta','filterMinVolume',{}));assert.equal(reason('cumulative-volume-delta','filterMinVolume',{filteredEnabled:true}),undefined);
 const a=run('cumulative-volume-delta',{filteredEnabled:true,filterMinVolume:0}),b=run('cumulative-volume-delta',{filteredEnabled:true,filterMinVolume:1000});
 assert.notDeepEqual(a.find(s=>s.key.endsWith('-filtered')).data,b.find(s=>s.key.endsWith('-filtered')).data);
 assert.deepEqual(a[0].data,b[0].data,'filter must not alter the unfiltered CVD');
});
test('average and deviation sliders activate only for plots they control',()=>{
 assert.ok(reason('delta-cumulative-candlestick','averageLength',{}));assert.equal(reason('delta-cumulative-candlestick','averageLength',{showAverage:true}),undefined);
 assert.ok(reason('delta-cumulative-candlestick','averageDeviation',{showAverage:true}));
 const a=run('delta-cumulative-candlestick',{showAverage:true,averageLength:3}),b=run('delta-cumulative-candlestick',{showAverage:true,averageLength:30});
 assert.notDeepEqual(a.find(s=>s.key.endsWith('-average')).data,b.find(s=>s.key.endsWith('-average')).data);
});
test('Sprint smoothing and regression/Zig Zag controls track their calculation modes',()=>{
 assert.ok(reason('volume-delta-sprint','smoothingLength',{}));assert.equal(reason('volume-delta-sprint','smoothingLength',{smoothingEnabled:true}),undefined);
 assert.notDeepEqual(run('volume-delta-sprint',{smoothingEnabled:true,smoothingLength:2}),run('volume-delta-sprint',{smoothingEnabled:true,smoothingLength:20}));
 assert.ok(reason('regression-channel','zigZagReversalValue',{mode:'bars'}));assert.equal(reason('regression-channel','zigZagReversalValue',{mode:'zig-zag'}),undefined);
 assert.ok(reason('zig-zag','absoluteReversalPercent',{zigZagMode:'highest-lowest'}));assert.equal(reason('zig-zag','absoluteReversalPercent',{zigZagMode:'absolute-reversal'}),undefined);
});
test('scheme ownership disables theme toggle without disabling unrelated controls',()=>{
 assert.ok(INDICATOR_GRADIENTS.length);for(const p of INDICATOR_GRADIENTS)assert.ok(reason('moving-average','useThemeColors',{gradientPreset:p.id}));
 assert.equal(reason('moving-average','useThemeColors',{gradientPreset:'off'}),undefined);
 assert.equal(reason('moving-average','length',{gradientPreset:INDICATOR_GRADIENTS[0].id}),undefined);
});
