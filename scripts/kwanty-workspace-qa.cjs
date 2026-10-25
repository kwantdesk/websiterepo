// Local-only synthetic UI harness. Never reads provider keys or calls production.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const root=path.resolve(__dirname,'..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'kwanty-workspace-qa-'));
const bundle=require('next/dist/compiled/webpack/webpack');
bundle.webpack({mode:'development',devtool:false,context:root,entry:path.join(root,'tests/fixtures/kwanty-workspace-qa.ts'),output:{path:output,filename:'qa-bundle.js'},resolve:{extensions:['.tsx','.ts','.js','.json'],alias:{'@':path.join(root,'src')}},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(root,'tests/fixtures/kwanty-qa-loader.cjs')}]},optimization:{minimize:false}},(error,stats)=>{
 if(error||stats.hasErrors()){console.error(error||stats.toString({all:false,errors:true}));process.exitCode=1;return;}
 const css=fs.readdirSync(path.join(root,'.next/static/chunks')).filter(name=>name.endsWith('.css'));
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let file;
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head>'+css.map(name=>'<link rel="stylesheet" href="/_next/static/chunks/'+name+'">').join('')+'</head><body style="margin:0"><script src="/qa-bundle.js"></script></body></html>');return;}
  if(url.pathname==='/qa-bundle.js')file=path.join(output,'qa-bundle.js');else if(url.pathname.startsWith('/_next/static/'))file=path.join(root,'.next',url.pathname.slice('/_next/'.length));else file=path.join(root,'public',decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)&&!file.startsWith(output+path.sep)){res.writeHead(403).end();return;}
  const type={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.ttf':'font/ttf'}[path.extname(file)]||'application/octet-stream';fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',type);res.end(data);});
 });server.listen(0,'127.0.0.1',()=>console.log('KWANTY_QA_URL=http://127.0.0.1:'+server.address().port));
});
