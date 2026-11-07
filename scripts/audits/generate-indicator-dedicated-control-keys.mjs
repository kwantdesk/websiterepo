import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync('src/components/ChartIndicatorsControl.tsx','utf8');
const file=ts.createSourceFile('control.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const result={};
const configText=fs.readFileSync('src/lib/chartIndicatorConfig.ts','utf8');
const configFile=ts.createSourceFile('config.ts',configText,ts.ScriptTarget.Latest,true);
let profileIds=[];function findProfiles(n){if(ts.isVariableDeclaration(n)&&n.name.getText(configFile)==='VOLUME_PROFILE_INDICATOR_IDS')profileIds=Function('return ('+n.initializer.arguments[0].getText(configFile)+')')();ts.forEachChild(n,findProfiles);}findProfiles(configFile);
const idsFrom=n=>{const text=n.getText(file);return [...new Set([...text.matchAll(/settingsDefinition\.id\s*===\s*"([^"]+)"/g)].map(m=>m[1]).concat(text.includes('VOLUME_PROFILE_INDICATOR_IDS.has(settingsDefinition.id)')?profileIds:[]).concat(text.includes('isTpoIndicator(settingsDefinition.id)')?['tpo-chart','weekly-tpo']:[]))];};
function unwrap(n){while(n&&(ts.isParenthesizedExpression(n)||ts.isAsExpression(n)||ts.isSatisfiesExpression(n)))n=n.expression;return n;}
function mapKeys(n,binding){const variable=binding.match(/settingsInstance\.settings\?*\.\[(?:String\()?([a-zA-Z_$][\w$]*)/)?.[1] ?? binding.match(/toggleOn\(settingsInstance,\s*(\w+)/)?.[1] ?? binding.match(/\[(\w+)\]\s*:/)?.[1];for(let a=n.parent;a;a=a.parent){if(!ts.isCallExpression(a)||!ts.isPropertyAccessExpression(a.expression)||a.expression.name.text!=='map')continue;const array=unwrap(a.expression.expression),callback=a.arguments[0];if(!array||!ts.isArrayLiteralExpression(array)||!callback||!ts.isArrowFunction(callback))continue;const names=callback.parameters[0]?.name;if(!names||!ts.isArrayBindingPattern(names))continue;const index=names.elements.findIndex(e=>e.name?.getText(file)===variable);if(index<0)continue;return array.elements.map(unwrap).filter(ts.isArrayLiteralExpression).map(row=>unwrap(row.elements[index])).filter(v=>v&&ts.isStringLiteral(v)).map(v=>v.text);}return [];}
function visit(n,ids=[]){
 if(ts.isConditionalExpression(n)){visit(n.condition,ids);visit(n.whenTrue,idsFrom(n.condition).length?idsFrom(n.condition):ids);visit(n.whenFalse,ids);return;}
 if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken){visit(n.left,ids);visit(n.right,idsFrom(n.left).length?idsFrom(n.left):ids);return;}
 if((ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))&&ids.length){
  const attrs=n.attributes.properties.filter(ts.isJsxAttribute);
  const binding=attrs.filter(a=>['value','checked','aria-pressed','aria-checked'].includes(a.name.getText(file))).map(a=>a.initializer?.getText(file)||'').join(' ');
  const handler=attrs.filter(a=>['onClick','onChange','onValueChange'].includes(a.name.getText(file))).map(a=>a.initializer?.getText(file)||'').join(' ');
  const keys=[...binding.matchAll(/settingsInstance\.settings\?*\.(\w+)/g)].map(m=>m[1]).filter(key=>new RegExp('(?:\\b'+key+'\\s*:|[\"\']'+key+'[\"\'])').test(handler));
  if(/settingsInstance\.settings\?*\.\[|toggleOn\(settingsInstance,/.test(binding))keys.push(...mapKeys(n,binding));
  if(/\[\w+\]\s*:/.test(handler))keys.push(...mapKeys(n,binding+' '+handler));
  for(const id of ids) for(const key of keys) (result[id]??=new Set()).add(key);
 }
 if(ids.length&&ts.isCallExpression(n)&&['toggle','toggleRow','dropdown','slider'].includes(n.expression.getText(file))&&ts.isStringLiteral(n.arguments[1]??{})){for(const id of ids)(result[id]??=new Set()).add(n.arguments[1].text);}
 ts.forEachChild(n,c=>visit(c,ids));
}
visit(file);
// These editors construct their setting names through local keys/prefixes,
// rather than direct property bindings in JSX. Keep their dedicated controls
// authoritative too; the interaction audit checks them against the saved keys.
const dynamicOwned={
 'deep-delta':['range1Enabled','range2Enabled','range3Enabled','range4Enabled','level1Enabled','level2Enabled'],
 'overlay-timeframe-candlestick':['filled','drawCloseBoundary'],
 'deep-pattern-builder':['condition1Enabled','condition2Enabled','condition3Enabled','condition4Enabled','calculateOnClose','alertsEnabled'],
 ...Object.fromEntries(profileIds.map(id=>[id,['showLevelLabelPrice','recentLevelsOnly']])),
};
for(const [id,keys]of Object.entries(dynamicOwned))for(const key of keys)(result[id]??=new Set()).add(key);
const data=Object.fromEntries(Object.entries(result).sort().map(([k,v])=>[k,[...v].sort()]));
const target='src/lib/indicatorDedicatedControlKeys.ts';
const generated='/** Settings with a dedicated editor in ChartIndicatorsControl. Keep generic editors from repeating them. */\nexport const INDICATOR_DEDICATED_CONTROL_KEYS: Record<string, readonly string[]> = '+JSON.stringify(data,null,2)+';\n';
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8').replaceAll('\r\n','\n')!==generated)throw Error('Dedicated control inventory is stale; regenerate it');}else fs.writeFileSync(target,generated);
console.log(Object.keys(data).length,'indicators',Object.values(data).reduce((n,v)=>n+v.length,0),'explicit bindings');
