import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const source=read("src/components/gexbot/GexBoxDashboard.tsx");
const toolbar=source.slice(source.indexOf('<div role="toolbar" aria-label="GEX BOX toolbar"'),source.indexOf('\n      {showStyle ?'));

test("GEX Bot dashboard command row uses the existing 36px shell height",()=>{
  assert.ok(toolbar);
  assert.match(toolbar,/h-\[var\(--kwant-shell-bar-height\)\]/);
  assert.match(read("src/app/globals.css"),/--kwant-shell-bar-height:\s*36px/);
  assert.doesNotMatch(toolbar,/h-11|h-8 w-8|workspace engine/);
  assert.match(toolbar,/hidden shrink-0 items-center gap-2 sm:flex/);
  assert.match(toolbar,/hidden min-\[420px\]:inline/);
});
test("all three controls share 28px sizing and chart-command typography",()=>{
  assert.equal((toolbar.match(/\$\{TOOLBAR_CONTROL_CLASS_NAME\}/g)??[]).length,3);
  assert.match(source,/TOOLBAR_CONTROL_CLASS_NAME = "kwant-workspace-toolbar-control inline-flex h-7/);
  const styles=read("src/app/globals.css").match(/body\.kwant-cockpit-ui \.kwant-workspace-toolbar-control \{([^}]+)\}/)?.[1];
  assert.ok(styles);
  for(const token of ['height: 28px','font-size: 10px','font-weight: 600','letter-spacing: .075em'])assert.ok(styles.includes(token),token);
});
test("existing workspace, add-tool and settings actions remain wired",()=>{
  assert.match(toolbar,/onClick=\{\(\) => setWorkspaceMenu\(\(v\) => !v\)\}/);
  assert.match(toolbar,/aria-expanded=\{workspaceMenu\}/);
  assert.match(toolbar,/onClick=\{\(\) => setShowTools\(true\)\}/);
  assert.match(toolbar,/onClick=\{\(\) => setShowStyle\(true\)\}/);
  for(const hook of ['onApply={applySavedWorkspace}','onSave={saveNamedWorkspace}','onImport={importSavedWorkspace}','title="Saved GEX BOX workspaces"','aria-label="Settings"'])assert.ok(toolbar.includes(hook),hook);
});
