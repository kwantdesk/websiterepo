import test from 'node:test';
import assert from 'node:assert/strict';
import {orderflowViewport} from '../../public/kwanty-app/orderflow-viewport.js';

test('Orderflow shows the observed 9:15 ET start and advances the 45 minute runway with real data',()=>{
 const latestTime=Date.UTC(2026,10,5,16,56);
 assert.deepEqual(orderflowViewport({latestTime}),{startTime:Date.UTC(2026,10,5,14,15),endTime:Date.UTC(2026,10,5,17,41)});
 assert.equal(orderflowViewport({latestTime:latestTime+1000}).endTime,Date.UTC(2026,10,5,17,41)+1000);
});
test('Orderflow rolling windows keep their duration and the close caps the runway',()=>{
 const latestTime=Date.UTC(2026,6,1,19,55);
 for(const [period,runway] of [[1800,600],[3600,1200],[5400,1800],[300,300]]){
  assert.deepEqual(orderflowViewport({latestTime,period}),{startTime:latestTime+(runway-period)*1000,endTime:latestTime+runway*1000});
 }
 assert.equal(orderflowViewport({latestTime:latestTime+3600000}).endTime,Date.UTC(2026,6,1,20,45));
 assert.deepEqual(orderflowViewport({}),{});
});
