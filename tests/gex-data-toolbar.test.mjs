import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('public/gex-data-app/index.html'),css=read('public/gex-data-app/site.css');
const toolbar=html.slice(html.indexOf('<div class="top-actions"'),html.indexOf('</header>'));

test('toolbar preserves all existing action hooks while replacing symbol glyphs with labelled line icons',()=>{
  const buttons=[...toolbar.matchAll(/<button\b[^>]*>(.*?)<\/button>/gs)];
  assert.equal(buttons.length,10);
  for(const [,content] of buttons){
    assert.match(content,/<svg viewBox="0 0 24 24" aria-hidden="true">/);
    assert.match(content,/<span>[^<]+<\/span>/);
    assert.doesNotMatch(content,/[◇▰✦▽◎⌁⛶⚙♜]/);
  }
  for(const title of ['Dashboard layout','Open pages','Add tool','Filters','Market','Edit','Fullscreen','Help','Settings','Remove layout'])assert.ok(toolbar.includes(`title="${title}"`));
  assert.match(toolbar,/id="openLibrary"/);assert.match(toolbar,/id="addTool"/);
  assert.match(toolbar,/<sup hidden>0<\/sup>/); // No fabricated active filter count during boot.
  const workspace=read('public/gex-data-app/workspace-ui.js');
  assert.match(workspace,/workspacesButton\.prepend\(document\.querySelector\('#workspaceToolbarIcon'\)\.content\.cloneNode\(true\)\)/);
  assert.match(html,/<template id="workspaceToolbarIcon"><svg/);
});

test('toolbar shares command-rail geometry, theme states and safe horizontal overflow',()=>{
  const nav=read('src/app/globals.css');
  for(const token of ['height:28px','font-size:10px','font-weight:600','letter-spacing:.075em'])assert.ok(css.includes(token),token);
  assert.match(nav,/height: 28px/);assert.match(nav,/font-size: 10px/);assert.match(nav,/letter-spacing: \.075em/);
  for(const rule of ['.topbar .top-action:hover','.topbar .top-action:focus-visible','.topbar .top-action[aria-expanded=true]','.topbar .top-action sup[hidden]'])assert.ok(css.includes(rule));
  assert.match(css,/\.topbar \.top-action\{[^}]*background:transparent!important[^}]*box-shadow:none/);
  assert.match(css,/overflow-x:auto/);assert.match(css,/host-timezone-control \.topbar\{padding-right:190px!important/);
  assert.match(css,/svg\{[^}]*fill:none;stroke:currentColor;stroke-width:1\.5/);
});
