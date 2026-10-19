import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const source = read('../public/gex-data-app/app.js');
const loadCode = source.slice(source.indexOf('  async function loadActiveTool('), source.indexOf('  function schedulePoll()'));

function harness() {
  const requests = [], renders = [], attrs = new Map();
  const nodes = {'#toolError': {hidden: true}, '#toolUpdated': {textContent: 'Previous source time'}};
  const context = {
    activeTool: {id: 'interval-map'}, toolRequestId: 0, toolCursor: null,
    toolPayload: {data: 'previous verified data'}, tableRows: [], pollTimer: 1,
    activeController: null, frameVisible: true, window: {}, AbortController,
    toolView: {setAttribute: (key, value) => attrs.set(key, value)},
    q: selector => { assert.ok(nodes[selector], `Unexpected DOM access: ${selector}`); return nodes[selector]; },
    clearTimeout() {}, schedulePoll: () => context.scheduled++, scheduled: 0,
    updateInitialToolLoading:busy=>context.initialLoading=busy,initialLoading:false,
    loadToolPayload: () => new Promise((resolve, reject) => requests.push({resolve, reject})),
    renderToolPayload: (_, payload) => renders.push(payload), renderSnapshotControl() {},
    snapshotSelections: new Map(), snapshotKey: () => 'current',
    getControl: () => 'latest', apiStatus: {market: {open: true}},
    saveToolControls() {}, updateLiveState() {}, EMBEDDED: false,
  };
  vm.runInNewContext(`${loadCode}\nglobalThis.load = loadActiveTool;`, context);
  return {context, requests, renders, attrs, nodes};
}

test('refresh retains the existing tool without any loading overlay or early redraw', async () => {
  const h = harness(), previous = h.context.toolPayload;
  const pending = h.context.load();
  assert.equal(h.context.toolPayload, previous);
  assert.equal(h.renders.length, 0);
  assert.equal(h.attrs.get('aria-busy'), 'true');
  h.requests[0].resolve({data: 'new verified data'});
  await pending;
  assert.equal(h.renders.length, 1);
  assert.equal(h.context.toolPayload.data, 'new verified data');
  assert.equal(h.attrs.get('aria-busy'), 'false');
  assert.equal(h.context.scheduled, 1);
});

test('a real refresh failure preserves the previous data and exposes the error', async () => {
  const h = harness(), previous = h.context.toolPayload;
  const pending = h.context.load();
  h.requests[0].reject(new Error('Data connection unavailable'));
  await pending;
  assert.equal(h.context.toolPayload, previous);
  assert.equal(h.renders.length, 0);
  assert.equal(h.nodes['#toolError'].hidden, false);
  assert.equal(h.nodes['#toolError'].textContent, 'Data connection unavailable');
  assert.equal(h.nodes['#toolUpdated'].textContent, 'Previous source time');
  assert.equal(h.attrs.get('aria-busy'), 'false');
});

test('superseded requests cannot repaint data or clear the current request busy state', async () => {
  const h = harness();
  const first = h.context.load(), firstController = h.context.activeController;
  const second = h.context.load();
  assert.equal(firstController.signal.aborted, true);
  h.requests[0].resolve({data: 'obsolete'}); await first;
  assert.equal(h.renders.length, 0);
  assert.equal(h.attrs.get('aria-busy'), 'true');
  assert.equal(h.context.scheduled, 0);
  h.requests[1].resolve({data: 'current'}); await second;
  assert.equal(h.renders.length, 1);
  assert.equal(h.renders[0].data, 'current');
  assert.equal(h.attrs.get('aria-busy'), 'false');
});

test('only an empty first load uses the standard loader; pagination and paused tools do not', async () => {
  const h = harness(); h.context.toolPayload = null;
  const initial = h.context.load();
  assert.equal(h.context.initialLoading,true);
  h.requests[0].resolve({data: [{id: 1}]}); await initial;
  assert.equal(h.context.initialLoading,false);
  h.context.tableRows = [{id: 1}];
  const next = h.context.load({append: true});
  assert.equal(h.context.initialLoading,false);
  assert.equal(h.renders.length, 1);
  h.requests[1].resolve({data: [{id: 2}]}); await next;
  assert.deepEqual(Array.from(h.context.toolPayload.data, row => row.id), [1, 2]);
  h.context.window.__gexDataActive = false;
  await h.context.load();
  assert.equal(h.requests.length, 2);
});

test('pagination retains first-page aggregate statistics rather than removing the flow header',async()=>{
  const h=harness(),statistics={CALL:{ASK:{premium:12345}},PUT:{BID:{premium:2345}}};
  h.context.activeTool={id:'order-flow-consolidated'};
  h.context.toolPayload={data:[{id:1}],statistics};h.context.tableRows=[{id:1}];
  const more=h.context.load({append:true});h.requests[0].resolve({data:[{id:2}],nextSearchAfter:['next']});await more;
  assert.equal(h.context.toolPayload.statistics,statistics);
  assert.deepEqual(Array.from(h.context.toolPayload.data,row=>row.id),[1,2]);
  const replacement={CALL:{ASK:{premium:999}}},next=h.context.load({append:true});
  h.requests[1].resolve({data:[{id:3}],statistics:replacement});await next;
  assert.equal(h.context.toolPayload.statistics,replacement);
});

test('initial loading uses standard presentation without reintroducing legacy licensed-data refresh covers', () => {
  assert.doesNotMatch(source, /classList\.(?:add|remove)\("loading"\)/);
  assert.doesNotMatch(read('../public/gex-data-app/index.html'), /toolLoading|Loading licensed market-data/);
  assert.doesNotMatch(read('../public/gex-data-app/styles.css'), /tool-loading|\.panel\.loading::after/);
  assert.match(read('../public/gex-data-app/index.html'), /id="toolError"/);
  assert.match(read('../public/gex-data-app/index.html'), /id="toolUpdated"/);
  assert.match(source, /panel\.setAttribute\("aria-busy", "true"\)/);
  assert.match(source, /panel\.setAttribute\("aria-busy", "false"\)/);
  assert.match(source, /Math\.max\(30000,activeTool\.liveMs\)/);
});
