import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareBounceGexMirror,selectBounceGexMirror} from '../src/lib/bounceGexMapMirror.ts';
import {normalizeLinkedGexMapSettings,DEFAULT_LINKED_GEX_MAP_SETTINGS} from '../src/lib/gexMapLinkedSettings.ts';
import {mergeBounceGexMapHistory} from '../src/lib/bounceGexMapHistory.ts';
import {projectionFixture} from './fixtures/bounceProjection.ts';
const settings=normalizeLinkedGexMapSettings({...DEFAULT_LINKED_GEX_MAP_SETTINGS,viewMode:'full'}),colorScale=['#00ffff','#ffffff','#ff00cc'];
const prepare=(fixture,displayInstrument='NQ',extra={})=>prepareBounceGexMirror({payload:fixture.payload,settings,displayInstrument,displayPriceAt:fixture.displayPriceAt,liveDisplayPrice:99999,colorScale,...extra});
for(const [source,display] of [['QQQ','NQ'],['QQQ','MNQ'],['NDX','NQ'],['NDX','MNQ'],['SPY','ES'],['SPY','MES'],['SPX','ES'],['SPX','MES'],['IWM','RTY'],['IWM','M2K']])test(source+' -> '+display+' aligns same-minute opens without sawtooth or altered exposure',()=>{
 const f=projectionFixture(source),prepared=prepare(f,display),basis=source==='NDX'||source==='SPX';assert.equal(prepared.frames.length,24);
 for(const frame of prepared.frames)for(const node of frame.slice.nodes){assert.ok(Math.abs(node.mappedPrice-(basis?node.sourceStrike+20:node.sourceStrike*40))<1e-8);assert.equal(node.signedExposure,f.rows.find(r=>r.strike===node.sourceStrike).net)}
 const live=selectBounceGexMirror(prepared,null);assert.ok(live);assert.equal(live.mapping.displayMidPrice,f.displayPriceAt(Date.parse(f.payload.asOf)));assert.ok(live.levels.every(n=>Math.abs(n.mappedPrice-(basis?n.sourceStrike+20:n.sourceStrike*40))<1e-8));
});
test('SPY on NQ and MNQ stays level as the two markets diverge', () => {
 const f = projectionFixture('SPY');
 const displayPriceAt = timestamp => {
  const index = Math.floor((timestamp - f.start) / f.minute);
  return index >= 0 && index < f.payload.candles.length ? 20_000 + (index % 2 ? -90 : 0) + index * 4 : null;
 };
 // Exposure may move independently of the mapped strike coordinates.
 const changedRows = f.rows.map(row => ({...row, net: row.net * 2, call: row.call * 2, put: row.put * 2}));
 const payload = {...f.payload, latestStrikes: changedRows, frames: f.payload.frames.map((frame, index) =>
  index === 12 ? {...frame, updates: changedRows} : index > 12 ? {...frame, updates: []} : frame)};
 for (const display of ['NQ', 'MNQ']) {
  const prepared = prepare({...f, payload}, display, {displayPriceAt});
  assert.equal(prepared.frames.length, 24);
  assert.ok(prepared.frames.every(frame => frame.slice.nodes.every(node => node.mappedPrice === node.sourceStrike * 40)));
  assert.deepEqual(prepared.frames[12].slice.nodes.map(node => node.signedExposure), changedRows.map(row => row.net));
  const live = selectBounceGexMirror(prepared, null);
  assert.equal(live.mapping.method, 'session-anchored-ratio');
  assert.equal(live.mapping.calculatedAtMs, f.start);
  assert.equal(live.mapping.displayMidPrice, displayPriceAt(Date.parse(payload.asOf)));
  assert.deepEqual(live.levels.map(node => node.mappedPrice), prepared.frames[0].slice.nodes.map(node => node.mappedPrice));
 }
});

test('cross-family replay never borrows a future anchor, and a compact head keeps the full-session anchor', () => {
 const f = projectionFixture('SPY');
 const firstPair = f.start + 2 * f.minute;
 const displayPriceAt = timestamp => timestamp < firstPair ? null : f.displayPriceAt(timestamp) + 25;
 const head = {...f.payload, compact: true, frames: f.payload.frames.slice(-1), candles: f.payload.candles.slice(-1)};
 assert.equal(selectBounceGexMirror(prepare({...f, payload: head}, 'NQ', {displayPriceAt}), null), null);
 const payload = mergeBounceGexMapHistory(f.payload, head);
 const prepared = prepare({...f, payload}, 'NQ', {displayPriceAt, liveReference: head});
 assert.equal(selectBounceGexMirror(prepared, firstPair - 1), null);
 const early = selectBounceGexMirror(prepared, firstPair + 30_000);
 const live = selectBounceGexMirror(prepared, null);
 assert.equal(early.mapping.calculatedAtMs, firstPair);
 assert.deepEqual(live.levels.map(node => node.mappedPrice), early.levels.map(node => node.mappedPrice));
});

test('changing the unknown final close cannot move an earlier projected node',()=>{const f=projectionFixture();const before=selectBounceGexMirror(prepare(f),f.start+30000);const changed={...f,payload:{...f.payload,candles:f.payload.candles.map(c=>({...c,close:c.close+50,high:c.high+100}))}};const after=selectBounceGexMirror(prepare(changed),f.start+30000);assert.deepEqual(after.levels.map(n=>n.mappedPrice),before.levels.map(n=>n.mappedPrice));assert.equal(after.mapping.sourceSpotPrice,500)});
test('a missing source minute is not paired with a previous close or future opening',()=>{const f=projectionFixture();f.payload={...f.payload,candles:f.payload.candles.filter(c=>c.timestamp!==f.start+f.minute)};assert.equal(selectBounceGexMirror(prepare(f),f.start+f.minute+30000),null);assert.ok(selectBounceGexMirror(prepare(f),f.start+2*f.minute+30000))});
test('source-opening corrections invalidate cached projection geometry on identical exposure frames',()=>{const f=projectionFixture(),a=prepare(f),changed={...f,payload:{...f.payload,candles:f.payload.candles.map((c,i)=>i?c:{...c,open:501})}},b=prepare(changed);assert.notEqual(a.frames[0].slice.nodes[0].mappedPrice,b.frames[0].slice.nodes[0].mappedPrice);assert.deepEqual(a.frames[0].slice.nodes.map(n=>n.signedExposure),b.frames[0].slice.nodes.map(n=>n.signedExposure))});
test('QQQ directly on QQQ retains the actual source strikes',()=>{const f=projectionFixture();const a=selectBounceGexMirror(prepare(f,'QQQ'),f.start+30000);assert.ok(a.levels.every(n=>n.mappedPrice===n.sourceStrike))});

test('compact head opening corrections survive archive merge even if its close is unchanged',()=>{const f=projectionFixture(),last=f.payload.candles.at(-1);const merged=mergeBounceGexMapHistory(f.payload,{...f.payload,candles:[{...last,open:last.open+1}]});assert.equal(merged.candles.at(-1).open,last.open+1);assert.equal(merged.candles.at(-1).close,last.close);});

for (const [source, display] of [['QQQ', 'NQ'], ['SPX', 'ES']]) {
 test(source + ' live edge retains the verified frame while the display minute is missing', () => {
  const f = projectionFixture(source), last = f.payload.candles.at(-1).timestamp;
  const result = selectBounceGexMirror(prepare(f, display, {
   liveDisplayPrice: 99999,
   displayPriceAt: timestamp => timestamp >= last ? null : f.displayPriceAt(timestamp),
  }), null);
  assert.ok(result);
  assert.equal(result.snapshotTimeMs, last - f.minute);
  assert.equal(result.exposureField.at(-1).timestamp, last - f.minute);
  for (const node of result.exposureField.flatMap(slice => slice.nodes)) {
   assert.ok(Math.abs(node.mappedPrice - (source === 'SPX' ? node.sourceStrike + 20 : node.sourceStrike * 40)) < 1e-8);
  }
  const resumed = selectBounceGexMirror(prepare(f, display), null);
  assert.equal(resumed.snapshotTimeMs, Date.parse(f.payload.asOf));
  assert.ok(resumed.levels.every(node => Math.abs(node.mappedPrice - (source === 'SPX' ? node.sourceStrike + 20 : node.sourceStrike * 40)) < 1e-8));
 });
 test(source + ' live edge uses the matching compact minute before archive catches up', () => {
  const f = projectionFixture(source), liveReference = f.payload;
  const archived = {...f, payload: {...f.payload, candles: f.payload.candles.slice(0, -1)}};
  const result = selectBounceGexMirror(prepare(archived, display, {liveReference}), null);
  assert.equal(result.snapshotTimeMs, Date.parse(liveReference.asOf));
  assert.equal(result.mapping.sourceSpotPrice, liveReference.candles.at(-1).open);
  assert.equal(result.mapping.displayMidPrice, f.displayPriceAt(liveReference.candles.at(-1).timestamp));
  assert.ok(result.levels.every(node => Math.abs(node.mappedPrice - (source === 'SPX' ? node.sourceStrike + 20 : node.sourceStrike * 40)) < 1e-8));
 });
}
