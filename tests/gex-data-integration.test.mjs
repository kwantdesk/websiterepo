import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {themeRole} from '../public/gex-data-app/site-theme.js';
const require=createRequire(import.meta.url),read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const policy={};vm.runInNewContext(compile(read('../src/lib/gexDataPolicy.ts')),{exports:policy,Intl,Date,structuredClone,Set,Number,Error,Object,Array});

test('calendar uses real NY dates, holidays, early close and distinct equity/options windows',()=>{
  const {gexDataClock:clock}=policy;
  assert.equal(clock(new Date('2026-10-18T16:00:00Z')).sessionDate,'2026-10-16');
  assert.equal(clock(new Date('2026-11-26T17:00:00Z')).open,false);
  assert.equal(clock(new Date('2026-11-27T18:16:00Z')).optionsOpen,false);
  assert.equal(clock(new Date('2026-10-19T12:00:00Z')).equitiesOpen,true);
  assert.equal(clock(new Date('2026-10-19T12:00:00Z')).optionsOpen,false);
  assert.equal(clock(new Date('2026-10-19T12:00:00Z')).optionsSessionDate,'2026-10-16');
  assert.equal(clock(new Date('2027-01-18T17:00:00Z')).open,false);
  assert.equal(clock(new Date('2028-12-29T17:00:00Z')).open,true);
  assert.equal(clock(new Date('2029-01-02T17:00:00Z')).calendarVerified,false);
});
test('exact 20 connected endpoints preserve native request units and filter expressions',()=>{
  assert.equal(Object.keys(policy.GEX_DATA_TOOLS).length,20);
  const input={sessionDate:'2026-10-16',aggregationPeriod:'5m',filter:{ticker:'QQQ',strikePrices:[100.25]},filterExpression:{conjunction:'AND',filters:[]}};
  const output=policy.validateGexDataRequest('exposure-by-strike',input);assert.equal(JSON.stringify(output),JSON.stringify(input));assert.notEqual(output,input);
  for(const [tool,body]of [['made-up',{}],['net-drift',{sessionDate:'2026-02-30'}],['net-drift',{size:101}],['interval-map',{aggregationPeriod:'4s'}],['iv-rank',{sessionDate:'2026-10-08'}],['equity-prints',{timeRange:{startTime:'bad',endTime:'bad'}}],['net-drift',{filter:{ticker:'bad?token=private'}}]])assert.throws(()=>policy.validateGexDataRequest(tool,body));
});
function server({signedIn=true,fail=false,production=false,localDev=false}={}){
  const calls=[],exports={};
  const context={exports,Date,Map,Promise,Response,JSON,Number,Object,Error,process:{env:production?{VERCEL:'1'}:{}},require:name=>{
    if(name==='node:crypto')return require(name);
    if(name==='next/server')return{NextResponse:{json:(body,options)=>new Response(JSON.stringify(body),{status:options?.status??200,headers:options?.headers})}};
    if(name.includes('serverAuth'))return{getRouteActor:async()=>signedIn?{userId:'owner',mode:localDev?'local-dev':'supabase'}:null};
    if(name.includes('gexDataPolicy'))return policy;
    if(name.includes('vendorMarketData'))return{vendorMarketDataFetch:async(provider,path,options)=>{calls.push({provider,path,body:JSON.parse(options.body)});return new Response(JSON.stringify(fail?{error:'private upstream internals'}:{data:{actual:true}}),{status:fail?429:200});}};
    if(name.includes('institutionalMarketData'))return{fetchInstitutionalMarketData:async()=>new Response('{}')};
    if(name.includes('conditionalJson'))return{conditionalJson:(_,body,options)=>new Response(JSON.stringify(body),{headers:{'Cache-Control':`private, max-age=${Math.floor(options.maxAgeMs/1000)}`}})};
    throw Error(name);
  }};
  vm.runInNewContext(compile(read('../src/app/api/gex-data/[tool]/route.ts')),context);
  return{calls,get:tool=>exports.GET(new Request('https://example.test/api/gex-data/'+tool),{params:Promise.resolve({tool})}),post:(tool,body)=>exports.POST(new Request('https://example.test/api/gex-data/'+tool,{method:'POST',body:JSON.stringify(body)}),{params:Promise.resolve({tool})})};
}
test('actual route is authenticated, allow-listed, gateway-only and coalesces identical panels',async()=>{
  const h=server();const responses=await Promise.all(Array.from({length:5},()=>h.post('interval-map',{sessionDate:'2026-10-16',filter:{ticker:'NDX'}})));
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].provider,'quantdata');assert.equal(h.calls[0].path,'/v1/options/tool/interval-map');
  const body=await responses[0].json();assert.equal(body.data.actual,true);assert.equal(body._gexData.liveVerified,false);assert.equal(body._gexData.requestedSessionDate,'2026-10-16');
  assert.match(responses[0].headers.get('Cache-Control'),/^private,/);
  assert.equal((await server({signedIn:false}).post('interval-map',{})).status,401);
  assert.equal((await h.post('not-allowed',{})).status,400);
  assert.equal((await h.get('status')).status,200);
  assert.equal((await server({signedIn:false}).get('status')).status,401);
  assert.equal((await server({production:true,localDev:true}).get('status')).status,401);
  assert.equal((await server({production:true,localDev:true}).post('interval-map',{})).status,401);
  assert.throws(()=>policy.validateGexDataRequest('dark-pool-levels',{sessionDateRange:{startDate:'2026-10-16',endDate:'2026-10-01'}}));
});
test('provider refusal stays an error, never fabricated output or exposed provider details',async()=>{
  const h=server({fail:true});const response=await h.post('net-drift',{filter:{ticker:'QQQ'}});assert.equal(response.status,429);assert.equal(h.calls.length,1);assert.doesNotMatch(await response.text(),/private upstream/);
});
test('navigation, account preferences and host lifecycle are integrated without changing GEX BOX',()=>{
  const nav=read('../src/components/AppSidebar.tsx');assert.match(nav,/key: "gamvue"[^\n]+\n\s*\{ key: "gexdata"[^\n]+\n\s*\{ key: "gexbot"/);
  assert.match(read('../src/app/(workspace)/layout.tsx'),/"\/gex-data": "gexdata"/);
  assert.match(read('../src/lib/userPreferences.ts'),/kwantdesk:gex-data:workspace:v1/);
  const host=read('../src/components/gex-data/GexDataWorkspace.tsx');
  for(const rule of [/saved\?\.accountKey === accountKey/,/pending\.size >= 32/,/running >= 4/,/cache\.size > 48/,/24_000_000/,/controllers\.forEach/,/observer\.disconnect/,/!activeRef\.current/])assert.match(host,rule);
});
test('theme colours and font replace the prototype skin in both CSS and canvas',()=>{
  assert.equal(themeRole('#00FF00'),'bullish');assert.equal(themeRole('#FF0000'),'bearish');assert.equal(themeRole('#FFFFFF'),'foreground');
  assert.equal(themeRole('#07000f'),'background');
  const app=read('../public/gex-data-app/app.js');assert.doesNotMatch(app,/Inter,|\/api\/quantdata\//);assert.match(app,/themePaint\(/);
  assert.match(read('../public/gex-data-app/site.css'),/Aleph-Regular\.ttf/);
  assert.match(read('../public/gex-data-app/site-theme.js'),/installTheme/);
  for(const name of readdirSync(new URL('../public/gex-data-app/',import.meta.url)))assert.doesNotMatch(name,/woff|provider\.env|server\.mjs/);
});
test('latest overview, saved templates and real import/export replace fixed snapshot defaults',()=>{
  const source=read('../public/gex-data-app/workspace-ui.js');assert.match(source,/mode:'latest',date:'',expiry:''/);assert.doesNotMatch(source,/2026-10-08/);
  for(const label of ['Save workspace as…','Export workspace','Import workspace…','kwantdesk-gex-data'])assert.ok(source.includes(label));
  assert.match(source,/input\.type='file'/);assert.match(source,/URL\.createObjectURL/);assert.match(source,/gexStorage\.restore/);
  const app=read('../public/gex-data-app/app.js');assert.match(app,/if\(pollTimer!==null\)return/);assert.match(app,/remembered\.length<=items\.length/);assert.match(app,/closingReconcileAt/);assert.match(app,/gatewayFetchedAt/);assert.match(app,/clearInterval\(statusTimer\)/);assert.match(app,/get\('snapshot'\)/);
});
