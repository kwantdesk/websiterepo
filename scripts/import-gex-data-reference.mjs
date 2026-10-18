// Mechanical import of the owner's local prototype, not its server or secrets.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const source=process.argv[2];
if(!source||!fs.existsSync(path.join(source,'public/workspace-model.js')))throw Error('Supply the owned quantpage directory');
if(process.argv.includes('--finish-css')){for(const name of ['styles.css','workspace.css','filter-editor.css']){const file=path.resolve('public/gex-data-app',name);fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/(:\s*)white\b/g,'$1var(--site-foreground)').replace(/(:\s*)black\b/g,'$1var(--site-background)'));}process.exit(0);}
if(process.argv.includes('--tests-only')){
  const directory=path.resolve('tests/gex-data-reference');fs.mkdirSync(directory,{recursive:true});
  for(const name of ['chart-interaction-model','equity-charts','exposure-models','filter-editor-model','market-map-interaction-model','number-format','options-models','preferences-model','snapshot-model','table-view','time-axis','workspace-model']){
    const text=fs.readFileSync(path.join(source,'tests',name+'.test.mjs'),'utf8').replaceAll('../public/','../../public/gex-data-app/');fs.writeFileSync(path.join(directory,name+'.test.mjs'),text);
  }process.exit(0);
}
const target=path.resolve('public/gex-data-app');
if(fs.existsSync(path.join(target,'app.js'))&&!process.argv.includes('--overwrite-integrated-code'))throw Error('One-time import only: integration fixes already exist. Explicit overwrite would discard them.');
fs.mkdirSync(target,{recursive:true});
const names=fs.readdirSync(path.join(source,'public')).filter(name=>/\.(js|css|html)$/.test(name));
const colors=new Set();
for(const name of names){
  let text=fs.readFileSync(path.join(source,'public',name),'utf8')
    .replaceAll('/quantpage','/gex-data-app/index.html').replaceAll('/api/quantdata/','/api/gex-data/').replaceAll('/api/status','/api/gex-data/status')
    .replaceAll('/api/archive','/api/gex-data/archive').replaceAll('quantpage','gex-data').replaceAll('QUANTPAGE','GEX DATA').replaceAll('Quantpage','GEX DATA')
    .replaceAll('QuantData','market-data').replaceAll('KES Board','Overview').replaceAll('KES Layout','Overview').replaceAll('local KES','overview')
    .replaceAll('Inter,','Aleph,').replaceAll('Inter;','Aleph;').replaceAll('Inter,sans','Aleph,sans').replaceAll('v=34','v=1');
  if(name.endsWith('.js')){
    const ast=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),edits=[];
    const visit=node=>{
      if(ts.isStringLiteral(node)&&/^(#[\da-f]{3,8}|(?:rgba?|hsla?)\([^)]+\)|white|black)$/i.test(node.text)){
        const expression=`themePaint(${JSON.stringify(node.text)})`;
        if(ts.isPropertyAssignment(node.parent)&&node.parent.initializer===node&&!node.parent.name.getText(ast).includes('['))
          edits.push([node.parent.getStart(ast),node.parent.end,`get ${node.parent.name.getText(ast)}(){return ${expression};}`]);
        else edits.push([node.getStart(ast),node.end,expression]);
      }
      if(ts.isIdentifier(node)&&['localStorage','sessionStorage'].includes(node.text))edits.push([node.getStart(ast),node.end,'gexStorage']);
      ts.forEachChild(node,visit);
    };visit(ast);
    for(const [start,end,replacement]of edits.sort((a,b)=>b[0]-a[0]))text=text.slice(0,start)+replacement+text.slice(end);
    text=`import {themePaint} from './site-theme.js?v=1';\nimport {gexStorage} from './site-runtime.js?v=1';\n`+text;
  }
  if(name.endsWith('.css')){
    text=text.replace(/^@font-face[^\n]+\n/,'');
    text=text.replace(/#[\da-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi,color=>{colors.add(color);return `var(--gex-${Buffer.from(color).toString('hex')})`;});
    text=text.replaceAll('color-scheme: dark;','color-scheme: light dark;');
  }
  if(name==='index.html')text=text.replace('</head>','<link rel="stylesheet" href="/gex-data-app/site.css?v=1">\n<script type="module" src="/gex-data-app/site-runtime.js?v=1"></script>\n</head>').replaceAll('href="/gex-data-app/index.html/','href="/gex-data-app/').replaceAll('src="/gex-data-app/index.html/','src="/gex-data-app/');
  fs.writeFileSync(path.join(target,name),text);
}
fs.writeFileSync(path.join(target,'site-colors.json'),JSON.stringify([...colors]));
console.log(`Imported ${names.length} owned UI modules; no server, credentials or reference font copied.`);
