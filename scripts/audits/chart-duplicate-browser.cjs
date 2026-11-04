const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), http = require("node:http");
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const { chromium } = require(process.env.KWANTDESK_PLAYWRIGHT_MODULE || "playwright");
const root = process.cwd(), output = path.join(root, "tmp/chart-duplicate-browser-bundle"), stub = path.join(root, "scripts/audits/phone-fixture-next.tsx");
const config = {
  mode: "development", devtool: false, entry: path.join(root, "scripts/audits/phone-fixture-entry.tsx"),
  output: { path: output, filename: "main.js", publicPath: "/" },
  resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
    "next/link$": stub, "next/navigation$": stub, "next/dynamic$": path.join(root, "scripts/audits/phone-fixture-dynamic.tsx"),
    "@/lib/workspaceNavigationWarmup$": stub, "@/lib/rendererHealth$": stub,
    "@/components/HighImpactNewsChip$": path.join(root, "scripts/audits/phone-fixture-null.tsx"), "@": path.join(root, "src"),
  }},
  module: { rules: [{ test: /\.(tsx?|css)$/, exclude: /node_modules/, use: path.join(root, "scripts/audits/phone-fixture-loader.cjs") }] },
  optimization: { minimize: false }, plugins: [new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
};

config.resolve.alias={"@/lib/userPreferences$":path.join(root,"scripts/audits/phone-fixture-prefs.ts"),"@/lib/supabase$":path.join(root,"scripts/audits/phone-fixture-auth.ts"),...config.resolve.alias};
config.plugins.push(new webpack.DefinePlugin({"process.env":JSON.stringify({NODE_ENV:"development"})}));
if(process.env.DUPLICATE_BASELINE){config.resolve.alias={"@/lib/chartDuplicateSeed$":path.join(root,'scripts/audits/chart-duplicate-baseline-stubs.ts'),"@/lib/chartWarmHistory$":path.join(root,'scripts/audits/chart-duplicate-baseline-stubs.ts'),...config.resolve.alias};}
function candles(url) {
 const from=Number(url.searchParams.get("from"))||Date.now()-10*86400000,to=Number(url.searchParams.get("to"))||Date.now();
 const symbol=url.searchParams.get("symbol")||"ES",base=symbol.startsWith("NQ")?20000:symbol.startsWith("GC")?4000:6500;
 const interval=url.searchParams.get("timeframe")||"1m",step=(interval==="5m"?5:interval==="15m"?15:1)*60000;
 const out=[];for(let t=Math.ceil(from/step)*step;t<to;t+=step){
  const n=Math.floor(t/60000),open=base+(n%60)*.25,close=base+((n+1)%60)*.25;
  out.push({timestamp:t,open,close,high:Math.max(open,close)+.25,low:Math.min(open,close)-.25,volume:100,bidVolume:40,askVolume:60,delta:20});
 }return out;
}
async function main(){
 if(!process.env.PHONE_BASELINE && !process.env.PHONE_REUSE) await new Promise((resolve,reject)=>{const c=webpack(config);c.run((e,s)=>{const err=e||(s.hasErrors()?Error(s.toString({all:false,errors:true})):null);c.close(()=>err?reject(err):resolve());});});
 const css=fs.readdirSync(".next/static/chunks").filter(p=>p.endsWith(".css")).map(p=>fs.readFileSync(".next/static/chunks/"+p,"utf8")).join("\n")+fs.readFileSync("src/components/algo/algo.css","utf8");
 const phoneCss=process.env.PHONE_BASELINE?"":fs.readFileSync("src/app/phone-layout.css","utf8");
 const scrollCss=fs.readFileSync("src/app/globals.css","utf8").split("/* Keep a real plot")[1].split("/* Each chart toolbar lane")[0];
 const requests=[],errors=[],checks=[];
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,"http://localhost");
  if(u.pathname.startsWith('/fonts/')){const f=path.join(root,'public',u.pathname);if(fs.existsSync(f)){res.setHeader('content-type',f.endsWith('.css')?'text/css':'font/ttf');return res.end(fs.readFileSync(f));}}
  if(u.pathname==="/styles.css"){res.setHeader("content-type","text/css");return res.end(css+"\n/* Keep a real plot"+scrollCss+phoneCss+"\n@font-face{font-family:Aleph;src:url(/fonts/aleph/Aleph-Regular.ttf)}body{font-family:Aleph,sans-serif}");}
  if(u.pathname==="/api/cme-history"){requests.push(u.search);res.setHeader("content-type","application/json");return res.end(JSON.stringify({candles:candles(u),executions:u.searchParams.get('orderFlow')==='1'?Array.from({length:25000},(_,i)=>[Date.now()-3600000+i*140,6500+(Math.floor(i/100)%60)*.25,10,i%2?10:-10]):[],configured:true,source:"Isolated fixture"}));}
  if(u.pathname.startsWith("/api/")){res.setHeader("content-type","application/json");return res.end("{}");}
  const p=path.join(output,u.pathname);if(p.startsWith(output)&&fs.existsSync(p)&&fs.statSync(p).isFile()){res.setHeader("content-type","text/javascript");return res.end(fs.readFileSync(p));}
  res.setHeader("content-type","text/html;charset=utf-8");res.end('<html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/styles.css"><style>:root{--background:#000;--foreground:#fff;--primary:#a779ff;--on-primary:#000;--muted:#aaa;--border:#333;--panel:#080808;--surface:#181818;--chart-background:#000}html,body,#root{height:100%;margin:0}</style></head><body><div id="root"></div><script src="/main.js"></script></body></html>');
 });
 await new Promise(r=>server.listen(0,"127.0.0.1",r));const origin="http://127.0.0.1:"+server.address().port;
 const browser=await chromium.launch({headless:true,ignoreDefaultArgs:["--hide-scrollbars"],executablePath:process.env.KWANTDESK_CHROME_EXECUTABLE,args:["--enable-unsafe-swiftshader"]});

 try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});page.setDefaultTimeout(15000);page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR',e.message)});await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 await page.addInitScript(()=>{
 const ids=['cumulative-volume-delta','cvd-divergence','delta-bar','delta-cumulative-candlestick','delta-cumulative-histogram','imbalance-tracker','unfinished-auction','bar-poc-indicator','dynamic-poc','speed-of-tape','big-trades','big-blocks','weekly-volume-profile','monthly-volume-profile','session-volume-profile','visible-range-volume-profile','composite-volume-profile','vwap','vwap-envelopes','rolling-vwap','session-highs-lows','tpo-chart','weekly-tpo','bollinger-bands'];
 localStorage.setItem('olisa-chart-workspace-layout','single');localStorage.setItem('kwantdesk-chart-indicators',JSON.stringify({'pane-1':ids.map((indicatorId,i)=>({instanceId:'fixture-'+i,indicatorId,enabled:true}))}));
 window.__resize=0;const OriginalObserver=ResizeObserver;window.ResizeObserver=class extends OriginalObserver{constructor(fn){super((...args)=>{window.__resize++;fn(...args)})}};window.__beats=0;setInterval(()=>window.__beats++,50);
 const obs=new PerformanceObserver(list=>{for(const e of list.getEntries())(window.__longTasks??=[]).push({start:e.startTime,duration:e.duration})});obs.observe({entryTypes:['longtask']});
 });
 await page.goto(origin+'/?surface=charts');await page.locator('[data-chart-workspace-scope="charts"] canvas').first().waitFor({timeout:45000});await page.waitForTimeout(1500);
 const initial=await page.evaluate(()=>({beats:window.__beats,resize:window.__resize,indicators:JSON.parse(localStorage.getItem('kwantdesk-chart-indicators')),canvas:document.querySelectorAll('canvas').length,longTasks:window.__longTasks}));console.log('INITIAL',initial.canvas,initial.indicators['pane-1'].length);
 const firstCanvas=await page.locator('[data-workspace-pane-id]').first().locator('canvas').first().elementHandle();
 await page.evaluate(()=>{const actualNow=Date.now;Date.now=()=>actualNow()+60000;});const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');const historyReadsBefore=requests.length;const start=Date.now();await page.getByRole('button',{name:'Duplicate chart',exact:true}).first().click();
 const clickMs=Date.now()-start;console.log('CLICK',clickMs);await page.waitForFunction(()=>document.querySelectorAll('[data-workspace-pane-id]').length===2&&[...document.querySelectorAll('[data-workspace-pane-id]')].every(p=>p.querySelector('canvas')));
 await page.waitForTimeout(2500);
 const profile=await cdp.send('Profiler.stop');fs.writeFileSync('tmp/chart-duplicate.cpuprofile',JSON.stringify(profile.profile));const after=await page.evaluate(()=>({beats:window.__beats,resize:window.__resize,panes:document.querySelectorAll('[data-workspace-pane-id]').length,canvas:document.querySelectorAll('canvas').length,longTasks:window.__longTasks,indicators:JSON.parse(localStorage.getItem('kwantdesk-chart-indicators'))}));const copies=Object.entries(after.indicators).filter(([id])=>id!=='pane-1');assert.equal(copies.length,1);assert.deepEqual(copies[0][1].map(({instanceId,...rest})=>rest),initial.indicators['pane-1'].map(({instanceId,...rest})=>rest));assert.ok(after.beats>initial.beats+10);const newBaseReads=requests.slice(historyReadsBefore).filter(q=>new URLSearchParams(q).get('timeframe')==='5m');if(!process.env.DUPLICATE_BASELINE)assert.equal(newBaseReads.length,0,'duplicate must reuse loaded source history even after cache freshness expires');else assert.ok(newBaseReads.length>0,'negative control must exercise ordinary cold restoration');console.log('AFTER',Date.now()-start,after.canvas,after.beats-initial.beats);
 console.log('SOURCE_CONNECTED',await firstCanvas.evaluate(el=>el.isConnected));
 assert.equal(await page.locator('[data-workspace-pane-id]').count(),2);assert.ok(await firstCanvas.evaluate(el=>el.isConnected));assert.deepEqual(errors,[]);
 await page.screenshot({path:'tmp/chart-duplicate.png'});fs.writeFileSync('tmp/chart-duplicate-'+(process.env.DUPLICATE_BASELINE?'baseline':'fixed')+'-result.json',JSON.stringify({errors,requests,historyReadsBefore,clickMs,duplicateMs:Date.now()-start,initial,after},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
