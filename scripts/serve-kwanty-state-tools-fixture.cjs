// Actual shared React drawing engine + actual State app, entirely synthetic.
const path=require('node:path'),fs=require('node:fs'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/kwanty-state-tools');
require('next/dist/compiled/webpack/webpack').webpack({mode:'development',devtool:false,entry:path.join(root,'tests/fixtures/kwanty-state-tools.tsx'),output:{path:out,filename:'fixture.js',publicPath:'/'},resolve:{extensions:['.tsx','.ts','.js'],alias:{'@':path.join(root,'src')}},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(root,'tests/fixtures/typescript-loader.cjs')}]},optimization:{minimize:false}},(error,stats)=>{
 if(error||stats.hasErrors()){console.error(error||stats.toString({all:false,errors:true}));process.exitCode=1;return;}
 const staticRoot=path.join(root,'public'),cssRoot=path.join(root,'.next/static');
 const css=fs.existsSync(cssRoot)?fs.readdirSync(cssRoot,{recursive:true}).filter(p=>String(p).endsWith('.css')).map(p=>fs.readFileSync(path.join(cssRoot,p))):[];
 http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  if(pathname==='/'){
   const html=fs.readFileSync(path.join(root,'tests/fixtures/kwanty-state-panels.html'),'utf8')
    .replace('<script>','<script src="/fixture.js"></script><script>')
    .replace('window.__kwantyHost={active:true','window.__kwantyHost={mountStateDrawings:window.mountFixtureStateTools,active:true')
    .replace('State panels · synthetic data, isolated settings','State drawing tools · synthetic data, isolated settings')
    .replace('<button id="reload">','<button id="futures">Synthetic futures profile</button><button id="reload">')
    .replace("tickers:['NDX','QQQ','SPX','SPY']","tickers:['ES_SPX','NDX','QQQ','SPX','SPY']")
    .replace('</script></body>',`document.querySelector('#futures').onclick=()=>{const next=JSON.parse(store.get('kwanty:v1'));next.statePanels[0].ticker='ES_SPX';store.set('kwanty:v1',JSON.stringify(next));document.querySelector('iframe').contentWindow.location.reload();};</script></body>`)
    .replace('</head>',css.map((_,i)=>'<link rel="stylesheet" href="/css/'+i+'">').join('')+'<style>:root{--background:#07090d;--panel:#0b0f16;--foreground:#e8edf5;--muted:#8e9db5;--primary:#55bdff;--border:#29364b;--surface:#192334;--danger:#e97995}</style></head>');
   res.setHeader('Content-Type','text/html');return res.end(html);
  }
  if(pathname.startsWith('/css/')){res.setHeader('Content-Type','text/css');return res.end(css[Number(pathname.slice(5))]||'');}
  const file=pathname.endsWith('.js')&&!pathname.startsWith('/kwanty-app/')&&!pathname.startsWith('/gex-data-app/')&&!pathname.startsWith('/workspace-')?path.join(out,path.basename(pathname)):path.resolve(staticRoot,'.'+decodeURIComponent(pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res);
 }).listen(4925,'127.0.0.1',()=>console.log('Isolated State drawing tools: http://127.0.0.1:4925'));
});
