import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { archiveDate, historyTimeAt, historyPosition, nearestHistoryFrame, fetchRecordedHistory } from '../public/heatmap-app/src/history-transport.js';
import { normalizeLiveSnapshot, isFullDepthSource } from '../public/heatmap-app/src/live-market.js';
import { SYMBOLS } from '../public/heatmap-app/src/market-simulator.js';

const source = readFileSync(new URL('../public/heatmap-app/src/main.js', import.meta.url), 'utf8');
const methods = [
  source.slice(source.indexOf('  #postReplayStatus('), source.indexOf('  #ingestDepthSnapshot(')),
  source.slice(source.indexOf('  #pauseHistory('), source.indexOf('  #cycleSpeed(')),
  source.slice(source.indexOf('  #pointerMove('), source.indexOf('  #pointerLeave(')),
  source.slice(source.indexOf('  #panHistory('), source.indexOf('  #cvdWheel(')),
].join('\n').replaceAll('#', '');
const elements = new Map();
const $ = id => {
  if (!elements.has(id)) elements.set(id, { textContent: '', classList: { toggle() {} },
    setAttribute() {}, querySelector() { return { classList: { toggle() {} } }; } });
  return elements.get(id);
};
const Harness = new Function('$', 'archiveDate', 'nearestHistoryFrame', 'historyTimeAt',
  'normalizeLiveSnapshot', 'isFullDepthSource', 'SYMBOLS', 'MAX_HISTORY', 'INSTITUTIONAL_MARKET_DATA_ORIGIN', 'fetchRecordedHistory', `return class {
  constructor() {
    this.symbol='NQ'; this.localHistory=null; this.settings={autoCenter:true}; this.view={};
    this.instrumentSubscriptions=new Map(); this.atLive=true; this.playing=true;
    this.replay={active:false, chunks:new Map()}; this.sourceMode='live';
    this.depthEngine={frames:[],reset(){this.frames=[];},append(row){this.frames.push(row);if(this.frames.length>1800)this.frames.shift();}};
    this.history=this.depthEngine.frames; this.tape=[]; this.cvdHistory=[]; this.feedStops=0;
    this.liveFeed={stop:()=>this.feedStops++,start:()=>{this.feedStarts=(this.feedStarts||0)+1;}};
    this.renderer={layout:{},endInteraction(){}};
  }
  canvasPoint(point){return point;} setChartCursor(){}
  updateSymbolUi(){} renderTape(){} requestRender(){} updateUi(){} appendTrades(rows){this.tape.push(...rows);}
  ${methods}
}`)($,archiveDate,nearestHistoryFrame,historyTimeAt,normalizeLiveSnapshot,isFullDepthSource,SYMBOLS,1800,'https://feed.test',(path,query)=>fetch(`https://feed.test${path}?${query}`));

test('six-hour slider uses exchange timestamps, with no interpolation of market books', () => {
  const end = Date.parse('2026-10-28T08:00:00Z');
  const start = end - 6*3600_000;
  for (const position of [0,123,500,999,1000]) assert.equal(historyPosition(historyTimeAt(position,start,end),start,end),position);
  const frames=[{timestamp:start},{timestamp:start+2000},{timestamp:start+4000}];
  assert.equal(nearestHistoryFrame(frames,start+3500),1);
  assert.equal(nearestHistoryFrame(frames,start-1),-1);
  assert.equal(nearestHistoryFrame([{timestamp:start},{timestamp:start+60_000}],start+30_000),-1);
});

test('archive session key follows Chicago 17:00 boundary through DST', () => {
  assert.equal(archiveDate(Date.parse('2026-10-28T08:00:00Z')),'2026-10-27');
  assert.equal(archiveDate(Date.parse('2026-10-28T22:00:00Z')),'2026-10-28');
  assert.equal(archiveDate(Date.parse('2026-11-02T22:59:00Z')),'2026-11-01');
  assert.equal(archiveDate(Date.parse('2026-11-02T23:00:00Z')),'2026-11-02');
});

const BASE=Date.parse('2026-10-28T08:00:00Z');
const seed=app=>{app.history.push({timestamp:BASE-4000},{timestamp:BASE-2000},{timestamp:BASE});app.viewEnd=2;};
test('pause is stable, auto-center permits horizontal drag, and LIVE resumes explicitly', () => {
  const app=new Harness();seed(app);app.togglePlayback();
  assert.equal(app.atLive,false);assert.equal(app.playing,false);
  app.panHistory(-1);
  assert.equal(app.history[app.viewEnd].timestamp,BASE-2000);
  assert.equal(app.localHistory.endMs,BASE);
  app.handleReplayMessage({active:false});
  assert.ok(app.localHistory,'parent live acknowledgement cannot silently unpause');
  app.togglePlayback();assert.equal(app.localHistory,null);assert.equal(app.atLive,true);assert.equal(app.playing,true);
});

test('multi-hour seek downloads actual bounded archive chunks and never stops live execution quotes', async () => {
  const app=new Harness();seed(app);
  const wanted=BASE-3*3600_000+4000;
  const chunkStart=Math.floor(wanted/1800_000)*1800_000;
  const snapshot={timestamp:wanted,root:'NQ',contractSymbol:'NQZ6',tickSize:.25,
    bids:[[400,10,2]],asks:[[401,12,3]],bestBid:400,bestAsk:401,lastTick:400,
    fullDepth:true,bookValid:true,readOnly:true,source:'rithmic-depth-by-order',trades:[]};
  const chunk={startMs:chunkStart,endMs:chunkStart+1800_000,frames:3};
  const manifest={root:'NQ',exchange:'CME',tradingDate:archiveDate(wanted),frameMs:2000,chunks:[chunk]};
  const oldFetch=globalThis.fetch;const urls=[];
  globalThis.fetch=async url=>{urls.push(url);return {ok:true,json:async()=>url.includes('/chunk?')?{chunk,frames:[-2000,0,2000].map(offset=>({snapshot:{...snapshot,timestamp:wanted+offset}}))}:{manifest}};};
  try {
    app.seekHistory(wanted+2500);
    for(let i=0;i<20;i++)await Promise.resolve();
    assert.equal(app.history.at(-1)?.timestamp,wanted+2000);
    assert.equal(app.feedStops,0,'history pauses presentation, not live execution quotes');
    assert.equal(app.atLive,false);assert.equal(app.history.length,3);
    assert.equal(app.localHistory.state,'ready');
    const retained=app.history[0];
    app.seekHistory(wanted+500);
    assert.equal(app.history[app.viewEnd].timestamp,wanted);
    assert.equal(app.history[0],retained,'dragging inside a loaded window must not rebuild packed books');
    assert.equal(urls.length,2,'a loaded-window drag must not fetch chunks or leases');
    app.seekHistory(wanted+4500);
    for(let i=0;i<20;i++)await Promise.resolve();
    assert.equal(app.history[0],retained,'small forward seeks append rather than rebuilding the window');
    assert.equal(app.history[app.viewEnd].timestamp,wanted+2000);
    assert.equal(urls.length,2);
    assert.ok(urls.every(url=>url.includes('tradingDate=2026-10-27')));
    app.goLive();assert.equal(app.localHistory,null);assert.equal(app.replay.active,false);
  } finally {app.exitReplay();globalThis.fetch=oldFetch;}
});

test('transport is visible once and time slider is labelled for keyboard users', () => {
  const html=readFileSync(new URL('../public/heatmap-app/index.html',import.meta.url),'utf8');
  const nav=html.slice(html.indexOf('<nav class="history-transport"'),html.indexOf('</nav>',html.indexOf('<nav class="history-transport"')));
  for(const id of ['playPause','timeline','stepBack','stepForward','goLive']) {
    assert.equal(html.split(`id="${id}"`).length-1,1);assert.ok(nav.includes(`id="${id}"`));
  }
  assert.match(nav,/aria-label="Browse the last six hours/);
});

test('archive bodies use an exact signed VPS lease with no paid proxy fallback',async()=>{
  const previous=globalThis.fetch;const seen=[];
  const valid={url:'https://feed.kwantdesk.com/liquidity-history?ticket=fixture',expiresAt:Date.now()+300_000,transport:'direct-vps'};
  let lease=valid;
  globalThis.fetch=async(url,options)=>{seen.push({url,options});return url.startsWith('/api/')?{ok:true,json:async()=>lease}:{ok:true,json:async()=>({manifest:{}})};};
  try {
    await fetchRecordedHistory('/v1/heatmap/replay',new URLSearchParams({throughMs:'123'}));
    assert.equal(new URL(seen[0].url,'https://www.kwantdesk.com').searchParams.get('historyLease'),'1');
    assert.equal(seen[1].url,valid.url);assert.equal(seen[1].options.credentials,'omit');
    for(const bad of [{url:'https://other.example/liquidity-history?ticket=fixture'},{expiresAt:1},{url:valid.url+'&symbol=ES'},{url:'https://user:pass@feed.kwantdesk.com/liquidity-history?ticket=fixture'}]) {
      lease={...valid,...bad};const before=seen.length;
      await assert.rejects(fetchRecordedHistory('/v1/heatmap/replay',new URLSearchParams()));
      assert.equal(seen.length,before+1,'an invalid lease cannot fall back to proxying depth through the site');
    }
  }finally{globalThis.fetch=previous;}
});

test('small pointer movements accumulate at wide time zoom instead of losing every drag',()=>{
  const app=new Harness();seed(app);app.view.columnPixels=8;
  app.drag={mode:'pan',last:{x:0,y:0}};
  for(const x of [2,4,6,8])app.pointerMove({x,y:0});
  assert.equal(app.history[app.viewEnd].timestamp,BASE-2000);
  assert.equal(app.atLive,false);assert.equal(app.playing,false);
});

test('the historical tape excludes prints after the selected paused clock',()=>{
  const body=source.slice(source.indexOf('  #renderTape() {'),source.indexOf('  #positionCurrentPrice(')).replace('#renderTape','renderTape');
  const element={innerHTML:''};
  const Class=new Function('SYMBOLS','timeLabel','priceLabel','$',`return class {${body}}`)(SYMBOLS,String,String,()=>element);
  const app=new Class();app.symbol='NQ';app.localHistory={clockMs:50};
  app.tape=[{timestamp:100,tick:999,size:999,side:'buy'},{timestamp:40,tick:123,size:12,side:'sell'}];
  app.renderTape();assert.ok(element.innerHTML.includes('123'));assert.ok(!element.innerHTML.includes('999'));
});
