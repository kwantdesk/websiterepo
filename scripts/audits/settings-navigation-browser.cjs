const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), http = require("node:http");
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const { chromium } = require(process.env.KWANTDESK_PLAYWRIGHT_MODULE || "playwright");
const root = process.cwd(), output = path.join(root, "tmp/settings-navigation-bundle"), stub = path.join(root, "scripts/audits/settings-navigation-next.tsx");
const config = {
  mode: "development", devtool: false, entry: path.join(root, "scripts/audits/settings-navigation-entry.tsx"),
  output: { path: output, filename: "main.js", publicPath: "/" },
  resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
    "next/link$": stub, "next/navigation$": stub, "next/dynamic$": path.join(root, "scripts/audits/phone-fixture-dynamic.tsx"),
    "@/lib/workspaceNavigationWarmup$": stub, "@/lib/rendererHealth$": stub,
    "@/components/HighImpactNewsChip$": path.join(root, "scripts/audits/phone-fixture-null.tsx"), "@": path.join(root, "src"),
  }},
  module: { rules: [{ test: /\.(tsx?|css)$/, exclude: /node_modules/, use: path.join(root, "scripts/audits/settings-navigation-loader.cjs") }] },
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
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,"http://localhost");
  if(u.pathname.startsWith('/fonts/')){const f=path.join(root,'public',u.pathname);if(fs.existsSync(f)){res.setHeader('content-type',f.endsWith('.css')?'text/css':'font/ttf');return res.end(fs.readFileSync(f));}}
  if(u.pathname==="/styles.css"){res.setHeader("content-type","text/css");return res.end(css+"\n/* Keep a real plot"+scrollCss+phoneCss+"\n@font-face{font-family:Aleph;src:url(/fonts/aleph/Aleph-Regular.ttf)}body{font-family:Aleph,sans-serif}");}
  if(u.pathname==="/api/cme-history"){requests.push(u.search);res.setHeader("content-type","application/json");return res.end(JSON.stringify({candles:candles(u),executions:[],configured:true,source:"Isolated fixture"}));}
  if(u.pathname==='/api/friends'){res.setHeader('content-type','application/json');return setTimeout(()=>res.end('{}'),4000);}
  if(u.pathname.startsWith("/api/")){res.setHeader("content-type","application/json");return res.end("{}");}
  const p=path.join(output,u.pathname);if(p.startsWith(output)&&fs.existsSync(p)&&fs.statSync(p).isFile()){res.setHeader("content-type","text/javascript");return res.end(fs.readFileSync(p));}
  res.setHeader("content-type","text/html;charset=utf-8");const html='<html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/styles.css"><style>:root{--background:#000;--foreground:#fff;--primary:#a779ff;--on-primary:#000;--muted:#aaa;--border:#333;--panel:#080808;--surface:#181818;--chart-background:#000}html,body,#root{height:100%;margin:0}</style></head><body><div id="root"></div><script src="/main.js"></script></body></html>';if(u.pathname==='/settings')setTimeout(()=>res.end(html),4000);else res.end(html);
 });
 await new Promise(r=>server.listen(0,"127.0.0.1",r));const origin="http://127.0.0.1:"+server.address().port;
 const browser=await chromium.launch({headless:true,ignoreDefaultArgs:["--hide-scrollbars"],executablePath:process.env.KWANTDESK_CHROME_EXECUTABLE,args:["--enable-unsafe-swiftshader"]});

 try{
 const page=await browser.newPage({viewport:{width:1440,height:980},hasTouch:true});let settingsDocuments=0;page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR',e.stack)});page.on('request',r=>{if(r.isNavigationRequest()&&new URL(r.url()).pathname==='/settings')settingsDocuments++;});await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await page.goto(origin+'/charts');await page.locator('[data-chart-workspace-scope="charts"] canvas').first().waitFor({timeout:45000});
 let opened=true;const start=Date.now();await page.getByRole('link',{name:'Settings',exact:true}).click();await page.getByRole('heading',{name:'Identity',exact:true}).waitFor({timeout:10000}).catch(error=>{if(!process.env.SETTINGS_NAV_BASELINE)throw error;opened=false;});if(!opened){const result={opened:false,waitedMs:Date.now()-start,settingsDocuments,url:new URL(page.url()).pathname,errors};console.log(JSON.stringify(result,null,2));fs.writeFileSync('tmp/settings-navigation-baseline.json',JSON.stringify(result,null,2));return;}const openingMs=Date.now()-start;assert.equal(new URL(page.url()).pathname,'/settings');assert.deepEqual(errors,[]);
 if(!process.env.SETTINGS_NAV_BASELINE){assert.equal(settingsDocuments,0);assert.ok(openingMs<1500);await page.getByRole('button',{name:'Chart defaults',exact:true}).click();await page.getByRole('heading',{name:'Chart defaults',exact:true}).waitFor();await page.getByRole('link',{name:'Charts',exact:true}).click();await page.locator('[data-chart-workspace-scope="charts"] canvas').first().waitFor({timeout:10000});await page.getByRole('link',{name:'Settings',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('heading',{name:'Chart defaults',exact:true}).waitFor({timeout:10000});await page.goBack();await page.locator('[data-chart-workspace-scope="charts"] canvas').first().waitFor({timeout:10000});await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open workspace menu',exact:true}).click();await page.getByRole('link',{name:'Settings',exact:true}).tap();await page.getByRole('heading',{name:'Chart defaults',exact:true}).waitFor({timeout:10000});assert.equal(settingsDocuments,0);}
 assert.deepEqual(errors,[]);const result={openingMs,settingsDocuments,errors,mode:process.env.SETTINGS_NAV_BASELINE?'old server-route path':'client workspace switch',blockedRouteDelayMs:4000};console.log(JSON.stringify(result,null,2));fs.writeFileSync('tmp/settings-navigation-'+(process.env.SETTINGS_NAV_BASELINE?'baseline':'fixed')+'.json',JSON.stringify(result,null,2));await page.screenshot({path:'tmp/settings-navigation.png'});
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
