const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), http = require("node:http");
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const { chromium } = require(path.resolve("tmp/chart-lock-browser/node_modules/playwright-core"));
const root = process.cwd(), output = path.join(root, "tmp/journal-import-duplicates-bundle"), stub = path.join(root, "tmp/algo-fixture-next.tsx");
const config = {
  mode: "development", devtool: false, entry: path.join(root, "tmp/journal-archive-entry.tsx"),
  output: { path: output, filename: "main.js", publicPath: "/" },
  resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
    "next/link$": stub, "next/navigation$": stub, "next/dynamic$": path.join(root, "tmp/algo-fixture-dynamic.tsx"),
    "@/lib/workspaceNavigationWarmup$": stub, "@/lib/rendererHealth$": stub,
    "@/components/HighImpactNewsChip$": path.join(root, "tmp/algo-fixture-null.tsx"), "@": path.join(root, "src"),
  }},
  module: { rules: [{ test: /\.(tsx?|css)$/, exclude: /node_modules/, use: path.join(root, "tmp/algo-fixture-loader.cjs") }] },
  optimization: { minimize: false }, plugins: [new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
};

config.resolve.alias={"@/lib/userPreferences$":path.join(root,"tmp/algo-real-prefs-stub.ts"),"@/lib/supabase$":path.join(root,"tmp/algo-real-auth-stub.ts"),...config.resolve.alias};
config.plugins.push(new webpack.DefinePlugin({"process.env":JSON.stringify({NODE_ENV:"development"})}));
async function main(){
if(!process.env.JOURNAL_REUSE)await new Promise((resolve,reject)=>{const c=webpack(config);c.run((e,s)=>{const err=e||(s.hasErrors()?Error(s.toString({all:false,errors:true})):null);c.close(()=>err?reject(err):resolve());});});
const css=fs.readdirSync('../kwantdesk-position-viewport-release/.next/static/css').filter(p=>p.endsWith('.css')).map(p=>fs.readFileSync('../kwantdesk-position-viewport-release/.next/static/css/'+p,'utf8')).join('\n');
const server=http.createServer((req,res)=>{if(req.url==='/main.js'){res.setHeader('content-type','text/javascript');return res.end(fs.readFileSync(path.join(output,'main.js')));}res.setHeader('content-type','text/html;charset=utf-8');res.end('<html><head><style>'+css+':root{--background:#000;--foreground:#fff;--primary:#ccc;--muted:#999;--border:#333;--surface:#141414;--panel:#080808}body{background:#000;color:#fff}</style></head><body><div id="root"></div><script src="/main.js"></script></body></html>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());

const account=(name,id)=>({id,name,source:'manual',createdAt:'2026-10-20T00:00:00Z',updatedAt:'2026-10-20T00:00:00Z'});
const original={id:'paper:original',account:'20 October',openedAt:'2026-10-20T14:05:00Z',closedAt:'2026-10-20T14:06:00Z',symbol:'NQ',side:'LONG',quantity:2,entryPrice:28500,exitPrice:28505,grossPnl:200,fees:4,netPnl:196,initialRisk:100,rMultiple:1.96,durationMs:60000,setup:'Breakout',tags:['NY'],notes:'Original review note',rating:null,reviewedAt:null,sourceImportId:'paper:batch',sourceFile:'Paper Trading',sourceRows:[],fingerprint:'original'};
const extra={...original,id:'paper:extra',symbol:'ES',netPnl:72,fingerprint:'extra'};const accounts=[account('20 October','paper-20-october'),account('Review Journal','new-journal')],trades=[original,extra,{...original,id:'different-file-import',account:'Review Journal',sourceImportId:'file:old'}];
await page.route(origin+'/api/**',async route=>{
 const req=route.request(),url=new URL(req.url());
 let result={cloud:true};
 if(url.pathname==='/api/journal'){
  if(req.method()==='GET') result={cloud:true,accounts,trades,imports:[],evidence:[]};
  else if(req.method()==='DELETE'){assert.equal(url.searchParams.get('tradeId'),'journal-copy:test');trades.splice(2,1);result.deleted=true;}
  else {
   const body=req.postDataJSON();
   if(body.action==='create-account'){assert.equal(body.account,'Review Journal');const journal=account(body.account,'new-journal');accounts.push(journal);result.account=journal;}
   if(body.action==='rename-account'){assert.equal(body.accountId,'new-journal');accounts[1].name=body.newName;result.account=accounts[1];}
   if(body.action==='copy-trades'){assert.equal(body.accountId,'new-journal');assert.deepEqual(body.tradeIds,[extra.id]);const copy={...extra,account:accounts[1].name,id:'journal-copy:extra',sourceImportId:'journal-copy:extra',journalCopy:{originalTradeId:extra.id,sourceJournal:extra.account,importedAt:new Date().toISOString()}};trades.push(copy);result.trades=[copy];}
  }
 }
 await route.fulfill({json:result});
});
try{
await page.goto(origin);
const journals=page.getByLabel('Journal accounts',{exact:true});
await journals.getByText('20 October',{exact:true}).waitFor();
await journals.getByText('Review Journal',{exact:true}).click();
await page.getByRole('button',{name:'Import',exact:true}).first().click();
const picker=page.getByRole('dialog',{name:'Import into Review Journal'});
assert.equal(await picker.getByRole('checkbox',{name:/NQ.*20 October/}).count(),0,'same outcome with different file row id must not be offered');
await picker.getByRole('checkbox',{name:/ES.*20 October/}).check();
const search=picker.getByRole('textbox',{name:'Search recorded trades'});await search.fill('NQ');assert.equal(await picker.getByRole('checkbox').count(),0);await search.fill('');assert.equal(await picker.getByRole('checkbox',{name:/ES/}).isChecked(),true,'search must retain eligible selections');
await picker.getByRole('button',{name:/Import 1 trades/}).click();
await page.getByText('1 trade imported into Review Journal.',{exact:true}).waitFor();
await page.getByRole('button',{name:'Import',exact:true}).first().click();await picker.waitFor();
assert.equal(await picker.getByRole('checkbox').count(),0,'imported trades disappear when reopening');
assert.equal(await picker.getByRole('button',{name:/Import.*trades/}).isDisabled(),true);
await picker.getByRole('button',{name:'Close import',exact:true}).click();await page.reload();await journals.getByText('Review Journal',{exact:true}).click();await page.getByRole('button',{name:'Import',exact:true}).first().click();await picker.waitFor();assert.equal(await picker.getByRole('checkbox').count(),0,'duplicates stay excluded after reload');
await page.screenshot({path:'tmp/journal-import-duplicates.png'});
assert.deepEqual(errors,[]);
console.log('Browser passed: different-id existing trade hidden, eligible trade selectable, search retains selection, import removes candidate, disabled empty submit and reload exclusion.');
}catch(e){console.log(errors);console.log((await page.locator('body').innerText()).slice(-1900));throw e;}finally{await browser.close();server.close();}}
main().catch(e=>{console.error(e);process.exitCode=1});


