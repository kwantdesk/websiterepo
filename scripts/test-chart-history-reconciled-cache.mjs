import test from 'node:test';import assert from 'node:assert/strict';
const at=Date.now()-600000;
const old={key:'time-v6::6M.v.0::1m',symbol:'6M.v.0',timeframe:'1m',updatedAt:Date.now(),candles:[{timestamp:at,open:999,high:999,low:999,close:999,volume:1}]};
const current={key:'time-v8::NQ.v.0::1m',symbol:'NQ.v.0',timeframe:'1m',updatedAt:Date.now(),candles:[{timestamp:at,open:100,high:103,low:99,close:102,volume:4}]};
const rows=new Map([[old.key,old],[current.key,current]]);
rows.set('event-v7::6M.v.0::40r',{...old,key:'event-v7::6M.v.0::40r',timeframe:'40r'});
for(const key of ['tape-v3::6M.v.0','tape-v2::6M.v.0::1m'])rows.set(key,{key,symbol:'6M.v.0',kind:'execution-tape',records:[{timestamp:at,price:999,size:1}]});
function reply(result){const request={result};queueMicrotask(()=>request.onsuccess?.());return request}
const database={transaction(){return{objectStore(){return{get:key=>reply(rows.get(key)),getAllKeys:()=>reply([...rows.keys()])}}}}};
globalThis.window={indexedDB:{open:()=>reply(database)}};
const cache=await import('../src/lib/chartHistoryCache.ts');
test('repaired candle caches reject legacy partial captures while keeping current warm and resampled history',async()=>{
 assert.equal(await cache.readChartHistoryCache('6M.v.0','1m'),null);
 assert.equal(await cache.readChartHistoryCache('6M.v.0','40r'),null);
 assert.equal(await cache.readExecutionTapeCache('6M.v.0','1m'),null);
 assert.equal(await cache.readCompatibleChartHistoryCache('6M.v.0','5m'),null);
 assert.equal((await cache.readChartHistoryCache('NQ.v.0','1m')).candles[0].close,102);
 const derived=await cache.readCompatibleChartHistoryCache('NQ.v.0','5m');assert.equal(derived.candles[0].close,102);assert.equal(derived.key,'time-v8::NQ.v.0::5m');
});

test("fresh monthly caches retain candles whose calendar open predates the cache lifetime",async()=>{const stamp=Date.now()-40*86400000,key="time-v8::NQ.v.0::1M";rows.set(key,{...current,key,timeframe:"1M",candles:[{...current.candles[0],timestamp:stamp}]});assert.equal((await cache.readChartHistoryCache("NQ.v.0","1M")).candles[0].timestamp,stamp)});
test("dense saved history exceeds the former 120,000-bar cutoff",async()=>{const key="time-v8::ES.v.0::1s",candles=Array.from({length:120001},(_,i)=>({...current.candles[0],timestamp:at-120000000+i*1000}));rows.set(key,{...current,key,symbol:"ES.v.0",timeframe:"1s",candles});assert.equal((await cache.readChartHistoryCache("ES.v.0","1s")).candles.length,120001)});

test("an intraday cache cannot masquerade as complete calendar history",async()=>{assert.equal(await cache.readCompatibleChartHistoryCache("ES.v.0","1M"),null)});
