// Static, loopback-only fixture. No provider/API/account writes or subscriptions.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),publicRoot=path.join(root,'public');
http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 const file=pathname==='/'?path.join(root,'tests/fixtures/kwanty-state-axes.html'):path.resolve(publicRoot,'.'+decodeURIComponent(pathname));
 if(pathname!=='/'&&!file.startsWith(publicRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');
 res.end(fs.readFileSync(file));
}).listen(4924,'127.0.0.1',()=>console.log('State axes isolated QA: http://127.0.0.1:4924'));
