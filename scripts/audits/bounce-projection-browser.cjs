const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), http = require("node:http");
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const { chromium } = require(process.env.KWANTDESK_PLAYWRIGHT_MODULE || "playwright");
const root = process.cwd(), output = path.join(root, "tmp/bounce-projection-bundle"), stub = path.join(root, "scripts/audits/settings-navigation-next.tsx");
const config = {
  mode: "development", devtool: false, entry: path.join(root, "scripts/audits/bounce-projection-entry.tsx"),
  output: { path: output, filename: "main.js", publicPath: "/" },
  resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
    "next/link$": stub, "next/navigation$": stub, "next/dynamic$": path.join(root, "scripts/audits/phone-fixture-dynamic.tsx"),
    "@/lib/workspaceNavigationWarmup$": stub, "@/lib/rendererHealth$": stub,
    "@/components/HighImpactNewsChip$": path.join(root, "scripts/audits/phone-fixture-null.tsx"), "@": path.join(root, "src"),
  }},
  module: { rules: [{ test: /\.(tsx?|css)$/, exclude: /node_modules/, use: path.join(root, "scripts/audits/bounce-projection-loader.cjs") }] },
  optimization: { minimize: false }, plugins: [new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
};

config.resolve.alias={"@/lib/userPreferences$":path.join(root,"scripts/audits/phone-fixture-prefs.ts"),"@/lib/supabase$":path.join(root,"scripts/audits/phone-fixture-auth.ts"),...config.resolve.alias};
config.plugins.push(new webpack.DefinePlugin({"process.env":JSON.stringify({NODE_ENV:"development"})}));


async function main(){await new Promise((resolve,reject)=>{const c=webpack(config);c.run((e,s)=>c.close(()=>e||s.hasErrors()?reject(e||Error(s.toString({all:false,errors:true}))):resolve()))});
 const server=http.createServer((req,res)=>{if(req.url==='/main.js'){res.setHeader('content-type','text/javascript');return res.end(fs.readFileSync(path.join(output,'main.js')))}res.setHeader('content-type','text/html');res.end('<html><head><style>body{margin:0;background:#000;color:#fff;font:14px sans-serif}h2{font-size:16px;font-weight:400}</style></head><body><div id="root"></div><script src="/main.js"></script></body></html>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({headless:true,executablePath:process.env.KWANTDESK_CHROME_EXECUTABLE});try{const page=await browser.newPage({viewport:{width:1440,height:540}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await page.goto(origin);await page.waitForFunction(()=>window.projectionViews?.length===2&&window.projectionViews.every(v=>v.primitive.hits.length>0));
 const metrics=await page.evaluate(()=>{const [source,target]=window.projectionViews;const levels=target.snapshot.exposureField.flatMap(s=>s.nodes.map(n=>Math.abs(n.mappedPrice-n.sourceStrike*40)));const yDifferences=[];for(const hit of source.primitive.hits){const other=target.primitive.hits.find(h=>h.node.sourceStrike===hit.node.sourceStrike&&h.node.timestamp===hit.node.timestamp);if(other)yDifferences.push(Math.abs(other.y-hit.y))}return{maximumMappingError:Math.max(...levels),maximumPixelDifference:Math.max(...yDifferences),drawnHits:target.primitive.hits.length}});await page.screenshot({path:'tmp/bounce-projection-'+(process.env.BOUNCE_PROJECTION_BASELINE?'before':'after')+'.png'});
 if(process.env.BOUNCE_PROJECTION_BASELINE){assert.ok(metrics.maximumMappingError>100)}else{assert.ok(metrics.maximumMappingError<1e-8);assert.ok(metrics.maximumPixelDifference<1);await page.evaluate(()=>window.projectionViews.forEach(v=>{v.chart.timeScale().setVisibleLogicalRange({from:3,to:17});v.paint(Date.parse('2026-11-03T14:40:30Z'))}));await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>window.projectionViews.every(v=>v.snapshot.exposureField.every(s=>s.timestamp<=Date.parse('2026-11-03T14:40:30Z')))));}
 assert.deepEqual(errors,[]);const result={...metrics,errors,baseline:Boolean(process.env.BOUNCE_PROJECTION_BASELINE)};fs.writeFileSync('tmp/bounce-projection-'+(result.baseline?'before':'after')+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));}finally{await browser.close();await new Promise(r=>server.close(r));}}main().catch(e=>{console.error(e);process.exitCode=1});
