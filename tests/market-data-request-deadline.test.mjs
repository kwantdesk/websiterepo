import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {fetchWithDeadline,fetchJsonWithBudget} from '../src/lib/marketDataRequest.ts';
async function withServer(handler,run){
  const server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{await run(`http://127.0.0.1:${server.address().port}`)}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
test('timeout remains active after headers while JSON body is stalled',async()=>{
  await withServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.flushHeaders();},async url=>{
    const response=await fetchWithDeadline(url,{},250);
    assert.equal(response.status,200);
    await assert.rejects(response.json(),error=>['AbortError','TimeoutError'].includes(error.name));
  });
});
test('workspace JSON body and retry share one budget, not two full timeouts',async()=>{
  let calls=0;
  await withServer((req,res)=>{calls++;if(calls===1){res.writeHead(503);res.end('{}');}else{res.writeHead(200,{'Content-Type':'application/json'});res.flushHeaders();}},async url=>{
    const start=Date.now();
    await assert.rejects(fetchJsonWithBudget(url,600));
    assert.equal(calls,2);assert.ok(Date.now()-start<1100);
  });
});
test('caller cancellation is preserved and successful JSON is returned unchanged',async()=>{
  await withServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end('{"levels":[1,2]}');},async url=>{
    const result=await fetchJsonWithBudget(url,1000);assert.deepEqual(result.payload,{levels:[1,2]});
    const owner=new AbortController();owner.abort();
    await assert.rejects(fetchWithDeadline(url,{signal:owner.signal},1000));
  });
});

test('browser requests revalidate every refresh; forced refresh reloads and server requests remain uncached',async()=>{
  const originalFetch=globalThis.fetch;
  const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  const modes=[];
  globalThis.fetch=async (_url,init)=>{
    modes.push(init.cache);
    return new Response('{"levels":[1]}', {headers:{'Content-Type':'application/json'}});
  };
  try{
    Object.defineProperty(globalThis,'window',{value:{},configurable:true});
    await fetchJsonWithBudget('/api/bounce-levels',1000);
    await fetchJsonWithBudget('/api/bounce-levels',1000,true);
    delete globalThis.window;
    await fetchJsonWithBudget('https://example.test/data',1000);
    assert.deepEqual(modes,['no-cache','reload','no-store']);
  }finally{
    globalThis.fetch=originalFetch;
    if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);
    else delete globalThis.window;
  }
});
