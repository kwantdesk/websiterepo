// Local-only UI acceptance fixture; no provider calls or owner storage.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const root=path.resolve(__dirname,'..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'drawing-hit-qa-'));
const bundle=require('next/dist/compiled/webpack/webpack');
bundle.webpack({mode:'development',devtool:false,context:root,entry:path.join(root,'tests/fixtures/drawing-hit-qa.tsx'),output:{path:output,filename:'qa-bundle.js'},resolve:{extensions:['.tsx','.ts','.js','.json'],alias:{'@':path.join(root,'src')}},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(root,'tests/fixtures/kwanty-qa-loader.cjs')}]},optimization:{minimize:false}},(error,stats)=>{
 if(error||stats.hasErrors()){console.error(error||stats.toString({all:false,errors:true}));process.exitCode=1;return;}
 const server=http.createServer((req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><style>body{margin:0}button{padding:12px;background:#164963;color:white;border:1px solid #39d8ff;border-radius:6px}.absolute{position:absolute}.inset-0{inset:0}.z-\\[24\\]{z-index:24}h2{font-size:16px}</style></head><body><script src="/qa-bundle.js"></script></body></html>');return;}if(req.url==='/qa-bundle.js'){res.setHeader('Content-Type','text/javascript');fs.createReadStream(path.join(output,'qa-bundle.js')).pipe(res);return;}res.writeHead(404).end();});
 server.listen(0,'127.0.0.1',()=>console.log('DRAWING_HIT_QA_URL=http://127.0.0.1:'+server.address().port));
});
