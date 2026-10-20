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

test('HTML holding pages and unavailable responses fail over instead of becoming the remembered good origin',async()=>{
  const originalFetch=globalThis.fetch;
  const keys=['KWANTDESK_MARKET_DATA_GATEWAY_URL','KWANTIFY_MARKET_DATA_GATEWAY_URL','KWANTDESK_MARKET_DATA_GATEWAY_TOKEN'];
  const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try{
    for(const status of [200,502,503,504]){
      const bad=`https://bad-${status}-fixture.example`,good=`https://good-${status}-fixture.example`;
      Object.assign(process.env,{KWANTDESK_MARKET_DATA_GATEWAY_URL:bad,KWANTIFY_MARKET_DATA_GATEWAY_URL:good,KWANTDESK_MARKET_DATA_GATEWAY_TOKEN:'fixture-only'});
      const requests=[];
      globalThis.fetch=async input=>{
        const url=new URL(String(input));
        if(url.pathname==='/health')return Response.json({connected:true,authenticated:true});
        requests.push(url.origin);
        return url.origin===bad
          ?new Response(status===200?'<!DOCTYPE html><title>holding page</title>':'{"error":"unavailable"}',{status,headers:{'Content-Type':status===200?'text/html':'application/json'}})
          :Response.json({candles:[{timestamp:1000,close:100}]});
      };
      assert.deepEqual(await(await fetchInstitutionalMarketData('/v1/market-data/history?symbol=NQ')).json(),{candles:[{timestamp:1000,close:100}]});
      await fetchInstitutionalMarketData('/v1/market-data/history?symbol=NQ');
      assert.deepEqual(requests,[bad,good,good]);
    }
  }finally{
    globalThis.fetch=originalFetch;
    for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}
  }
});
