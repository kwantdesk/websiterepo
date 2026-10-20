import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {fetchWithDeadline,fetchJsonWithBudget,MarketDataResponseError} from '../src/lib/marketDataRequest.ts';
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

test('a transient HTML holding page is retried once and real chart data survives unchanged', async()=>{
  let calls=0;
  const candles=[{timestamp:1000,open:100,high:102,low:99,close:101}];
  await withServer((_req,res)=>{
    calls++;
    res.setHeader('Content-Type',calls===1?'text/html':'application/json');
    res.end(calls===1?'<!DOCTYPE html><title>relay unavailable</title>':JSON.stringify({candles}));
  },async url=>{
    const result=await fetchJsonWithBudget(url,1500);
    assert.equal(calls,2);assert.deepEqual(result.payload,{candles});
  });
});

test('persistent HTML never leaks markup/parser errors and retries are capped',async()=>{
  let calls=0;
  await withServer((_req,res)=>{calls++;res.setHeader('Content-Type','text/html');res.end('<!DOCTYPE html>private provider details');},async url=>{
    await assert.rejects(fetchJsonWithBudget(url,1500),error=>{
      assert.ok(error instanceof MarketDataResponseError);
      assert.doesNotMatch(error.message,/DOCTYPE|Unexpected token|private provider/i);
      return true;
    });
    assert.equal(calls,2);
  });
});

test('malformed or empty JSON receives the same bounded recovery',async()=>{
  for(const bad of ['<!DOCTYPE html>', '{broken', '', 'null']){
    let calls=0;
    await withServer((_req,res)=>{calls++;res.setHeader('Content-Type','application/json');res.end(calls===1?bad:'{"candles":[]}');},async url=>{
      assert.deepEqual((await fetchJsonWithBudget(url,1500)).payload,{candles:[]});assert.equal(calls,2);
    });
  }
});

test('HTML authentication failures and mutating requests are not retried',async()=>{
  for(const status of [401,403]){
    let calls=0;
    await withServer((_req,res)=>{calls++;res.writeHead(status,{'Content-Type':'text/html'});res.end('<html>sign in</html>');},async url=>{
      await assert.rejects(fetchJsonWithBudget(url,1500),/Sign in again/);assert.equal(calls,1);
    });
  }
  let calls=0;
  await withServer((_req,res)=>{calls++;res.setHeader('Content-Type','text/html');res.end('<html>error</html>');},async url=>{
    await assert.rejects(fetchJsonWithBudget(url,1500,false,{method:'POST'}));assert.equal(calls,1);
  });
});

test('caller abort also cancels bounded chart JSON retries',async()=>{
  let calls=0;
  await withServer((_req,res)=>{calls++;res.setHeader('Content-Type','text/html');res.end('<html>retry</html>');},async url=>{
    const controller=new AbortController();
    const pending=fetchJsonWithBudget(url,1500,false,{signal:controller.signal});
    setTimeout(()=>controller.abort(),100);
    await assert.rejects(pending,error=>error.name==='AbortError');assert.equal(calls,1);
  });
});
