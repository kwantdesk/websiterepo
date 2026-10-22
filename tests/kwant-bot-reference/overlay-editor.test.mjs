import test from 'node:test';
import assert from 'node:assert/strict';
import {PROFILE_CATEGORIES,profileSelector,profileAtOrBefore,nearestActualProfileTime,profileSelectionTime,selectProfileSnapshot} from '../../public/kwanty-app/overlay-editor.js';
import {buildProfileOverlayLayout} from '../../public/kwanty-app/profile-overlay.js';
import {SOURCE_TIMEZONES} from '../../public/kwanty-app/timezones.js';
test('profile provider scope distinguishes public State volume/Greeks from Classic OI',()=>{assert.deepEqual(profileSelector({category:'gex_one',gexDataType:'oi',showOI:true},'SPX'),{ticker:'SPX',package:'classic',category:'gex_one'});assert.equal(profileSelector({category:'gex_full',gexDataType:'volume'},'SPX').package,'state');assert.equal(profileSelector({category:'gamma_zero',showOI:true},'SPX').package,'state');assert.ok(!PROFILE_CATEGORIES.includes('volume_zero'))});
test('profile selection never borrows another ticker/day or future market snapshot',()=>{const t=1792180799,rows=[{ticker:'SPX',timestamp:t-2},{ticker:'SPX',timestamp:t+1},{ticker:'QQQ',timestamp:t},{ticker:'SPX',timestamp:t-86400}];assert.equal(profileAtOrBefore(rows,t,'SPX').timestamp,t-2);assert.equal(profileAtOrBefore(rows,t-10,'SPX'),null)});
test('profile dragging snaps only to actual same-session timestamps without interpolation',()=>{const t=1792180799,rows=[{ticker:'SPX',timestamp:t-60},{ticker:'SPX',timestamp:t},{ticker:'SPX',timestamp:t+60}];assert.equal(nearestActualProfileTime(rows,(t-10)*1000,t,'SPX'),t);assert.equal(nearestActualProfileTime(rows,(t-50)*1000,t,'SPX'),t-60);assert.equal(nearestActualProfileTime(rows,t*1000,t,'QQQ'),null)});
test('replaying backwards cannot select a future pinned profile or marker',()=>{const t=1792180799;assert.equal(profileSelectionTime(t,t-60),t-60);assert.equal(profileSelectionTime(t+86400,t),t);assert.equal(profileSelectionTime(t-86400,t),t);assert.equal(profileSelectionTime(t-120,t),t-120);const rows=[{ticker:'SPX',timestamp:t-60},{ticker:'SPX',timestamp:t}];assert.equal(profileAtOrBefore(rows,profileSelectionTime(t,t-60),'SPX').timestamp,t-60)});

test('live profiles render their own actual timestamp despite Orderflow final-close clock skew',()=>{
 const t=1792180799,profile={ticker:'SPX',timestamp:t+1,strikes:[[5000,25,8,[]]]},rows=[profile,{...profile,ticker:'QQQ',timestamp:t+2},{...profile,timestamp:t+86400}];
 const selected=selectProfileSnapshot(rows,{ticker:'SPX',targetTimestamp:t,live:true});
 assert.equal(selected.payload,profile);assert.equal(selected.time,t+1);
 assert.equal(selectProfileSnapshot(rows,{ticker:'SPX',targetTimestamp:t,pinnedTimestamp:t-86400,live:true}).payload,profile);
 const geometry={left:0,right:800,top:0,bottom:300,spotY:price=>150+(5000-price),timeX:time=>(time-t*1000)/1000};
 const layout=buildProfileOverlayLayout(geometry,{slots:[{show:true,category:'gex_zero',payload:selected.payload,time:selected.time}]});
 assert.equal(layout.layers.length,1);assert.equal(layout.layers[0].bars.length,1);assert.equal(layout.layers[0].timestamp,(t+1)*1000);
 assert.ok(!layout.warnings.some(warning=>/Future/.test(warning)));
});

test('paused, replay and pinned profiles still reject later snapshots even in the same session',()=>{
 const t=1792180799,earlier={ticker:'SPX',timestamp:t-60},later={ticker:'SPX',timestamp:t+1};
 for(const options of [{live:false},{live:true,pinnedTimestamp:t},{live:true,pinnedTimestamp:t-60}]){
  assert.equal(selectProfileSnapshot([earlier,later],{ticker:'SPX',targetTimestamp:t,...options}).payload,earlier);
  assert.equal(selectProfileSnapshot([later],{ticker:'SPX',targetTimestamp:t,...options}).payload,null);
 }
 assert.equal(selectProfileSnapshot([later],{ticker:'SPX',targetTimestamp:null,live:true}).payload,null);
});
test('source timezone inventory is bounded, unique and supported by runtime conversion',()=>{assert.ok(SOURCE_TIMEZONES.length>80);assert.equal(new Set(SOURCE_TIMEZONES.map(r=>r[0])).size,SOURCE_TIMEZONES.length);for(const [zone]of SOURCE_TIMEZONES)assert.doesNotThrow(()=>new Intl.DateTimeFormat('en-US',{timeZone:zone}).format(0));assert.ok(SOURCE_TIMEZONES.some(r=>r[0]==='Australia/Brisbane'))});
