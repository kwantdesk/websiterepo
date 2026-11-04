import fs from "node:fs";
import ts from "typescript";
import { CHART_INDICATOR_CATALOG } from "../src/lib/chartIndicatorCatalog.ts";
const source=fs.readFileSync("src/components/ChartIndicatorsControl.tsx","utf8");
const file=ts.createSourceFile("ChartIndicatorsControl.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const rows=[];
function visit(node, scopes=[]){
 let current=scopes;
 if(ts.isConditionalExpression(node)) current=[...scopes,node.condition.getText(file)];
 if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken) current=[...scopes,node.left.getText(file)];
 if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
  const tag=node.tagName.getText(file);
  if(["button","input","select","KwantSelect","textarea"].includes(tag)){
   const attrs=Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(a=>[a.name.getText(file),a.initializer?.getText(file)??"true"]));
   const ids=[...new Set(current.flatMap(scope=>[...scope.matchAll(/(?:settingsDefinition|settingsInstance)\.(?:id|indicatorId)\s*===?\s*["']([^"']+)["']/g)].map(m=>m[1])))];
   const line=file.getLineAndCharacterOfPosition(node.getStart(file)).line+1;
   rows.push({line,tag,ids,section:current.findLast(scope=>scope.includes("settingsDefinition"))?.slice(0,240)??"shared/dynamic",label:attrs["aria-label"]??attrs.title??(ts.isJsxElement(node.parent)?node.parent.children.filter(ts.isJsxText).map(t=>t.text.trim()).join(" ").slice(0,100):""),value:attrs.value??attrs.checked??attrs["aria-checked"],handler:attrs.onClick??attrs.onChange??"",hasHandler:Boolean(attrs.onClick??attrs.onChange??attrs.onInput??attrs.onPointerDown),disabled:attrs.disabled});
  }
 }
 ts.forEachChild(node,child=>visit(child,current));
}
visit(file);
fs.writeFileSync("docs/audits/2026-11-04-indicator-controls/dialog-controls.json",JSON.stringify({controlNodes:rows.length,controls:rows,perIndicator:CHART_INDICATOR_CATALOG.map(indicator=>({id:indicator.id,category:indicator.category,explicitControls:rows.filter(row=>row.ids.includes(indicator.id)).map(row=>row.line),sharedControlsRequireInspection:true}))},null,2)+"\n");
console.log("Dialog controls inventoried",rows.length);
