import test from 'node:test';
import assert from 'node:assert/strict';
import {footprintGroupTicks} from '../src/lib/footprintGrouping.ts';
test('unpainted scale starts with detailed rows rather than a stale coarse projection',()=>{
 assert.equal(footprintGroupTicks({},null,0),1);
 assert.equal(footprintGroupTicks({},.15,0),70);
 assert.equal(footprintGroupTicks({},16,0),1);
});
test('manual grouping remains independent of scale, automatic factors and open-close mode preserved',()=>{
 for(const px of [null,.001,1,20])assert.equal(footprintGroupTicks({groupingMode:'manual',manualTicks:4},px,1000),4);
 assert.equal(footprintGroupTicks({autoGroupFactor:2},5,0),5);
 assert.equal(footprintGroupTicks({groupMode:'open-close'},20,180),10);
 assert.equal(footprintGroupTicks({},.00001,0),100);
});
