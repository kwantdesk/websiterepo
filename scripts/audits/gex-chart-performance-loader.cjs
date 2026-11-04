const ts=require('typescript');
module.exports=function(source){
 if(this.resourcePath.endsWith('.css'))return 'module.exports = {};';
 if(this.resourcePath.endsWith('WorkspaceGexMapPane.tsx')&&process.env.GEX_PERF_BASELINE){
  source=source.replace('export default memo(WorkspaceGexMapPane);','export default WorkspaceGexMapPane;')
   .replace('onStateChange={handleStateChange}','onStateChange={(state) => onStateChange(paneId, state)}');
 }
 if(this.resourcePath.endsWith('GexMapWorkspace.tsx')){
  const file=ts.createSourceFile('surface.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),positions=[];
  for(const node of file.statements)if(ts.isFunctionDeclaration(node)&&['GexMapWorkspace','ExposurePanel'].includes(node.name?.text))positions.push([node.body.getStart(file)+1,node.name.text]);
  for(const [pos,name]of positions.sort((a,b)=>b[0]-a[0]))source=source.slice(0,pos)+`;globalThis.__gexRenders??={};globalThis.__gexRenders.${name}=(globalThis.__gexRenders.${name}||0)+1;`+source.slice(pos);
 }
 return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
};
