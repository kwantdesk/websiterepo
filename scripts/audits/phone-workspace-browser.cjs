const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), http = require("node:http");
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const { chromium } = require(process.env.KWANTDESK_PLAYWRIGHT_MODULE || "playwright");
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
 const css=fs.readdirSync(".next/static/chunks").filter(p=>p.endsWith(".css")).map(p=>fs.readFileSync(".next/static/chunks/"+p,"utf8")).join("\n")+fs.readFileSync("src/components/algo/algo.css","utf8");
 const phoneCss=process.env.PHONE_BASELINE?"":fs.readFileSync("src/app/phone-layout.css","utf8");
 const scrollCss=fs.readFileSync("src/app/globals.css","utf8").split("/* Keep a real plot")[1].split("/* Each chart toolbar lane")[0];
 const requests=[],errors=[],checks=[];
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,"http://localhost");
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
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await page.goto(origin+'/?surface=charts');
 await page.locator('[data-chart-workspace-scope="charts"] canvas').first().waitFor({timeout:45000});await page.waitForTimeout(1500);
 const measure=()=>page.evaluate(()=>{const p=document.querySelector('.kwant-chart-pane-content'),c=p?.querySelector('canvas');const rect=e=>e?({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}):null;return {screen:innerWidth,pane:rect(p),canvas:rect(c),topbar:rect(document.querySelector('header.kwant-command-rail')),toolbar:rect(document.querySelector('.kwant-chart-toolbar-shell')),right:rect(document.querySelector('[data-mobile-side-panel]')),overflow:document.documentElement.scrollWidth>innerWidth};});
 const before=await measure();await page.screenshot({path:'tmp/phone-'+(process.env.PHONE_BASELINE?'before':'after')+'.png'});console.log(JSON.stringify(before));
 if(!process.env.PHONE_BASELINE){
 assert.ok(before.pane.width>=385,JSON.stringify(before));assert.equal(before.topbar.height,0);assert.equal(before.toolbar.height,0);assert.equal(before.overflow,false);checks.push('390px phone gets full-width chart and no permanent desktop bars');
 await page.getByRole('button',{name:'Open workspace menu',exact:true}).click();await page.getByRole('dialog',{name:'Workspace menu'}).waitFor();assert.ok(await page.getByRole('navigation',{name:'Mobile primary workspace'}).getByRole('link',{name:'Charts',exact:true}).isVisible());checks.push('Full navigation is reachable from the pull-out side menu');
 await page.getByRole('button',{name:'Chart controls / indicators / replay',exact:true}).click();await page.waitForTimeout(100);assert.ok(await page.locator('.kwant-phone-controls-heading button').isVisible());await page.screenshot({path:'tmp/phone-controls.png'});console.log(await page.locator('.kwant-chart-actions').evaluateAll(es=>es.map(e=>({text:e.innerText,rect:e.getBoundingClientRect().toJSON(),style:getComputedStyle(e).display}))));assert.ok(await page.getByRole('button',{name:'Chart indicators',exact:true}).first().isVisible());checks.push('Actual chart controls open in a drawer without shrinking the chart');await page.locator('.kwant-phone-controls-heading button').click();
 await page.getByRole('button',{name:'Open workspace menu',exact:true}).click();await page.getByRole('button',{name:'Watchlist',exact:true}).click();assert.ok(await page.locator('[data-mobile-side-panel]').isVisible());const withPanel=await measure();assert.ok(withPanel.pane.width>=385);checks.push('Watchlist overlays the phone chart without taking its width');await page.getByRole('button',{name:'Close side panel',exact:true}).click();
 await page.getByRole('button',{name:'Open workspace menu',exact:true}).click();await page.getByRole('button',{name:'Show drawing tools',exact:true}).click();assert.ok(await page.getByRole('toolbar',{name:'Chart drawing tools'}).first().isVisible());checks.push('Drawing tools are available on demand');
 await page.getByRole('button',{name:'Open workspace menu',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog',{name:'Workspace menu'}).count(),0);checks.push('Escape closes the drawer and restores focus');
 for(const width of [320,430,740,768,1440]){await page.setViewportSize({width,height:844});await page.waitForTimeout(150);const m=await measure();assert.equal(m.overflow,false);if(width<768){assert.ok(m.pane.width>=width-5);assert.equal(m.topbar.height,0);}else{assert.ok(m.topbar.height>0);assert.ok(m.toolbar.height>0);assert.equal(await page.getByRole('button',{name:'Open workspace menu',exact:true}).isVisible(),false);}checks.push('Responsive geometry at '+width+'px');}
 await page.setViewportSize({width:1440,height:980});await page.getByTitle('Two panels side by side',{exact:true}).click();await page.waitForTimeout(300);assert.equal(await page.locator('[data-workspace-pane-id]').count(),2);
 const saved=await page.evaluate(()=>[localStorage.getItem('olisa-chart-workspace-tree'),localStorage.getItem('olisa-chart-workspace-layout')]);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open workspace menu',exact:true}).click();const choices=page.getByRole('button',{name:/^Chart [12]:/});assert.equal(await choices.count(),2);await choices.nth(1).click();await page.waitForTimeout(200);assert.equal(await page.locator('[data-workspace-pane-id]:visible').count(),1);assert.ok((await page.locator('[data-workspace-pane-id]:visible').boundingBox()).width>385);checks.push('Two desktop panes become one full-width selected phone chart');
 await page.setViewportSize({width:1440,height:980});await page.waitForTimeout(200);assert.equal(await page.locator('[data-workspace-pane-id]:visible').count(),2);assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('olisa-chart-workspace-tree'),localStorage.getItem('olisa-chart-workspace-layout')]),saved);checks.push('Returning to desktop restores both panes with byte-identical saved layout');
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(200);assert.equal(await page.locator('header.kwant-command-rail').isVisible(),false);assert.equal(await page.locator('[data-workspace-pane-id]:visible').count(),1);checks.push('Landscape touch phone retains the phone layout');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{for(const [k,v]of Object.entries({'--background':'#f8f8f8','--foreground':'#111','--primary':'#111','--on-primary':'#fff','--panel':'#fff','--surface':'#eee','--chart-background':'#fff','--border':'#ccc'}))document.documentElement.style.setProperty(k,v);});await page.getByRole('button',{name:'Open workspace menu',exact:true}).click();await page.screenshot({path:'tmp/phone-menu-light.png'});checks.push('Mobile menu uses the active light theme');await page.keyboard.press('Escape');
 await page.setViewportSize({width:1440,height:980});await page.screenshot({path:'tmp/phone-desktop-after.png'});
 }
 if(!process.env.PHONE_BASELINE){await page.setViewportSize({width:390,height:844});for(const label of ['News','Journal','Backtesting']){await page.getByRole('button',{name:'Open workspace menu',exact:true}).click();await page.getByRole('navigation',{name:'Mobile primary workspace'}).getByRole('link',{name:label,exact:true}).click();await page.waitForTimeout(800);assert.equal(await page.locator('header.kwant-command-rail').isVisible(),false);assert.equal(await page.getByText(/paused safely/).count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'tmp/phone-'+label.toLowerCase()+'.png'});checks.push(label+': mobile route navigation and full-width shell');}}
 assert.deepEqual(errors,[]);fs.writeFileSync('tmp/phone-audit-'+(process.env.PHONE_BASELINE?'before':'after')+'.json',JSON.stringify({checks,errors,geometry:before,externalRequests:0},null,2));console.log(JSON.stringify({checks,errors},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});