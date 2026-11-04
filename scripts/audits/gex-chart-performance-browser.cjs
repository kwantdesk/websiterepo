const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), http = require("node:http");
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const { chromium } = require(process.env.KWANTDESK_PLAYWRIGHT_MODULE || "playwright");
const root = process.cwd(), output = path.join(root, "tmp/gex-chart-performance-bundle"), stub = path.join(root, "scripts/audits/phone-fixture-next.tsx");
const config = {
  mode: "development", devtool: false, entry: path.join(root, "scripts/audits/gex-chart-performance-entry.tsx"),
  output: { path: output, filename: "main.js", publicPath: "/" },
  resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
    "next/link$": stub, "next/navigation$": stub, "next/dynamic$": path.join(root, "scripts/audits/phone-fixture-dynamic.tsx"),
    "@/lib/workspaceNavigationWarmup$": stub, "@/lib/rendererHealth$": stub,
    "@/components/HighImpactNewsChip$": path.join(root, "scripts/audits/phone-fixture-null.tsx"), "@": path.join(root, "src"),
  }},
  module: { rules: [{ test: /\.(tsx?|css)$/, exclude: /node_modules/, use: path.join(root, "scripts/audits/gex-chart-performance-loader.cjs") }] },
  optimization: { minimize: false }, plugins: [new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
};

config.resolve.alias={"@/lib/userPreferences$":path.join(root,"scripts/audits/phone-fixture-prefs.ts"),"@/lib/supabase$":path.join(root,"scripts/audits/phone-fixture-auth.ts"),...config.resolve.alias};
config.plugins.push(new webpack.DefinePlugin({"process.env":JSON.stringify({NODE_ENV:"development"})}));
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
 let gexPayloadVersion=0;const server=http.createServer((req,res)=>{
  const u=new URL(req.url,"http://localhost");
  if(u.pathname.startsWith('/fonts/')){const f=path.join(root,'public',u.pathname);if(fs.existsSync(f)){res.setHeader('content-type',f.endsWith('.css')?'text/css':'font/ttf');return res.end(fs.readFileSync(f));}}
  if(u.pathname==="/styles.css"){res.setHeader("content-type","text/css");return res.end(css+"\n/* Keep a real plot"+scrollCss+phoneCss+"\n@font-face{font-family:Aleph;src:url(/fonts/aleph/Aleph-Regular.ttf)}body{font-family:Aleph,sans-serif}");}
  if(u.pathname==="/api/cme-history"){requests.push(u.search);res.setHeader("content-type","application/json");return res.end(JSON.stringify({candles:candles(u),executions:[],configured:true,source:"Isolated fixture"}));}
  if(u.pathname==='/fixture/advance'){gexPayloadVersion++;return res.end('{}');}if(u.pathname==='/api/gex-map'){const base=u.searchParams.get('symbol')==='NDX'?28500:690;const rows=Array.from({length:240},(_,i)=>({strike:base-120+i,call:(i+1)*100000,put:-(241-i)*100000,net:(i-120+gexPayloadVersion)*100000}));const now=Date.now();const payload={symbol:u.searchParams.get('symbol'),greekMode:u.searchParams.get('greekMode'),sessionDate:new Date(now).toISOString().slice(0,10),expiration:null,expirations:[],scope:u.searchParams.get('scope'),representation:u.searchParams.get('representation'),model:u.searchParams.get('model')||'STRUCTURAL_OI',source:'KwantData Interval Map',sourceTimeZone:'America/New_York',asOf:new Date(now).toISOString(),status:'LIVE',refreshAfterMs:60000,stockPrice:base+gexPayloadVersion*.25,sessionChangePercent:1,latestStrikes:rows,frames:[{timestamp:now-600000,updates:rows},{timestamp:now,updates:rows}],candles:[],netExposure:1,grossExposure:1,rateLimitRemaining:100};res.setHeader('content-type','application/json');return res.end(JSON.stringify(payload));}
  if(u.pathname.startsWith("/api/")){res.setHeader("content-type","application/json");return res.end("{}");}
  const p=path.join(output,u.pathname);if(p.startsWith(output)&&fs.existsSync(p)&&fs.statSync(p).isFile()){res.setHeader("content-type","text/javascript");return res.end(fs.readFileSync(p));}
  res.setHeader("content-type","text/html;charset=utf-8");res.end('<html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/styles.css"><style>:root{--background:#000;--foreground:#fff;--primary:#a779ff;--on-primary:#000;--muted:#aaa;--border:#333;--panel:#080808;--surface:#181818;--chart-background:#000}html,body,#root{height:100%;margin:0}</style></head><body><div id="root"></div><script src="/main.js"></script></body></html>');
 });
 await new Promise(r=>server.listen(0,"127.0.0.1",r));const origin="http://127.0.0.1:"+server.address().port;
 const browser=await chromium.launch({headless:true,ignoreDefaultArgs:["--hide-scrollbars"],executablePath:process.env.KWANTDESK_CHROME_EXECUTABLE,args:["--enable-unsafe-swiftshader"]});

 try{
 const page=await browser.newPage({viewport:{width:1800,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await page.goto(origin);await page.locator('[data-chart-workspace-scope="charts"] canvas').first().waitFor({timeout:45000});await page.locator('[data-gex-strike-node="true"]').first().waitFor({timeout:45000});await page.waitForTimeout(1000);
 const before=await page.evaluate(()=>({...window.__gexRenders}));const start=Date.now();
 for(let i=0;i<30;i++){await page.evaluate(()=>window.hostTick());await page.waitForTimeout(30);}
 const after=await page.evaluate(()=>({...window.__gexRenders}));const hostTicks=Number(await page.locator('[data-host-tick]').getAttribute('data-host-tick'));const result={before,after,hostTicks,elapsedMs:Date.now()-start,errors,rows:await page.locator('[data-gex-strike-node="true"]').count()};console.log(JSON.stringify(result,null,2));assert.equal(hostTicks,30);assert.deepEqual(errors,[]);if(!process.env.GEX_PERF_BASELINE){assert.ok(after.GexMapWorkspace-before.GexMapWorkspace<=2);assert.ok(after.ExposurePanel-before.ExposurePanel<=6);}await page.locator('.gex-map-header .gex-map-frame-steps').getByRole('button',{name:'2m',exact:true}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('olisa-chart-workspace-panes')).find(p=>p.id==='pane-2').gexMapState.stepMinutes===2);const beforeRowText=await page.locator('[data-gex-strike-node="true"]').first().textContent();await page.evaluate(()=>fetch('/fixture/advance'));await page.locator('.gex-map-header').getByTitle('Sync now',{exact:true}).click();await page.locator('.gex-map-panel-spot').nth(1).getByText('690.25',{exact:true}).waitFor({state:'attached',timeout:10000});assert.notEqual(await page.locator('[data-gex-strike-node="true"]').first().textContent(),beforeRowText);result.settingsSaved=true;result.newProviderDataVisible=true;assert.deepEqual(errors,[]);await page.screenshot({path:'tmp/gex-chart-performance.png'});fs.writeFileSync('tmp/gex-chart-performance-'+(process.env.GEX_PERF_BASELINE?'baseline':'fixed')+'.json',JSON.stringify(result,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
