import test from 'node:test';
import assert from 'node:assert/strict';
import {observeLiquidityMapModals} from '../public/heatmap-app/src/modal-overlay-bridge.js';
test('instrument picker, help and settings all hide parent overlays until the final modal closes',()=>{
 const dialogs=[{open:false},{open:false},{open:false}];const states=[];let callback,disconnected=false;
 class Observer {constructor(fn){callback=fn;}observe(root,options){assert.deepEqual(options.attributeFilter,['open']);}disconnect(){disconnected=true;}}
 const stop=observeLiquidityMapModals({querySelectorAll:selector=>{assert.equal(selector,'dialog');return dialogs;}},open=>states.push(open),Observer);
 dialogs[1].open=true;callback();assert.deepEqual(states,[false,true]);
 dialogs[0].open=true;callback();dialogs[1].open=false;callback();assert.deepEqual(states,[false,true]);
 dialogs[0].open=false;callback();dialogs[2].open=true;callback();dialogs[2].open=false;callback();
 assert.deepEqual(states,[false,true,false,true,false]);stop();assert.equal(disconnected,true);
});
