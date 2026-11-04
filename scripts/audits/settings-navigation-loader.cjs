const ts=require('typescript');module.exports=function(source){
 if(this.resourcePath.endsWith('.css'))return 'module.exports = {};';
 if(process.env.SETTINGS_NAV_BASELINE&&this.resourcePath.endsWith('AppSidebar.tsx'))source=source
  .replace(/const PERSISTENT_WORKSPACE_KEYS = new Set<SidebarKey>\(\[\s*"settings",/,'const PERSISTENT_WORKSPACE_KEYS = new Set<SidebarKey>([')
  .replace(/if \(navigationMode === "persistent" && key === "settings"[^)]*\)/,'if (false)');
 return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
};
