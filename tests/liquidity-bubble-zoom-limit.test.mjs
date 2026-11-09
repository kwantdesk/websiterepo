import test from 'node:test';
import assert from 'node:assert/strict';
import {tradeBubbleZoom} from '../public/heatmap-app/src/liquidity-presentation.js';
const reference={rowPixels:5,columnPixels:1.24};
const layout={plotHeight:500,visibleTickSpan:100,dataWidth:800,historyLength:12,columnPixels:1.24};

test('time-axis wheel cannot resize bubbles when insufficient history leaves the geometry unchanged',()=>{
 const initial=tradeBubbleZoom(layout,reference);
 for(const historyLength of [1,2,12,29,30,60])for(const columnPixels of [.12,.45,1,1.24,2,4,8])
  assert.equal(tradeBubbleZoom({...layout,historyLength,columnPixels},reference),initial);
});

test('a real time-axis stretch scales bubbles and saturates with the visible geometry',()=>{
 const full={...layout,historyLength:2000};
 assert.ok(tradeBubbleZoom({...full,columnPixels:4},reference)>tradeBubbleZoom({...full,columnPixels:2},reference));
 const fitting={...layout,historyLength:1000};
 assert.equal(tradeBubbleZoom({...fitting,columnPixels:.12},reference),tradeBubbleZoom({...fitting,columnPixels:.45},reference));
 const minimumWindow={...layout,dataWidth:120,historyLength:2000};
 assert.equal(tradeBubbleZoom({...minimumWindow,columnPixels:8},reference),tradeBubbleZoom({...minimumWindow,columnPixels:5},reference));
});

test('vertical zoom still scales bubbles independently of a time-axis limit',()=>{
 assert.ok(tradeBubbleZoom({...layout,visibleTickSpan:50},reference)>tradeBubbleZoom(layout,reference));
});
