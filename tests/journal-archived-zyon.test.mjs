import "../scripts/alias-hook.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const { ZYON_JOURNAL_VISIBLE, visibleJournalAccountFilter } = await import("../src/lib/journalFeatureVisibility.ts");
const { isZyonJournalAccountName } = await import("../src/lib/journal.ts");
const source = readFileSync(new URL("../src/components/journal/JournalWorkspace.tsx", import.meta.url), "utf8");
test("archived Zyon is absent and old selections reopen Overall Journal", () => {
  assert.equal(ZYON_JOURNAL_VISIBLE, false);
  for (const name of ["ZYON Journal", "  zyon  journal "]) assert.equal(visibleJournalAccountFilter(name), "all");
  for (const name of ["all", "20 october", "Imported account"]) assert.equal(visibleJournalAccountFilter(name), name);
});
test("actual journal account/trade selectors exclude Zyon without changing records", () => {
  const ast = ts.createSourceFile("journal.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), initializers = new Map();
  function visit(n) { if (ts.isVariableDeclaration(n) && ["accounts", "allTrades"].includes(n.name.getText(ast)) && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useMemo") initializers.set(n.name.getText(ast), n.initializer.arguments[0].getText(ast)); ts.forEachChild(n, visit); } visit(ast);
  const state = { trades: [{ id: "demo", account: "20 october", netPnl: 100 }, { id: "stored-zyon", account: "ZYON Journal", netPnl: 200 }] }, zyonTrades = [{ id: "mirrored-zyon", account: "ZYON Journal", netPnl: 300 }], before = JSON.stringify({ state, zyonTrades });
  const args = { ZYON_JOURNAL_VISIBLE, ZYON_JOURNAL_ACCOUNT: "ZYON Journal", customAccounts: ["20 october", "Imported account"], state, zyonTrades, archivedAccountNames: new Set(), isZyonJournalAccountName };
  const run = name => new Function(...Object.keys(args), "return (" + ts.transpileModule(initializers.get(name), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText.trim().replace(/;$/, "") + ")();")(...Object.values(args));
  assert.deepEqual(run("accounts"), ["20 october", "Imported account"]);
  assert.deepEqual(run("allTrades"), [state.trades[0]]);
  assert.equal(JSON.stringify({ state, zyonTrades }), before);
});
test("archived outcome fetch and refresh timer are gated off", () => {
  assert.match(source, /loadZyonOutcomes = useCallback\(async \(\) => \{\s*if \(!ZYON_JOURNAL_VISIBLE\)/);
  assert.match(source, /useEffect\(\(\) => \{\s*if \(!ZYON_JOURNAL_VISIBLE\) return;\s*void loadZyonOutcomes\(\)/);
  assert.match(source, /setAccountFilter\(visibleJournalAccountFilter\(memory\.accountFilter\)\)/);
});
