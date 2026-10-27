import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

for(const [file,workspace] of [['gex-data/GexDataWorkspace.tsx','kwantdesk:gex-data:workspace:v1'],['kwanty/KwantyWorkspace.tsx','kwantdesk:kwanty:workspace:v1']]) {
 test(`${file}: receiving a trade must not clear option caches or remount its frame`,()=>{
  const source=ts.createSourceFile(file,fs.readFileSync(`src/components/${file}`,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let initializer;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='hydrated')initializer=node.initializer.getText(source);ts.forEachChild(node,visit);}
  visit(source);assert.ok(initializer);
  let generations=0,clears=0;
  const code=ts.transpileModule(`const handler=${initializer};handler;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const handler=vm.runInNewContext(code,{CHART_SETTINGS_STORAGE_KEY:'olisa-chart-settings',syncTimeZone(){},syncPalette(){},cache:{clear(){clears++}},setGeneration(){generations++}});
  handler({detail:{source:'remote',keys:['kwantify-paper-trading-ledger-v1']}});
  assert.equal(generations,0);assert.equal(clears,0);
  handler({detail:{source:'remote',keys:[workspace]}});
  assert.equal(generations,1);assert.equal(clears,1);
 });
}

test('hidden iframe cleanup explicitly stops its runtime before host disposal',()=>{for(const [file,type]of [['gex-data/GexDataWorkspace.tsx','gex-data-site-activity'],['kwanty/KwantyWorkspace.tsx','kwanty-site-activity']]){const s=fs.readFileSync('src/components/'+file,'utf8');const cleanup=s.slice(s.indexOf('return () => {',s.indexOf('observer.observe(document.documentElement')));assert.match(cleanup,/host.active = false/);assert.ok(cleanup.indexOf(type)<cleanup.indexOf('disposed = true'));assert.match(cleanup,/active: false/);}});
