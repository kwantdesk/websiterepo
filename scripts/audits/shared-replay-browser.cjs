const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const webpack=require('next/dist/compiled/webpack/webpack').webpack;
const {chromium}=require(path.resolve('tmp/chart-lock-browser/node_modules/playwright-core'));
const root=process.cwd(),output=path.join(root,'tmp/shared-replay-bundle'),stub=path.join(root,'scripts/audits/phone-fixture-next.tsx');
const config={mode:'development',devtool:false,entry:path.join(root,'scripts/audits/shared-replay-fixture.tsx'),output:{path:output,filename:'main.js',publicPath:'/'},resolve:{extensions:['.tsx','.ts','.js'],alias:{'next/navigation$':stub,'next/link$':stub,'next/dynamic$':path.join(root,'scripts/audits/phone-fixture-dynamic.tsx'),'@/lib/userPreferences$':path.join(root,'scripts/audits/phone-fixture-prefs.ts'),'@/lib/supabase$':path.join(root,'scripts/audits/phone-fixture-auth.ts'),'@':path.join(root,'src')}},module:{rules:[{test:/\.(tsx?|css)$/,exclude:/node_modules/,use:path.join(root,'scripts/audits/phone-fixture-loader.cjs')}]},optimization:{minimize:false},plugins:[new webpack.optimize.LimitChunkCountPlugin({maxChunks:1}),new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('development')})]};
(async()=>{
 await new Promise((resolve,reject)=>{const c=webpack(config);c.run((e,s)=>c.close(()=>e||s.hasErrors()?reject(e||s.toString({all:false,errors:true})):resolve()));});
 const css=fs.readdirSync('../kwantdesk-position-viewport-release/.next/static/css').filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync('../kwantdesk-position-viewport-release/.next/static/css/'+f)).join('\n');
 const server=http.createServer((q,r)=>{r.setHeader('Content-Type',q.url==='/main.js'?'text/javascript':q.url==='/style.css'?'text/css':'text/html');r.end(q.url==='/main.js'?fs.readFileSync(path.join(output,'main.js')):q.url==='/style.css'?css:'<html><head><link rel="stylesheet" href="/style.css"><style>:root{--background:#080808;--foreground:#eee;--primary:#ef3892;--on-primary:#fff;--muted:#aaa;--border:#333;--panel:#080808;--surface:#181818;--chart-background:#000}body{margin:0}output{display:none}</style></head><body class="kwant-cockpit-ui"><div id="root"></div><script src="/main.js"></script></body></html>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port, browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),errors=[],requests=[],observations=[];
 try{
  const page=await browser.newPage({viewport:{width:1700,height:750}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());if(!u.href.startsWith(origin))return route.abort();
   if(!u.pathname.startsWith('/api/'))return route.continue();requests.push(u.pathname+u.search);
   const payload=await page.evaluate(()=>window.sharedPayload);
   if(u.pathname==='/api/gex-map')return route.fulfill({json:{...payload,symbol:u.searchParams.get('symbol')}});
   if(u.pathname==='/api/cme-history')return route.fulfill({json:{candles:payload.candles.map(c=>({...c,open:c.open*40}))}});
   return route.fulfill({status:503,json:{error:'No live resources in isolated replay audit'}});
  });
  await page.goto(origin);await page.waitForFunction(()=>JSON.parse(document.querySelector('output').textContent).bounce!==null);await page.locator('[data-gex-strike-node]').first().waitFor();
  const read=async()=>JSON.parse(await page.locator('output').textContent());
  const nodeText=()=>page.locator('[data-gex-strike-node]').allTextContents();
  const initial=await read(),initialNodes=await nodeText();assert.equal(initial.tapeCount,62);
  assert.ok(initial.bounce.times.every(t=>t<=initial.clock));
  const set=async(offset,zone='Australia/Brisbane',future=false)=>{await page.evaluate(s=>window.setSharedReplay(s),{offset,zone,future});await page.waitForTimeout(650);const next=await read();assert.equal(next.clock,initial.clock-1220000+offset);if(!future)assert.ok(next.bounce.times.every(t=>t<=next.clock));observations.push({offset,zone,tapeCount:next.tapeCount,bounceTime:next.bounce?.time});return next;};
  const forward=await set(1305000);assert.equal(forward.tapeCount,66);assert.notDeepEqual(await nodeText(),initialNodes,'Map changes at the same known frame as Bounce');assert.notDeepEqual(forward.bounce.levels,initial.bounce.levels);
  await page.screenshot({path:'tmp/shared-replay-forward.png'});
  const rewind=await set(1220000);assert.equal(rewind.tapeCount,initial.tapeCount);assert.deepEqual(rewind.bounce,initial.bounce);assert.deepEqual(await nodeText(),initialNodes,'Map rewinds to original exposure');
  for(const zone of ['UTC','America/New_York','Pacific/Auckland']){const changed=await set(1220000,zone);assert.deepEqual(changed.bounce,initial.bounce);assert.deepEqual(changed.candles,initial.candles);assert.deepEqual(await nodeText(),initialNodes);}
  const mapsBefore=requests.filter(u=>u.startsWith('/api/gex-map?')).length;
  assert.equal(mapsBefore,1,'Map and Bounce coalesce one archive request across repeated seeks/zones');
  assert.equal(requests.filter(u=>u.startsWith('/api/gex-map/future')).length,0);
  await set(1220000,'UTC',true);await page.getByRole('status').filter({hasText:'forward-expiry matrix has no recorded replay surface'}).waitFor();
  assert.equal(requests.filter(u=>u.startsWith('/api/gex-map/future')).length,0,'Future view never starts live polling during replay');
  assert.deepEqual(errors,[]);fs.writeFileSync('tmp/shared-replay-browser-results.json',JSON.stringify({passed:true,observations,requests,errors},null,2));console.log(JSON.stringify({passed:true,observations:observations.length,archiveRequests:mapsBefore,pageErrors:errors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
