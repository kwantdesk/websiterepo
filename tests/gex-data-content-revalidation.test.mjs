import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {conditionalJson} from '../src/lib/conditionalJson.ts';

test('actual GEX route returns 304 across cache expiry only for unchanged exact provider content', async () => {
  let time=Date.now(), value=123, reads=0, authenticated=true;
  class Clock extends Date {constructor(input=time){super(input);} static now(){return time;}}
  const exports={};
  const code=ts.transpileModule(fs.readFileSync('src/app/api/gex-data/[tool]/route.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code,{exports,Date:Clock,Response,process:{env:{}},require:name=>{
    if(name==='node:crypto')return {createHash};
    if(name==='next/server')return {NextResponse:Response};
    if(name.includes('serverAuth'))return {getRouteActor:async()=>authenticated?{mode:'supabase',id:'fixture'}:null};
    if(name.includes('vendorMarketData'))return {vendorMarketDataFetch:async()=>{reads++;return Response.json({value});}};
    if(name.includes('conditionalJson'))return {conditionalJson};
    if(name.includes('gexDataPolicy'))return {GEX_DATA_TOOLS:{'heat-map':{surface:'options'}},gexDataClock:()=>({date:'2026-11-09'}),validateGexDataRequest:(_tool,body)=>body};
    return {};
  }});
  const request=etag=>new Request('https://www.kwantdesk.com/api/gex-data/heat-map',{method:'POST',body:'{"filter":{"ticker":"SPX"}}',headers:{'Content-Type':'application/json',...(etag?{'If-None-Match':etag}:{})}});
  const context={params:Promise.resolve({tool:'heat-map'})};
  const first=await exports.POST(request(),context);assert.equal(first.status,200);const tag=first.headers.get('etag');
  time+=16000;const unchanged=await exports.POST(request(tag),context);
  assert.equal(reads,2,'freshness still contacts upstream after TTL');assert.equal(unchanged.status,304);assert.equal(await unchanged.text(),'');
  time+=16000;value=124;const changed=await exports.POST(request(tag),context);
  assert.equal(changed.status,200);assert.equal((await changed.json()).value,124);assert.notEqual(changed.headers.get('etag'),tag);
  authenticated=false;const denied=await exports.POST(request(tag),context);assert.equal(denied.status,401);assert.equal(reads,3,'no data call after failed identity');
});
