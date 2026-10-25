import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');

test('Options names the existing page consistently across navigation, home and chart panels', () => {
  const sidebar=read('src/components/AppSidebar.tsx');
  const home=read('src/components/WorkspaceHome.tsx');
  const workspace=read('src/components/KwantifyWorkspace.tsx');
  assert.match(sidebar,/key: "gamma", href: "\/gamma", label: "OPTIONS", title: "Options"/);
  assert.match(home,/href: "\/gamma", title: "Options"/);
  assert.match(workspace,/id: "gamma" as const, label: "Options"/);
  assert.match(workspace,/id: "gamma", label: "OPTIONS"/);
  assert.match(workspace,/workspaceLoader\("Opening Options"/);
  assert.doesNotMatch(workspace,/label="Gamma"|Opening Gamma/);
});

test('the page heading and errors use Options without renaming real Gamma metrics or saved IDs', () => {
  const page=read('src/components/options-flow/GammaWorkspace.tsx');
  assert.match(page,/<h1[^>]*>Options<\/h1>/);
  assert.match(page,/Options data is unavailable right now/);
  assert.doesNotMatch(page,/Options Flow · Gamma|Gamma data is unavailable/);
  assert.match(page,/GAMMA: \{ short: "GEX", label: "Gamma"/);
  assert.match(page,/label="Gamma environment"/);
});
