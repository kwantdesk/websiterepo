import test from 'node:test';import assert from 'node:assert/strict';
import {applyFootprintPreset,DEFAULT_FOOTPRINT_SETTINGS,FOOTPRINT_PRESET_OPTIONS} from '../src/lib/footprintSettings.ts';
import {footprintSidecarGeometry} from '../src/lib/footprintRenderMath.ts';
test('Standard is a persisted clean candle and bid-ask preset and other presets restore overlay layout',()=>{
 const s=applyFootprintPreset(DEFAULT_FOOTPRINT_SETTINGS,'standard');assert.ok(FOOTPRINT_PRESET_OPTIONS.some(p=>p.id==='standard'&&p.label==='Standard'));
 assert.equal(s.candleLayout,'side-by-side');assert.equal(s.contentMode,'ladder');assert.equal(s.visualizationMode,'text-only');
 for(const key of ['showWick','showBodyFill','showBodyOutline','showCellText'])assert.equal(s[key],true,key);
 for(const key of ['showPerBarVolumeProfile','showPerBarDeltaProfile','showSummary','showVolumePoc','showImbalances','outerEdgeMode'])assert.equal(s[key],false,key);
 assert.equal(applyFootprintPreset(s,'kwantdesk').candleLayout,'overlay');assert.equal(applyFootprintPreset(s,'order-flow').candleLayout,'overlay');
});
test('candle anchors, internal gap and neighbouring-pair space survive zoom',()=>{
 for(const width of [8,12,30,60,92,122,180]){
  const a=footprintSidecarGeometry(50,width,12,92),b=footprintSidecarGeometry(50+width,width,12,92);
  assert.equal(a.candleX,50);assert.ok(a.left>a.candleX+a.candleWidth/2);
  assert.ok(a.left+a.footprintWidth<b.candleX-b.candleWidth/2);
  assert.ok(a.footprintWidth>0);assert.ok(a.candleWidth>0);
 }
});
