import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createHmac} from 'node:crypto';
import {signBrowserStreamTicket} from '../src/lib/browserStreamTicket.ts';
import {verifyBrowserStreamTicket,createBrowserStreamServer} from '../services/rithmic_gateway/src/browser-stream-edge.mjs';

const key='private-test-key-not-a-production-key',origin='https://www.kwantdesk.com',now=1792537200000;
const make=(extra={})=>signBrowserStreamTicket({key,origin,path:'/v1/market-data/quotes',search:'?symbols=NQZ6,ESZ6&priority=NQZ6',now,...extra});
test('web signer and standalone VPS verifier share exact scope and five-minute expiry',()=>{
 const ticket=make();const payload=verifyBrowserStreamTicket(ticket,key,origin,now);
 assert.equal(payload.path,'/v1/market-data/quotes');assert.equal(payload.exp-payload.iat,300);
 assert(!ticket.includes(key));assert.equal(verifyBrowserStreamTicket(ticket,key,origin,now+299000).origin,origin);
});
test('reject expired, future, altered, wrong-origin and wrong-key leases',()=>{
 const ticket=make();
 for(const [value,secret,site,clock] of [[ticket,key,origin,now+300000],[ticket,key,origin,now-11000],
  [ticket+'a',key,origin,now],[ticket,'bad',origin,now],[ticket,key,'null',now],
  [ticket,key,'https://attacker.example',now],[ticket,key,'https://kwantdesk.com',now]]){
  assert.throws(()=>verifyBrowserStreamTicket(value,secret,site,clock));
 }
});
test('signer and verifier cannot grant arbitrary REST, trading or cross-origin access',()=>{
 for(const path of ['/health','/v1/lab/snapshot','/v1/socials/state','/v1/orders','//attacker/'])assert.throws(()=>make({path}));
 assert.throws(()=>make({origin:'https://attacker.example'}));assert.throws(()=>make({search:'x'.repeat(5000)}));
 const p=Buffer.from(JSON.stringify({v:1,aud:'kwantdesk-browser-stream',origin,path:'/v1/orders',search:'',iat:now/1000,exp:now/1000+300,nonce:'aaaaaaaaaaaaaaaa'})).toString('base64url');
 const s=createHmac('sha256',key).update('kwantdesk-browser-stream-v1\n'+p).digest('base64url');
 assert.throws(()=>verifyBrowserStreamTicket(p+'.'+s,key,origin,now));
});
test('all four existing stream contracts are permitted without changing query bytes',()=>{
 for(const path of ['/v1/market-data/quotes','/v1/market-data/trades','/v1/market-data/index-stream','/v1/heatmap/stream']){
  const ticket=make({path,search:'?symbol=NQZ6&exchange=CME&seedLimit=1'});
  assert.equal(verifyBrowserStreamTicket(ticket,key,origin,now).search,'?symbol=NQZ6&exchange=CME&seedLimit=1');
 }
});
test('HTTP edge relays SSE bytes directly, keeps bearer internal, denies scope bypass and releases sockets',async t=>{
 let seen;const upstream=http.createServer((req,res)=>{seen={url:req.url,authorization:req.headers.authorization};res.writeHead(200,{'Content-Type':'text/event-stream'});res.end('event: trades\ndata: {"actual":true}\n\n');});
 upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const edge=createBrowserStreamServer({key,now:()=>now,upstream:'http://127.0.0.1:'+upstream.address().port});
 edge.listen(0,'127.0.0.1');await once(edge,'listening');
 t.after(()=>{edge.closeAllConnections();edge.close();upstream.closeAllConnections();upstream.close();});
 const base='http://127.0.0.1:'+edge.address().port;
 const response=await fetch(base+'/browser-stream?ticket='+make(),{headers:{Origin:origin}});
 assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),origin);
 assert.equal(response.headers.get('access-control-allow-credentials'),null);
 assert.equal(await response.text(),'event: trades\ndata: {"actual":true}\n\n');
 assert.equal(seen.authorization,'Bearer '+key);assert(!seen.url.includes('ticket'));
 for(const [suffix,headers] of [['?ticket='+make()+'&symbol=ESZ6',{Origin:origin}],['?ticket='+make(),{}],['?ticket='+make(),{Origin:'https://attacker.example'}],['?ticket='+make()+'&ticket='+make(),{Origin:origin}]]){
  assert.equal((await fetch(base+'/browser-stream'+suffix,{headers})).status,401);
 }
 assert.equal((await fetch(base+'/v1/market-data/quotes',{headers:{Origin:origin}})).status,404);
 assert.equal((await (await fetch(base+'/health')).json()).active,0);
});
test('expiry closes a live upstream and releases capacity; excess sockets fail closed',async t=>{
 const upstream=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/event-stream'});res.write('data: actual\n\n');});
 upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const edge=createBrowserStreamServer({key,now:()=>now+299000,maxStreams:1,upstream:'http://127.0.0.1:'+upstream.address().port});
 edge.listen(0,'127.0.0.1');await once(edge,'listening');
 t.after(()=>{edge.closeAllConnections();edge.close();upstream.closeAllConnections();upstream.close();});
 const base='http://127.0.0.1:'+edge.address().port,url=base+'/browser-stream?ticket='+make();
 const response=await fetch(url,{headers:{Origin:origin}});
 assert.equal(response.status,200);
 assert.equal((await fetch(url,{headers:{Origin:origin}})).status,503);
 assert.equal(await response.text(),'data: actual\n\n');
 assert.equal((await (await fetch(base+'/health')).json()).active,0);
});

test('exact signed replay reads stream JSON directly from the VPS without disclosing credentials',async t=>{
 const seen=[];
 const upstream=http.createServer((req,res)=>{
  seen.push({url:req.url,auth:req.headers.authorization,accept:req.headers.accept});
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({frames:[{actual:true}]}));
 });
 upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const edge=createBrowserStreamServer({key,now:()=>now,upstream:'http://127.0.0.1:'+upstream.address().port});
 edge.listen(0,'127.0.0.1');await once(edge,'listening');
 t.after(()=>{edge.closeAllConnections();edge.close();upstream.closeAllConnections();upstream.close();});
 for(const path of ['/v1/heatmap/replay','/v1/heatmap/replay/chunk']){
  const search='?symbol=NQ&tradingDate=2026-10-23&chunk=1792764000000';
  const ticket=make({path,search});
  const response=await fetch('http://127.0.0.1:'+edge.address().port+'/browser-stream?ticket='+ticket,{headers:{Origin:origin}});
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/json/);
  assert.equal(response.headers.get('x-kwantdesk-market-transport'),'direct-vps');
  assert.deepEqual(await response.json(),{frames:[{actual:true}]});
  assert.deepEqual(seen.at(-1),{url:path+search,auth:'Bearer '+key,accept:'application/json'});
 }
});
