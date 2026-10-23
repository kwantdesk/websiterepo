// Local-only UI QA. Generated webpack output is confined to tmp/.
const path=require('node:path'),fs=require('node:fs'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/liquidity-map-trading');
require('next/dist/compiled/webpack/webpack').webpack({mode:'development',devtool:false,entry:path.join(root,'tests/fixtures/liquidity-map-trading.tsx'),output:{path:out,filename:'fixture.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:{'@':path.join(root,'src')}},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(root,'tests/fixtures/typescript-loader.cjs')}]},optimization:{minimize:false}},(error,stats)=>{
 if(error||stats.hasErrors()){console.error(error||stats.toString({all:false,errors:true}));process.exitCode=1;return;}
 const css=fs.readdirSync(path.join(root,'.next/static'),{recursive:true}).filter(p=>String(p).endsWith('.css')).map(p=>fs.readFileSync(path.join(root,'.next/static',p)));
 http.createServer((req,res)=>{
  if(req.url==='/fixture.js'){res.setHeader('Content-Type','application/javascript');return fs.createReadStream(path.join(out,'fixture.js')).pipe(res);}
  if(req.url.startsWith('/css/')){const index=Number(req.url.slice(5));if(!css[index]){res.writeHead(404);return res.end();}res.setHeader('Content-Type','text/css');return res.end(css[index]);}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<html><head><meta charset="utf-8">${css.map((_,i)=>`<link rel="stylesheet" href="/css/${i}">`).join('')}<style>:root{--background:#08090c;--foreground:#dfe4ed;--panel:#101219;--primary:#c043ff;--danger:#ff4670;--border:#343846}button{cursor:pointer}main>button{border:1px solid #343846;padding:6px 10px;margin:8px 0}h1{font-size:22px}p{margin:12px 0}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
 }).listen(4921,'127.0.0.1',()=>console.log('Isolated trading fixture ready: http://127.0.0.1:4921'));
});
