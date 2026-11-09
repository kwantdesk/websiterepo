import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const workspace=fs.readFileSync('src/components/KwantifyWorkspace.tsx','utf8');
const marker=workspace.indexOf('    const saved = savePaperTradingLedger(paperLedger);');
const block=workspace.slice(workspace.lastIndexOf('  useEffect(() => {',marker),workspace.indexOf('\n',workspace.indexOf('  }, [paperLedger',marker))+1);
for(const ready of [false,true])for(const hydrated of [false,true])test(`ledger persistence waits for identity and accounts ready${ready}/${hydrated}`,()=>{
 const ledger={version:1,accounts:{}};let writes=0;
 vm.runInNewContext(ts.transpileModule(block,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{useEffect:fn=>fn(),paperLedger:ledger,paperLedgerRef:{current:ledger},preferencesReady:ready,paperAccountsHydrated:hydrated,savePaperTradingLedger(){writes++;return {ok:true}},setOrderTicketMessage(){throw Error('unexpected message')}});
 assert.equal(writes,ready&&hydrated?1:0);
});
