import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,globSync} from 'node:fs';
import ts from 'typescript';
import {themePresets} from '../src/lib/themePresets.ts';
import {readableTextOn,parseResolvedColor,contrastRatio} from '../src/lib/readableContrast.ts';
import {actionForeground} from '../public/gex-data-app/site-theme.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const rules=read('public/gex-data-app/workspace.css')+read('public/gex-data-app/styles.css');
function rule(selector){const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=rules.match(new RegExp(escaped+'\\s*\\{([^}]+)\\}'));assert.ok(match,selector);return match[1];}
test('GEX Data Add Tool, dialog, filter and snapshot actions pair semantic fills with contrast ink',()=>{
  for(const selector of ['.dock-body>button','.workspace-dialog button','.filter-group-row button','.snapshot-control button,.row-detail-actions button']){
    const declarations=rule(selector);assert.match(declarations,/background:\s*var\(--site-primary\)/);assert.match(declarations,/color:\s*var\(--site-on-primary\)/);
  }
  assert.match(rule('.workspace-dialog .danger-button'),/color:\s*var\(--site-on-danger\)/);
});
test('transparent picker rows retain normal foreground instead of inheriting filled-button ink',()=>{
  for(const selector of ['.workspace-dialog .picker-tool','.picker-groups button'])assert.match(rule(selector),/color:\s*var\(--site-foreground\)/);
  assert.match(rule('.workspace-dialog .picker-tool'),/background:\s*transparent/);
});
test('live iframe action colours agree with the canonical website contrast calculation in every theme',()=>{
  for(const {name,colors}of themePresets)for(const role of ['primary','danger']){
    assert.equal(actionForeground(colors[role]),readableTextOn(colors[role]),name+' '+role);
    assert.ok(contrastRatio(parseResolvedColor(actionForeground(colors[role])),parseResolvedColor(colors[role]))>=4.5,name+' '+role);
  }
});
test('pre-module bootstrap has the same primary/danger ink as the live module in every theme',()=>{
  const source=read('public/gex-data-app/site-bootstrap.js');
  for(const {name,colors}of themePresets){
    const values={},root={style:{setProperty:(k,v)=>values[k]=v}},window={};window.parent=window;
    vm.runInNewContext(source,{window,document:{documentElement:root},location:{search:'',pathname:'/gex-data-app/'},URLSearchParams,localStorage:{getItem:()=>JSON.stringify(colors)}});
    for(const role of ['primary','danger'])assert.equal(values['--site-on-'+role],readableTextOn(colors[role]),name+' '+role);
  }
});
test('the host palette wins synchronously, including its contrasting label colours',()=>{
  const values={},root={style:{setProperty:(k,v)=>values[k]=v}},window={__kwantGexDataHost:{theme:()=>({background:'#fff',foreground:'#000',primary:'#030303',danger:'#ffff00'})}};window.parent=window;
  vm.runInNewContext(read('public/gex-data-app/site-bootstrap.js'),{window,document:{documentElement:root},location:{search:'',pathname:'/gex-data-app/'},URLSearchParams,localStorage:{getItem:()=>null}});
  assert.equal(values['--site-on-primary'],'#FFFFFF');assert.equal(values['--site-on-danger'],'#000000');
});
test('shared page action literals cannot pair a solid theme fill with fixed white or page-background text',()=>{
  for(const file of globSync('src/**/*.tsx')){
    if(file.endsWith('UserAvatar.tsx'))continue; // Its empty status dot intentionally glows with currentColor.
    const source=readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    function walk(node){
      if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)){
        const tokens=node.text.split(/\s+/);
        for(const role of ['primary','danger'])if(tokens.includes('bg-'+role)){
          assert.ok(!tokens.includes('text-white')&&!tokens.includes('text-background'),file+': '+node.text);
        }
      }
      ts.forEachChild(node,walk);
    }
    walk(ast);
  }
});
