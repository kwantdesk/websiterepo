const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), http = require("node:http");
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const { chromium } = require(process.env.KWANTDESK_PLAYWRIGHT_MODULE || "playwright");
const root = process.cwd(), output = path.join(root, "tmp/phone-menu-contrast-bundle"), stub = path.join(root, "scripts/audits/settings-navigation-next.tsx");
const config = {
  mode: "development", devtool: false, entry: path.join(root, "scripts/audits/phone-menu-contrast-entry.tsx"),
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

async function main(){
 await new Promise((resolve,reject)=>{const c=webpack(config);c.run((e,s)=>c.close(()=>e||s.hasErrors()?reject(e||Error(s.toString({all:false,errors:true}))):resolve()));});
 const css=fs.readdirSync('.next/static/chunks').filter(x=>x.endsWith('.css')).map(x=>fs.readFileSync('.next/static/chunks/'+x,'utf8')).join('\n')+'\n'+fs.readFileSync('src/app/phone-layout.css','utf8');
 const server=http.createServer((req,res)=>{if(req.url==='/main.js'){res.setHeader('content-type','text/javascript');return res.end(fs.readFileSync(path.join(output,'main.js')))}res.setHeader('content-type','text/html');res.end('<html><head><meta name="viewport" content="width=device-width"><style>'+css+'</style></head><body class="kwant-cockpit-ui"><div id="root"></div><script src="/main.js"></script></body></html>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.KWANTDESK_CHROME_EXECUTABLE});try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('button',{name:'Open workspace menu'}).tap();
 const themes=await page.evaluate(()=>[...window.menuThemes,{name:'Custom black-on-black',colors:{panel:'#000000',foreground:'#000000',primary:'#000000',muted:'#000000',border:'#000000'}},{name:'Custom white-on-white',colors:{panel:'#ffffff',foreground:'#ffffff',primary:'#ffffff',muted:'#ffffff',border:'#ffffff'}}]);const results=[];
 for(const theme of themes){await page.evaluate(colors=>window.setMenuTheme(colors),theme.colors);await page.waitForTimeout(25);const result=await page.evaluate(()=>{
 const rgb=value=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3)};const lum=value=>rgb(value).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);const ratio=(a,b)=>{a=lum(a);b=lum(b);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};const background=node=>{for(let n=node;n;n=n.parentElement){const color=getComputedStyle(n).backgroundColor;if(color!=='rgba(0, 0, 0, 0)'&&color!=='transparent')return color}return '#000'};
 return [...document.querySelectorAll('.kwant-phone-menu-trigger,.kwant-phone-menu-trigger svg,.kwant-phone-navigation nav a,.kwant-phone-navigation nav a span,.kwant-phone-navigation nav a svg,.kwant-phone-menu-actions > button,.kwant-phone-menu-actions h2,.kwant-phone-drawer-heading strong,.kwant-phone-drawer-heading button')].map(n=>({label:n.textContent||n.getAttribute('aria-label')||n.tagName,color:getComputedStyle(n).color,background:background(n),ink:getComputedStyle(n).getPropertyValue("--phone-menu-ink"),ratio:ratio(getComputedStyle(n).color,background(n))}));});
 if(result.some(x=>x.ratio<4.49))await page.screenshot({path:"tmp/phone-menu-contrast-failed.png"});for(const item of result)assert.ok(item.ratio>=4.49,theme.name+': '+JSON.stringify(item));results.push({theme:theme.name,minimumContrast:Math.min(...result.map(x=>x.ratio)),elements:result.length});if(['Mono Protocol','Inverted Mono'].includes(theme.name))await page.screenshot({path:'tmp/phone-menu-'+theme.name.toLowerCase().replaceAll(' ','-')+'.png'});
 }
 await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);await page.getByRole('button',{name:'Open workspace menu'}).tap();await page.getByRole('button',{name:'Workspace',exact:true}).tap();assert.equal(await page.getByRole('dialog').count(),0);await page.setViewportSize({width:1440,height:980});assert.equal(await page.getByRole('button',{name:'Open workspace menu'}).isVisible(),false);assert.deepEqual(errors,[]);fs.writeFileSync('tmp/phone-menu-contrast.json',JSON.stringify({results,errors,desktopUnchanged:true},null,2));console.log(JSON.stringify({themes:results.length,minimumContrast:Math.min(...results.map(x=>x.minimumContrast)),errors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}}
 main().catch(e=>{console.error(e);process.exitCode=1});
