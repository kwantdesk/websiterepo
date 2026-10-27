import test from 'node:test';import assert from 'node:assert/strict';
import {renderProfile} from './helpers/volume-profile-render-harness.mjs';
import {resolveVolumeProfileRenderGrouping} from '../src/lib/volumeProfileMath.ts';
test('ES manual four-tick profiles do not double-coarsen readable one-point rows',()=>{
 const {primitive,model}=renderProfile({symbol:'ES',tickSize:.25,basePrice:7700,pixelsPerTick:.4,manualGroupTicks:4,levelCount:32,mode:'volume',visualStyle:'solid'});
 const levels=primitive.derived.get(model.id).value.levels;
 assert.equal(levels.length,8,'32 ES ticks at four ticks per row must yield eight rows, not four double-width rows');
 assert.equal(levels[1].price-levels[0].price,1);
});
test('ES tick rows survive all profile modes, visual styles and period models',()=>{
 for(const period of ['daily','weekly','custom']) for(const mode of ['volume','delta-volume','bid-ask','delta','delta-percentage'])
 for(const visualStyle of ['automatic','solid','hollow','line','combined']){
  const {primitive,model,profile,paths}=renderProfile({symbol:'ES',tickSize:.25,basePrice:7700,pixelsPerTick:2,manualGroupTicks:1,levelCount:32,period,mode,visualStyle});
  const levels=primitive.derived.get(model.id).value.levels;
  assert.equal(levels.length,32,`${period}/${mode}/${visualStyle}`);
  assert.equal(levels[1].price-levels[0].price,.25);
  assert.equal(levels.reduce((sum,row)=>sum+row.volume,0),profile.totalVolume);
  assert.ok(paths.length>0);
 }
});
test('manual rows retain requested granularity while automatic and subpixel bins remain bounded',()=>{
 const grouping=(overrides)=>resolveVolumeProfileRenderGrouping({sourceGroupTicks:1,sourceRowPixels:.4,automatic:false,manualGroupTicks:4,...overrides}).groupedTicks;
 assert.equal(grouping({}),4);
 assert.equal(grouping({automatic:true}),2);
 assert.equal(grouping({sourceRowPixels:.05}),12);
 assert.equal(grouping({sourceGroupTicks:4,sourceRowPixels:2,manualGroupTicks:1}),4,'never invent finer source rows');
 assert.equal(grouping({automatic:true,autoGroupFactor:4}),6);
});
