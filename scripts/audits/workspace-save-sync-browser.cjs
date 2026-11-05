const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), http = require("node:http");
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const { chromium } = require(process.env.KWANTDESK_PLAYWRIGHT_MODULE || path.join(process.cwd(),'tmp/chart-lock-browser/node_modules/playwright-core'));
const root = process.cwd(), output = path.join(root, "tmp/device-sync-browser-bundle"), stub = path.join(root, "scripts/audits/phone-fixture-next.tsx");
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
 const css=fs.readdirSync(".next/static/chunks").filter(p=>p.endsWith(".css")).map(p=>fs.readFileSync(".next/static/chunks/"+p,"utf8")).join("\n")+fs.readFileSync("src/components/algo/algo.css","utf8");
 const phoneCss=process.env.PHONE_BASELINE?"":fs.readFileSync("src/app/phone-layout.css","utf8");
 const scrollCss=fs.readFileSync("src/app/globals.css","utf8").split("/* Keep a real plot")[1].split("/* Each chart toolbar lane")[0];
 const requests=[],errors=[],checks=[],rows=new Map(),streams=new Set();let writes=0;
 const json=(res,value)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(value));};
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,"http://localhost");
  if(u.pathname==='/fixture/events'){res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache'});res.write(': ready\n\n');const peer={owner:u.searchParams.get('owner'),device:u.searchParams.get('device'),res};streams.add(peer);req.on('close',()=>streams.delete(peer));return;}
  if(u.pathname.startsWith('/fixture/')){let body='';req.on('data',part=>body+=part);req.on('end',()=>{const input=JSON.parse(body||'{}');if(u.pathname==='/fixture/hint'){for(const peer of streams)if(peer.owner===input.owner&&peer.device!==input.device)peer.res.write('data: {}\n\n');return json(res,{ok:true});}if(input.table!=='user_preferences')return json(res,{data:null,error:null});let row=rows.get(input.owner);if(input.op==='read')return json(res,{data:row??null,error:null});if(input.op==='insert'&&row)return json(res,{data:null,error:{code:'23505'}});if(input.op==='update'&&input.filters.updated_at!==row?.updated_at)return json(res,{data:null,error:null});rows.set(input.owner,input.payload);writes++;return json(res,{data:{updated_at:input.payload.updated_at},error:null});});return;}
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
 await desktop.getByTitle('Two panels side by side',{exact:true}).click();await desktop.waitForTimeout(800);assert.equal(rows.get('device-fixture').preferences.values['olisa-chart-workspace-layout'],'split-vertical');checks.push('Layout writes publish automatically without manually saving a workspace');

 await desktop.getByTitle('Saved workspaces',{exact:true}).click();await desktop.getByRole('button',{name:'Save As',exact:true}).click();await desktop.getByPlaceholder('Name this workspace').fill('Desktop saved fixture');await desktop.getByRole('button',{name:'Save As',exact:true}).last().click();
 await desktop.waitForTimeout(1200);assert.ok(JSON.parse(rows.get('device-fixture').preferences.values['kwantdesk-chart-workspace-presets']||'[]').some(p=>p.name==='Desktop saved fixture'),'saved workspace reaches cloud before phone');
 await phone.goto(origin+'/?owner=device-fixture');await phone.locator('[data-chart-workspace-scope="charts"] canvas').first().waitFor({timeout:45000});await phone.waitForTimeout(2200);
 const stored=await phone.evaluate(()=>JSON.parse(localStorage.getItem('kwantdesk-chart-workspace-presets')||'[]'));console.log(JSON.stringify({phone:stored.map(p=>p.name),cloud:JSON.parse(rows.get('device-fixture').preferences.values['kwantdesk-chart-workspace-presets']||'[]').map(p=>p.name),errors}));
 assert.ok(stored.some(p=>p.name==='Desktop saved fixture'),'phone opening retains saved workspace');assert.ok(JSON.parse(rows.get('device-fixture').preferences.values['kwantdesk-chart-workspace-presets']||'[]').some(p=>p.name==='Desktop saved fixture'),'phone must not delete cloud library');

 await phone.evaluate(()=>window.deviceFixture.write('kwantdesk-chart-workspace-presets','[]'));
 await phone.waitForTimeout(1800);
 assert.ok(JSON.parse(rows.get('device-fixture').preferences.values['kwantdesk-chart-workspace-presets']||'[]').some(p=>p.name==='Desktop saved fixture'),'stale empty phone library cannot erase a saved workspace');
 assert.ok(await phone.evaluate(()=>JSON.parse(localStorage.getItem('kwantdesk-chart-workspace-presets')||'[]').some(p=>p.name==='Desktop saved fixture')),'phone recovers retained library');
 await desktop.getByTitle('Saved workspaces',{exact:true}).click();desktop.once('dialog',dialog=>dialog.accept());await desktop.getByLabel('Delete Desktop saved fixture',{exact:true}).click({force:true});await phone.waitForTimeout(1500);
 assert.equal(JSON.parse(rows.get('device-fixture').preferences.values['kwantdesk-chart-workspace-presets']||'[]').length,0,'explicit Delete removes the saved workspace');
 await phone.evaluate(value=>window.deviceFixture.write('kwantdesk-chart-workspace-presets',JSON.stringify(value)),stored);await phone.waitForTimeout(1500);
 assert.equal(JSON.parse(rows.get('device-fixture').preferences.values['kwantdesk-chart-workspace-presets']||'[]').length,0,'stale phone cannot undo explicit Delete');
 console.log(JSON.stringify({freshPhoneRetainsWorkspace:true,staleEmptyPhoneCannotErase:true,explicitDeleteWorks:true,stalePhoneCannotResurrect:true,errors}));
 assert.deepEqual(errors,[]);await desktopContext.close();await phoneContext.close();
 }finally{for(const peer of streams)peer.res.end();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
