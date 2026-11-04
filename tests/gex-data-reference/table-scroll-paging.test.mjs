import test from 'node:test';
import assert from 'node:assert/strict';
import {mountTableScrollPaging} from '../../public/gex-data-app/table-scroll-paging.js';
const settled=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){const scroller=new EventTarget();Object.assign(scroller,{scrollTop:0,clientHeight:200,scrollHeight:1000});const state={enabled:true,scope:'session-filter-sort-1',cursor:['clock','opaque-id'],busy:false},calls=[];let release;const cleanup=mountTableScrollPaging({scroller,getState:()=>state,onNext:()=>{calls.push(state.cursor);return new Promise(resolve=>{release=resolve;});}});return {state,calls,scroller,cleanup,scroll(top){scroller.scrollTop=top;scroller.dispatchEvent(new Event('scroll'));},finish(){release?.();}};}
test('near-end paging needs a downward gesture, preserves opaque cursors, deduplicates in flight and never chains after a response',async()=>{
 const h=fixture();h.scroll(100);await settled();assert.equal(h.calls.length,0);h.scroll(700);h.scroll(710);await settled();assert.equal(h.calls.length,1);assert.equal(h.calls[0],h.state.cursor);
 h.scroll(720);await settled();assert.equal(h.calls.length,1);h.finish();await settled();assert.equal(h.calls.length,1);h.scroll(730);await settled();assert.equal(h.calls.length,1,'same opaque cursor is never retried automatically');
 h.state.cursor=['next-clock',0,'same-order'];await settled();assert.equal(h.calls.length,1,'a new cursor alone must not fetch');h.scroll(740);await settled();assert.equal(h.calls.length,2);assert.equal(h.calls[1],h.state.cursor);h.finish();await settled();h.state.cursor=null;h.scroll(750);await settled();assert.equal(h.calls.length,2);h.cleanup();
});
test('a completed same-scope first-page refresh permits its cursor again without fetching until another downward gesture',async()=>{
 const h=fixture();h.state.pageGeneration=1;h.scroll(700);await settled();assert.equal(h.calls.length,1);h.finish();await settled();h.state.pageGeneration=2;await settled();assert.equal(h.calls.length,1);h.scroll(710);await settled();assert.equal(h.calls.length,2);h.finish();await settled();h.cleanup();
});
test('paging scope/busy/short-viewport guards and destroy prevent stale or runaway work',async()=>{
 const h=fixture();h.scroller.scrollHeight=100;h.scroll(1);await settled();assert.equal(h.calls.length,0);h.scroller.scrollHeight=1000;h.state.busy=true;h.scroll(700);await settled();assert.equal(h.calls.length,0);h.state.busy=false;
 h.scroll(710);h.state.scope='new-selection';h.state.cursor=null;await settled();assert.equal(h.calls.length,0,'a queued old-scope gesture cannot start a new-scope request');
 h.state.cursor=['clock','opaque-id'];h.scroll(720);await settled();assert.equal(h.calls.length,1);h.finish();await settled();h.state.scope='third-selection';h.scroll(730);await settled();assert.equal(h.calls.length,2,'the same cursor in a genuine new scope remains valid');h.finish();await settled();
 h.state.cursor=['last'];h.scroll(740);h.cleanup();await settled();assert.equal(h.calls.length,2);h.scroll(750);await settled();assert.equal(h.calls.length,2);
});
