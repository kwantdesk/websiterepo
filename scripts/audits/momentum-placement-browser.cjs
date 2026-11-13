const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const webpack=require('next/dist/compiled/webpack/webpack').webpack;
const {chromium}=require(path.join(process.cwd(),'tmp/chart-lock-browser/node_modules/playwright-core'));
const root=process.cwd(),output=path.join(root,'tmp/momentum-placement-bundle'),stub=path.join(root,'scripts/audits/phone-fixture-next.tsx');
const config={mode:'development',devtool:false,entry:path.join(root,'scripts/audits/momentum-placement-fixture.tsx'),output:{path:output,filename:'main.js',publicPath:'/'},resolve:{extensions:['.tsx','.ts','.js'],alias:{'@/lib/lightweightChartsCompat$':path.join(root,'scripts/audits/momentum-chart-compat.ts'),'next/navigation$':stub,'next/link$':stub,'next/dynamic$':path.join(root,'scripts/audits/phone-fixture-dynamic.tsx'),'@/lib/userPreferences$':path.join(root,'scripts/audits/phone-fixture-prefs.ts'),'@/lib/supabase$':path.join(root,'scripts/audits/phone-fixture-auth.ts'),'@':path.join(root,'src')}},module:{rules:[{test:/\.(tsx?|css)$/,exclude:/node_modules/,use:path.join(root,'scripts/audits/phone-fixture-loader.cjs')}]},optimization:{minimize:false},plugins:[new webpack.optimize.LimitChunkCountPlugin({maxChunks:1}),new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('development')})]};
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
  const coordinate=()=>page.evaluate(()=>window.momentumChartAudit.series.find(x=>x.method==='addCandlestickSeries').series.priceToCoordinate(28000));
  const baseline=await coordinate();
  const ids=['relative-strength-index-rsi','rate-of-change-roc','macd-indicator','momentum-indicator','commodity-channel-index-cci','know-sure-thing-kst','inverse-cyber-cycle','aroon-oscillator','awesome-oscillator','stochastic-oscillator','williams-r','chaikin-accumulation-distribution','average-directional-index-adx'];
  for(const id of ids){
   await page.evaluate(id=>window.setMomentumFixture(id,'chart'),id);await settle();
   await page.waitForFunction(()=>window.momentumChartAudit.series.some(x=>x.method!=='addCandlestickSeries'&&x.series.options().priceScaleId?.startsWith('momentum-')));
   assert.equal(await page.locator('[data-indicator-pane-wheel-zone="study"]').count(),0,id+' duplicate lower pane');
   assert.ok(Math.abs((await coordinate())-baseline)<1,id+' distorted candle scale');
   await page.evaluate(id=>window.setMomentumFixture(id,'pane'),id);await settle();
   await page.locator('[data-indicator-pane-wheel-zone="study"]').first().waitFor();
   results.push({id,chartAndPane:true,candleScaleUnchanged:true});
  }
  await page.getByRole('button',{name:'Study settings',exact:true}).click();
  const chartButton=page.getByRole('button',{name:'On candle chart',exact:true});await chartButton.click();
  await page.getByRole('button',{name:'Save Average Directional Index (ADX) settings',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.momentumFixtureState.settings.chartArea),'chart');
  await page.getByRole('button',{name:'Close Average Directional Index (ADX) settings',exact:true}).click();
  await settle();assert.equal(await page.locator('[data-indicator-pane-wheel-zone="study"]').count(),0);
  assert.deepEqual(errors,[]);fs.writeFileSync('tmp/momentum-placement-browser.json',JSON.stringify({results,settingsClickAndSave:true,errors},null,2));
  console.log(JSON.stringify({indicators:results.length,settingsClickAndSave:true,errors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
