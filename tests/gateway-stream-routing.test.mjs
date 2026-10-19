import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchInstitutionalMarketData} from '../src/lib/institutionalMarketData.server.ts';

test('actual gateway adapter separates stream delivery from the remembered bulk origin',async()=>{
  const originalFetch=globalThis.fetch;
  const settings={
    KWANTDESK_MARKET_DATA_GATEWAY_URL:'https://bulk-fixture.example',
    KWANTDESK_MARKET_DATA_STREAM_GATEWAY_URL:'https://stream-fixture.example',
    KWANTDESK_MARKET_DATA_GATEWAY_TOKEN:'server-only-fixture',
  };
  const before=Object.fromEntries(Object.keys(settings).map(key=>[key,process.env[key]]));
  Object.assign(process.env,settings);
  const calls=[];
  globalThis.fetch=async (input,init)=>{
    const url=new URL(String(input));calls.push(url);
    assert.equal(init.headers.Authorization,'Bearer server-only-fixture');
    assert.equal(init.cache,'no-store');
    assert.ok(init.signal);
    return Response.json(url.pathname==='/health'?{connected:true,authenticated:true}:{ok:true});
  };
  try{
    await fetchInstitutionalMarketData('/v1/market-data/history?symbol=NQ');
    assert.equal(calls.at(-1).origin,settings.KWANTDESK_MARKET_DATA_GATEWAY_URL);
    for(const path of ['/v1/market-data/trades?symbol=NQ','/v1/market-data/index-stream?symbols=SPY','/v1/heatmap/stream?symbol=NQ']){
      await fetchInstitutionalMarketData(path,{},295000);
      assert.equal(calls.at(-1).origin,settings.KWANTDESK_MARKET_DATA_STREAM_GATEWAY_URL);
    }
    await fetchInstitutionalMarketData('/v1/market-data/snapshot');
    assert.equal(calls.at(-1).origin,settings.KWANTDESK_MARKET_DATA_GATEWAY_URL,
      'remembering the stream origin cannot move bulk reads onto it');
  }finally{
    globalThis.fetch=originalFetch;
    for(const key of Object.keys(settings)){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}
  }
});

test('quote endpoint and generic stream proxy use the same server-only selection',()=>{
  const quotes=readFileSync(new URL('../src/app/api/databento/live/route.ts',import.meta.url),'utf8');
  assert.match(quotes,/marketDataGatewayUrlCandidatesForPath\("\/v1\/market-data\/quotes"\)/);
  assert.match(quotes,/Authorization: `Bearer \$\{token\}`/);
  assert.match(quotes,/new Response\(upstream.body/);
  assert.doesNotMatch(quotes,/setInterval|setTimeout|\.json\(\)/);
  const generic=readFileSync(new URL('../src/app/api/institutional-market-data/[...path]/route.ts',import.meta.url),'utf8');
  assert.match(generic,/isLongLivedStream[\s\S]*?295_000/);
  assert.match(generic,/if \(isLongLivedStream\)[\s\S]*?new Response\(upstream.body/);
});
