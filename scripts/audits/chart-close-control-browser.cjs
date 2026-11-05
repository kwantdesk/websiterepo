const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), http = require("node:http");
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const { chromium } = require(process.env.KWANTDESK_PLAYWRIGHT_MODULE || path.join(process.cwd(),'tmp/chart-lock-browser/node_modules/playwright-core'));
const root = process.cwd(), output = path.join(root, "tmp/phone-workspace-browser-bundle"), stub = path.join(root, "scripts/audits/phone-fixture-next.tsx");
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
 const cssRoot=process.env.CHART_CLOSE_CSS_ROOT||".next/static/chunks"; const css=fs.readdirSync(cssRoot).filter(p=>p.endsWith(".css")).map(p=>fs.readFileSync(path.join(cssRoot,p),"utf8")).join("\n")+fs.readFileSync("src/components/algo/algo.css","utf8");
 const phoneCss=process.env.PHONE_BASELINE?"":fs.readFileSync("src/app/phone-layout.css","utf8");
 const scrollCss="";
 const requests=[],errors=[],checks=[];
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,"http://localhost");
  if(u.pathname.startsWith('/fonts/')){const f=path.join(root,'public',u.pathname);if(fs.existsSync(f)){res.setHeader('content-type',f.endsWith('.css')?'text/css':'font/ttf');return res.end(fs.readFileSync(f));}}
  if(u.pathname==="/styles.css"){res.setHeader("content-type","text/css");return res.end(css+phoneCss+"\n@font-face{font-family:Aleph;src:url(/fonts/aleph/Aleph-Regular.ttf)}body{font-family:Aleph,sans-serif}");}
  if(u.pathname==="/api/cme-history"){requests.push(u.search);res.setHeader("content-type","application/json");return res.end(JSON.stringify({candles:candles(u),executions:[],configured:true,source:"Isolated fixture"}));}
  if(u.pathname.startsWith("/api/")){res.setHeader("content-type","application/json");return res.end("{}");}
  const p=path.join(output,u.pathname);if(p.startsWith(output)&&fs.existsSync(p)&&fs.statSync(p).isFile()){res.setHeader("content-type","text/javascript");return res.end(fs.readFileSync(p));}
  res.setHeader("content-type","text/html;charset=utf-8");res.end('<html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/styles.css"><style>:root{--background:#000;--foreground:#fff;--primary:#a779ff;--on-primary:#000;--muted:#aaa;--border:#333;--panel:#080808;--surface:#181818;--chart-background:#000}html,body,#root{height:100%;margin:0}</style></head><body><div id="root"></div><script src="/main.js"></script></body></html>');
 });
 await new Promise(r=>server.listen(0,"127.0.0.1",r));const origin="http://127.0.0.1:"+server.address().port;
 const browser=await chromium.launch({headless:true,ignoreDefaultArgs:["--hide-scrollbars"],executablePath:process.env.KWANTDESK_CHROME_EXECUTABLE,args:["--enable-unsafe-swiftshader"]});


 try{
 const page=await browser.newPage({viewport:{width:1440,height:950}});page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await page.goto(origin+'/?surface=charts');await page.locator('[data-chart-workspace-scope="charts"] canvas').first().waitFor({timeout:45000});await page.waitForTimeout(900);
 await page.getByTitle('Two panels side by side',{exact:true}).click();await page.waitForTimeout(300);
 const area=page.locator('[data-chart-workspace-scope="charts"]');
 const verify=async(floating=false)=>{const selector=floating?'[data-floating-workspace-pane-id] .kwant-workspace-pane-header':'.kwant-chart-pane-scrollport > .kwant-workspace-pane-header';const headers=page.locator(selector);const results=[];for(let i=0;i<await headers.count();i++){const h=headers.nth(i);if(!await h.isVisible())continue;for(const fraction of [0,.5,1]){await h.evaluate((el,f)=>{el.scrollLeft=(el.scrollWidth-el.clientWidth)*f},fraction);const info=await h.evaluate(el=>{const button=el.querySelector('.kwant-chart-close-control'),r=button.getBoundingClientRect(),h=el.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {left:r.left,right:r.right,headerLeft:h.left,headerRight:h.right,hit:button===top||button.contains(top),disabled:button.disabled,top:top?.outerHTML?.slice(0,250),y:r.y,headerY:h.y};});assert.ok(info.left>=info.headerLeft&&info.right<=info.headerRight+1,'X remains inside narrow chart at scroll '+fraction);assert.ok(Math.abs(info.right-info.headerRight)<14,'X remains at right edge');if(!info.hit){console.log(JSON.stringify({floating,i,fraction,info}));await page.screenshot({path:'tmp/chart-close-failed.png'});}assert.ok(info.hit,'X is clickable above scrolled controls');results.push(info);}}return results;};
 for(const width of [1100,800,600,400]){await area.evaluate((el,w)=>{el.style.width=w+'px';el.style.maxWidth=w+'px'},width);await page.waitForTimeout(200);await verify();checks.push('Docked headers stay reachable across scroll positions at workspace width '+width);}
 await page.setViewportSize({width:390,height:844});await area.evaluate(el=>{el.style.width='';el.style.maxWidth=''});await page.waitForTimeout(200);await verify();checks.push('Phone header retains the visible X while other controls scroll');await page.setViewportSize({width:1440,height:950});await area.evaluate(el=>{el.style.width='400px';el.style.maxWidth='400px'});await page.waitForTimeout(200);
 const count=await page.locator('[data-workspace-pane-id]').count();await page.getByLabel('Close chart',{exact:true}).first().click();await page.waitForTimeout(250);assert.equal(await page.locator('[data-workspace-pane-id]').count(),count-1);checks.push('Pinned X actually closes the selected docked chart');
 await area.evaluate(el=>{el.style.width='800px';el.style.maxWidth='800px'});await page.getByTitle('Two panels side by side',{exact:true}).click();await page.waitForTimeout(250);await page.getByLabel('Detach chart',{exact:true}).first().click();const floating=page.locator('[data-floating-workspace-pane-id]');await floating.waitFor();await floating.evaluate(el=>{el.style.width='240px';el.style.height='400px';el.style.left='20px';el.style.top='20px'});await page.waitForTimeout(250);await verify(true);await page.screenshot({path:'tmp/chart-close-pinned.png'});await page.getByLabel('Close floating panel',{exact:true}).click();await page.waitForTimeout(200);assert.equal(await page.locator('[data-floating-workspace-pane-id]').count(),0);checks.push('Floating chart X stays visible at 240px and closes its panel');assert.deepEqual(errors,[]);fs.writeFileSync('tmp/chart-close-results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});