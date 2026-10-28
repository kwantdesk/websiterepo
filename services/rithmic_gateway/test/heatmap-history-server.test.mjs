import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { createHeatmapHistoryHandler } from '../src/heatmap-history-server.mjs';

async function fixture(run) {
  const calls=[];
  const manifest={lastFrameMs:10_000,frameMs:2000,builtAt:'2026-10-28T00:00:00Z',chunks:[]};
  let pending=null;
  const store={readManifest:async()=>manifest,sourceChanged:()=>true,buildStatus:()=>pending,
    manifestOrBuild:async(...args)=>{calls.push(args);pending={building:true,frames:3};return pending;},
    readChunk:async(...args)=>({args,frames:[]}),};
  const server=createServer(createHeatmapHistoryHandler({store,token:'fixture-only',resolveTickSize:async()=>{},now:()=>30_000}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const request=(query='',headers={Authorization:'Bearer fixture-only'})=>fetch(`${origin}/v1/heatmap/replay${query}`,{headers});
  try {await run({request,calls,requestUrl:(path,headers)=>fetch(origin+path,{headers})});}finally{await new Promise(resolve=>server.close(resolve));}
}

test('old covered windows reuse their pack, later recorded clocks trigger a single isolated refresh',async()=>{
  await fixture(async({request,calls})=>{
    let response=await request('?symbol=NQ&tradingDate=2026-10-27&throughMs=9000');
    assert.equal((await response.json()).manifest.lastFrameMs,10_000);assert.equal(calls.length,0);
    response=await request('?symbol=NQ&tradingDate=2026-10-27&throughMs=29000');
    assert.equal((await response.json()).building,true);assert.equal(calls.length,1);
    assert.deepEqual(calls[0].at(-1),{refresh:true});
    await request('?symbol=NQ&tradingDate=2026-10-27&throughMs=28000');
    assert.equal(calls.length,1,'clock movements cannot spawn duplicate archive walks');
  });
});

test('history is authenticated and rejects unsafe paths and generation strings',async()=>{
  await fixture(async({request,calls})=>{
    assert.equal((await request('?symbol=NQ&tradingDate=2026-10-27',{})).status,401);
    assert.equal((await request('?symbol=../NQ&tradingDate=2026-10-27')).status,400);
    assert.equal((await request('/chunk?symbol=NQ&tradingDate=2026-10-27&chunk=5&generation=../bad')).status,400);
    const res=await request('/chunk?symbol=NQ&tradingDate=2026-10-27&chunk=5&generation=123-abcdef');
    assert.equal(res.status,200);
    assert.deepEqual((await res.json()).args,['2026-10-27','CME','NQ',5,'123-abcdef']);
    assert.equal(calls.length,0);
  });
});

test('direct history leases bind the exact request to the real website origin and expire',async()=>{
  await fixture(async({requestUrl})=>{
    const origin='https://www.kwantdesk.com';
    const lease=(changes={})=>{
      const payload=Buffer.from(JSON.stringify({v:1,aud:'kwantdesk-browser-stream',origin,
        path:'/v1/heatmap/replay',search:'?symbol=NQ&tradingDate=2026-10-27&throughMs=9000',
        iat:30,exp:330,nonce:'1234567890abcdef',...changes})).toString('base64url');
      return payload+'.'+createHmac('sha256','fixture-only').update('kwantdesk-browser-stream-v1\n'+payload).digest('base64url');
    };
    const get=(ticket,originHeader=origin)=>requestUrl(`/liquidity-history?ticket=${ticket}`,{Origin:originHeader});
    const good=await get(lease());assert.equal(good.status,200);
    assert.equal(good.headers.get('access-control-allow-origin'),origin);
    assert.equal((await good.json()).manifest.lastFrameMs,10_000);
    for(const [ticket,site] of [[lease(),'null'],[lease({exp:29}),origin],[lease({path:'/v1/market-data/trades'}),origin],[lease()+'x',origin]]) {
      const res=await get(ticket,site);assert.equal(res.status,401);assert.equal(res.headers.get('access-control-allow-origin'),null);
    }
  });
});
