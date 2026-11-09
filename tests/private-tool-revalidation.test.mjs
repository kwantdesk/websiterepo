import test from 'node:test';
import assert from 'node:assert/strict';
import {revalidatePrivateTool} from '../src/lib/privateToolRevalidation.ts';
import {createOptionsFlowRequestPool} from '../src/lib/optionsFlowRequests.ts';

test('unchanged private response reuses exact retained body after a header-only revalidation', async () => {
  const previous = {text:'{"value":123}',status:200,headers:[['etag','W/"unchanged"'],['content-type','application/json']]};
  let observed;
  const response = await revalidatePrivateTool(async (url, options) => {
    observed = options; assert.equal(url, '/api/gex-data/net-drift');
    return new Response(null, {status:304,headers:{etag:'W/"unchanged"','cache-control':'private, max-age=15'}});
  }, '/api/gex-data/net-drift', {method:'POST',body:'{"ticker":"SPX"}',credentials:'same-origin'}, previous);
  assert.equal(observed.headers.get('if-none-match'),'W/"unchanged"');
  assert.equal(observed.body,'{"ticker":"SPX"}'); assert.equal(observed.cache,'no-store');
  assert.equal(response.status,200); assert.deepEqual(await response.json(),{value:123});
  assert.equal(response.headers.get('cache-control'),'private, max-age=15');
});

test('new content and auth errors are never replaced by retained data; orphan validators are removed', async () => {
  for (const status of [200,401,403,503]) {
    const response=await revalidatePrivateTool(async(_url,options)=>{
      assert.equal(options.headers.get('if-none-match'),null);
      return Response.json({status},{status});
    },'/api/gex-data/heat-map',{headers:{'If-None-Match':'unowned-validator'}});
    assert.equal(response.status,status); assert.deepEqual(await response.json(),{status});
  }
  await assert.rejects(revalidatePrivateTool(async()=>new Response(null,{status:304}),'/api/gex-data/heat-map',{}));
});

test('identical concurrent consumers share a request while filters and independent account pools remain separate', async () => {
  let calls=0; const fetcher=async()=>{calls++;await new Promise(r=>setImmediate(r));return Response.json({calls},{headers:{etag:'"version"','cache-control':'private, max-age=15'}});};
  const one=createOptionsFlowRequestPool(fetcher),two=createOptionsFlowRequestPool(fetcher);
  const options={method:'POST',body:'{"ticker":"SPX"}'};
  const responses=await Promise.all([one.request('/api/gex-data/net-drift',options),one.request('/api/gex-data/net-drift',options)]);
  assert.equal(calls,1); assert.deepEqual(await responses[0].json(),await responses[1].json());
  await one.request('/api/gex-data/net-drift',{...options,body:'{"ticker":"QQQ"}'});
  await two.request('/api/gex-data/net-drift',options); assert.equal(calls,3);
  one.dispose();two.dispose();
});
