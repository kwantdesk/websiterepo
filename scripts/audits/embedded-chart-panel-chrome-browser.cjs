const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), http = require("node:http");
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const { chromium } = require(process.env.KWANTDESK_PLAYWRIGHT_MODULE || "playwright");
const root = process.cwd(), output = path.join(root, "tmp/panel-chrome-bundle"), stub = path.join(root, "scripts/audits/phone-fixture-next.tsx");
const config = {
  mode: "development", devtool: false, entry: path.join(root, "scripts/audits/device-sync-fixture-entry.tsx"),
  output: { path: output, filename: "main.js", publicPath: "/" },
  resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
    "next/link$": stub, "next/navigation$": stub, "next/dynamic$": path.join(root, "scripts/audits/phone-fixture-dynamic.tsx"),
    "@/lib/workspaceNavigationWarmup$": stub, "@/lib/rendererHealth$": stub,
    "@/components/HighImpactNewsChip$": path.join(root, "scripts/audits/phone-fixture-null.tsx"), "@": path.join(root, "src"),
  }},
  module: { rules: [{ test: /\.(tsx?|css)$/, exclude: /node_modules/, use: path.join(root, "scripts/audits/phone-fixture-loader.cjs") }] },
  optimization: { minimize: false }, plugins: [new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
};

config.resolve.alias={"@/lib/supabase/client$":path.join(root,"scripts/audits/device-sync-fixture-client.ts"),"@/lib/supabase$":path.join(root,"scripts/audits/device-sync-fixture-client.ts"),...config.resolve.alias};
if(process.env.DEVICE_SETTINGS_BASELINE){const {execFileSync}=require('node:child_process');fs.mkdirSync(output,{recursive:true});const before=path.join(output,'Settings-before.tsx');fs.writeFileSync(before,execFileSync('git',['show','8f456d7ce3d88ef029add1a242ee70672dbae6d8:src/components/KwantifySettingsWorkspace.tsx']));config.resolve.alias={'@/components/KwantifySettingsWorkspace$':before,...config.resolve.alias};}
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
 const css=fs.readdirSync("../kwantdesk-position-viewport-release/.next/static/css").filter(p=>p.endsWith(".css")).map(p=>fs.readFileSync("../kwantdesk-position-viewport-release/.next/static/css/"+p,"utf8")).join("\n")+fs.readFileSync("src/components/algo/algo.css","utf8");
 const phoneCss=process.env.PHONE_BASELINE?"":fs.readFileSync("src/app/phone-layout.css","utf8");
 const scrollCss='';
 const requests=[],errors=[],checks=[],rows=new Map(),streams=new Set();let writes=0;
 const json=(res,value)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(value));};
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,"http://localhost");

  if(u.pathname.startsWith('/heatmap-app/')||u.pathname.startsWith('/gex-data-app/')||u.pathname.startsWith('/phone-workspace.')||u.pathname.startsWith('/fonts/')){
   const file=path.join(root,'public',u.pathname);if(fs.existsSync(file)&&fs.statSync(file).isFile()){
    res.setHeader('content-type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');
    let content=fs.readFileSync(file);if(file.endsWith('/index.html')||file.endsWith('\\index.html')) content=content.toString().replace(/<script type="module" src="src\/main.js[^>]*><\/script>/,'<script>document.addEventListener("DOMContentLoaded",()=>{window.fixtureControlClicks=0;for(const b of document.querySelectorAll(".rail-button"))b.addEventListener("click",()=>window.fixtureControlClicks++);document.querySelector("#newTab").addEventListener("click",()=>document.querySelector("#instrumentPicker").showModal());});window.addEventListener("load",()=>{for(const type of ["kwantdesk:liquidity-map-styles-ready","kwantdesk:liquidity-map-data-ready"])window.parent.postMessage({type},location.origin);});</script>');
    return res.end(content);
   }
  }
  if(u.pathname==='/fixture/events'){res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache'});res.write(': ready\n\n');const peer={owner:u.searchParams.get('owner'),device:u.searchParams.get('device'),res};streams.add(peer);req.on('close',()=>streams.delete(peer));return;}
  if(u.pathname.startsWith('/fixture/')){let body='';req.on('data',part=>body+=part);req.on('end',()=>{const input=JSON.parse(body||'{}');if(u.pathname==='/fixture/hint'){for(const peer of streams)if(false)peer.res.write('data: {}\n\n');return json(res,{ok:true});}if(input.table!=='user_preferences')return json(res,{data:null,error:null});let row=rows.get(input.owner);if(input.op==='read')return json(res,{data:row??null,error:null});if(input.op==='insert'&&row)return json(res,{data:null,error:{code:'23505'}});if(input.op==='update'&&input.filters.updated_at!==row?.updated_at)return json(res,{data:null,error:null});rows.set(input.owner,input.payload);writes++;return json(res,{data:{updated_at:input.payload.updated_at},error:null});});return;}
  if(u.pathname.startsWith('/fonts/')){const f=path.join(root,'public',u.pathname);if(fs.existsSync(f)){res.setHeader('content-type',f.endsWith('.css')?'text/css':'font/ttf');return res.end(fs.readFileSync(f));}}
  if(u.pathname==="/styles.css"){res.setHeader("content-type","text/css");return res.end(css+"\n/* Keep a real plot"+scrollCss+phoneCss+"\n@font-face{font-family:Aleph;src:url(/fonts/aleph/Aleph-Regular.ttf)}body{font-family:Aleph,sans-serif}");}
  if(u.pathname==="/api/cme-history"){requests.push(u.search);res.setHeader("content-type","application/json");return res.end(JSON.stringify({candles:candles(u),executions:[],configured:true,source:"Isolated fixture"}));}
  if(u.pathname.startsWith("/api/")){res.setHeader("content-type","application/json");return res.end("{}");}
  const p=path.join(output,u.pathname);if(p.startsWith(output)&&fs.existsSync(p)&&fs.statSync(p).isFile()){res.setHeader("content-type","text/javascript");return res.end(fs.readFileSync(p));}
  res.setHeader("content-type","text/html;charset=utf-8");res.end('<html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/styles.css"><style>:root{--background:#000;--foreground:#fff;--primary:#a779ff;--on-primary:#000;--muted:#aaa;--border:#333;--panel:#080808;--surface:#181818;--chart-background:#000}html,body,#root{height:100%;margin:0}</style></head><body><div id="root"></div><script src="/main.js"></script></body></html>');
 });
 await new Promise(r=>server.listen(0,"127.0.0.1",r));const origin="http://127.0.0.1:"+server.address().port;
 const browser=await chromium.launch({headless:true,ignoreDefaultArgs:["--hide-scrollbars"],executablePath:process.env.KWANTDESK_CHROME_EXECUTABLE,args:["--enable-unsafe-swiftshader"]});

 try{
 const desktopContext=await browser.newContext({viewport:{width:1440,height:980}}),phoneContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const desktop=await desktopContext.newPage(),phone=await phoneContext.newPage();
 for(const page of [desktop,phone]){page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());}
 const opened=Date.now();await desktop.goto(origin+'/?owner=device-fixture');await desktop.locator('[data-chart-workspace-scope="charts"] canvas').first().waitFor({timeout:45000});
 await desktop.getByRole('button',{name:'Add panel to workspace',exact:true}).click();await desktop.locator('[data-workspace-panel-picker]').getByText('LIQ MAP',{exact:true}).click();
 await desktop.getByTitle('Two panels side by side',{exact:true}).click();
 const map=desktop.locator('[data-embedded-workspace-pane="liqmap"]');await map.locator('iframe').waitFor();
 const frame=desktop.frameLocator('[data-embedded-workspace-pane="liqmap"] iframe');await frame.locator('.kwant-compact-control-section').first().waitFor({state:'attached'});await desktop.waitForTimeout(400);
 const normal=desktop.locator('.kwant-chart-pane-scrollport').filter({hasNot:desktop.locator('[data-embedded-workspace-pane]')}).first();
 const mapHeader=map.locator(':scope > .kwant-workspace-pane-header');const normalHeader=desktop.locator('.kwant-chart-pane-scrollport > .kwant-workspace-pane-header').first();
 const a=await normalHeader.boundingBox(),b=await mapHeader.boundingBox();assert.equal(a.height,b.height);assert.equal(a.y,b.y);checks.push({check:'Normal and embedded panel header geometry matches',normal:a,map:b});
 assert.equal(await frame.locator('.terminal-shell > .app-bar').isVisible(),false);assert.equal(await frame.locator('.terminal-shell > .top-deck').count(),0);assert.equal(await frame.locator('.workspace').evaluate(e=>e.getBoundingClientRect().top),0);checks.push({check:'Map plot starts directly below shared chart header, with no duplicate instrument or toolbar rows'});
 await mapHeader.getByRole('button',{name:'Open liquidity map controls',exact:true}).click();await frame.locator('.kwant-embed-phone-drawer:not([hidden])').waitFor();assert.ok(await frame.locator('.kwant-compact-control-grid > button').count()>=16);await frame.getByRole('button',{name:'Toggle heatmap',exact:true}).click();assert.ok(await frame.locator('body').evaluate(()=>window.fixtureControlClicks)>0);await frame.locator('.kwant-embed-phone-drawer').getByRole('button',{name:'Close chart controls',exact:true}).click();checks.push({check:'Header Controls opens original named map controls with handlers retained'});
 await mapHeader.getByRole('button',{name:'Change liquidity map instrument',exact:true}).click();await frame.locator('#instrumentPicker[open]').waitFor();await frame.locator('#instrumentPicker').evaluate(e=>e.close());checks.push({check:'Instrument selector opens the original supported map instrument picker'});
 const before=(await map.locator('iframe').boundingBox()).width;await mapHeader.getByRole('button',{name:'Open chart order ticket',exact:true}).click();await map.locator('[data-inline-ticket]').waitFor();assert.ok((await map.locator('iframe').boundingBox()).width<before);await mapHeader.getByRole('button',{name:'Close chart order ticket',exact:true}).click();checks.push({check:'Standard chart trade button opens and closes inline order ticket'});
 await desktop.screenshot({path:'tmp/panel-chrome-desktop.png'});
 await desktop.setViewportSize({width:600,height:900});await desktop.waitForTimeout(150);const close=mapHeader.getByRole('button',{name:'Close LIQ MAP panel',exact:true});const cb=await close.boundingBox(),mb=await map.boundingBox();assert.ok(cb.x+cb.width<=mb.x+mb.width+1);checks.push({check:'Close action stays inside a narrow embedded panel'});
 await desktop.setViewportSize({width:1440,height:980});
 await mapHeader.getByRole('button',{name:'Detach LIQ MAP panel',exact:true}).click();
 const floating=desktop.locator('.kwant-floating-chart-surface').filter({has:desktop.locator('iframe')});await floating.waitFor();assert.equal(await floating.locator('.kwant-workspace-pane-header').count(),1);
 await floating.getByRole('button',{name:'Open liquidity map controls',exact:true}).click();await desktop.frameLocator('.kwant-floating-chart-surface iframe').locator('.kwant-embed-phone-drawer:not([hidden])').waitFor();checks.push({check:'Floating map uses one shared header and working controls'});
 await phone.goto(origin+'/heatmap-app/index.html?shellToolbar=1');await phone.locator('.app-bar').waitFor();assert.equal(await phone.locator('html[data-workspace-pane]').count(),0);checks.push({check:'Standalone map retains its native app bar outside workspace-pane mode'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors},null,2));fs.writeFileSync('tmp/panel-chrome-result.json',JSON.stringify({checks,errors,method:'Actual Workspace, LiquidityMapWorkspace, map HTML/CSS and compact controls in isolated headless Chrome; market renderer/data and account transport stubbed.'},null,2));
 await desktopContext.close();await phoneContext.close();
 }finally{for(const peer of streams)peer.res.end();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
