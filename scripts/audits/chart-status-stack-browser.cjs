const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const webpack=require('next/dist/compiled/webpack/webpack').webpack;
const {chromium}=require(path.join(process.cwd(),'tmp/chart-lock-browser/node_modules/playwright-core'));
const root=process.cwd(),output=path.join(root,'tmp/chart-status-stack-bundle'),stub=path.join(root,'scripts/audits/phone-fixture-next.tsx');
const config={mode:'development',devtool:false,entry:path.join(root,'scripts/audits/chart-status-stack-fixture.tsx'),output:{path:output,filename:'main.js',publicPath:'/'},resolve:{extensions:['.tsx','.ts','.js'],alias:{'@/lib/lightweightChartsCompat$':path.join(root,'scripts/audits/momentum-chart-compat.ts'),'next/navigation$':stub,'next/link$':stub,'next/dynamic$':path.join(root,'scripts/audits/phone-fixture-dynamic.tsx'),'@/lib/userPreferences$':path.join(root,'scripts/audits/phone-fixture-prefs.ts'),'@/lib/supabase$':path.join(root,'scripts/audits/phone-fixture-auth.ts'),'@':path.join(root,'src')}},module:{rules:[{test:/\.(tsx?|css)$/,exclude:/node_modules/,use:path.join(root,'scripts/audits/phone-fixture-loader.cjs')}]},optimization:{minimize:false},plugins:[new webpack.optimize.LimitChunkCountPlugin({maxChunks:1}),new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('development')})]};
(async()=>{
 await new Promise((resolve,reject)=>webpack(config,(e,s)=>e||s.hasErrors()?reject(e||s.toString({all:false,errors:true})):resolve()));
 const css=fs.readdirSync('../kwantdesk-position-viewport-release/.next/static/css').filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync('../kwantdesk-position-viewport-release/.next/static/css/'+f)).join('\n');
 const server=http.createServer((q,r)=>{r.setHeader('Content-Type',q.url==='/main.js'?'text/javascript':q.url==='/style.css'?'text/css':'text/html');r.end(q.url==='/main.js'?fs.readFileSync(path.join(output,'main.js')):q.url==='/style.css'?css:'<html><head><link rel="stylesheet" href="/style.css"><style>:root{--background:#080808;--foreground:#eee;--primary:#ef3892;--on-primary:#fff;--muted:#aaa;--border:#333;--panel:#080808;--surface:#181818;--chart-background:#000}body{margin:0}</style></head><body class="kwant-cockpit-ui"><div id="root"></div><script src="/main.js"></script></body></html>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const results=[],errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1400,height:950}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().startsWith(origin)&&!r.request().url().includes('/api/')?r.continue():r.abort());
  await page.goto(origin);await page.locator('.tv-lightweight-charts canvas').first().waitFor();
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await settle();await page.waitForTimeout(100);
  for(const theme of ['dark','light'])for(const width of [900,400,260])for(const multiple of [false,true]){
   await page.evaluate(state=>{window.setStatusFixture(state);document.documentElement.style.setProperty('--background',state.theme==='light'?'#fff':'#080808');document.documentElement.style.setProperty('--foreground',state.theme==='light'?'#111':'#eee');},{width,height:400,multiple,theme});
   await page.waitForFunction(()=>document.querySelectorAll('[data-chart-indicator-status]').length>0);await settle();
   const boxes=await page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};const chart=document.querySelector('[data-chart-instance-id]');const axis=chart.querySelector('.tv-lightweight-charts tr:first-child td:last-child canvas');const rail=chart.querySelector('[data-chart-corner="top-right"]');return {chart:rect(chart),axis:rect(axis),rail:rect(rail),items:[...chart.querySelectorAll('[data-chart-indicator-status]')].map(e=>({...rect(e),text:e.textContent,position:getComputedStyle(e).position}))};});
   assert.ok(boxes.items.some(x=>x.text.includes('Classic GEX')));
   assert.ok(Math.abs(boxes.rail.top-boxes.chart.top-12)<2,'top corner anchor');
   for(const item of boxes.items){assert.ok(item.right<=boxes.axis.left-8,'popup covers price axis');assert.ok(item.left>=boxes.chart.left-1,'popup overflows chart left');assert.equal(item.position,'relative');}
   const sorted=boxes.items.toSorted((a,b)=>a.top-b.top);
   for(let i=1;i<sorted.length;i++)assert.ok(sorted[i].top>=sorted[i-1].bottom+7,'popups overlap instead of stacking');
   assert.ok(multiple?boxes.items.length>=3:boxes.items.length===1);
   results.push({theme,width,multiple,boxes});
  }
  await page.screenshot({path:'tmp/chart-status-stack-260.png'});
  assert.deepEqual(errors,[]);fs.writeFileSync('tmp/chart-status-stack-browser.json',JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({checks:results.length,errors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
