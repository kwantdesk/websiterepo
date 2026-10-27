import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {defaultTheme,themeBootstrapScript} from '../src/lib/theme.ts';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function root(){const properties={};return {properties,dataset:{},style:{setProperty:(k,v)=>properties[k]=v}};}
test('saved palettes apply synchronously before any frame; invalid fields retain canonical defaults',()=>{
 for(const raw of [JSON.stringify({background:'#152600',primary:'#ddee00'}),'{broken',JSON.stringify({background:null,primary:42}),null]){
  const r=root(),frames=[];
  vm.runInNewContext(themeBootstrapScript(),{document:{documentElement:r,querySelector:()=>null},localStorage:{getItem:()=>raw},requestAnimationFrame:f=>frames.push(f)});
  const valid=raw?.includes('#152600');assert.equal(r.properties['--background'],valid?'#152600':defaultTheme.background);assert.equal(r.style.backgroundColor,r.properties['--background']);assert.equal(r.properties['--primary'],valid?'#ddee00':defaultTheme.primary);assert.equal(r.dataset.themeReady,'true');
 }
});
test('unavailable storage still paints the canonical palette synchronously',()=>{
 const r=root();vm.runInNewContext(themeBootstrapScript(),{document:{documentElement:r,querySelector:()=>null},localStorage:{getItem(){throw Error('unavailable')}},requestAnimationFrame:()=>{}});assert.equal(r.style.backgroundColor,defaultTheme.background);
});
test('embedded startup uses the parent palette even before its React host registers',()=>{
 for(const pathname of ['/gex-data-app/index.html','/kwanty-app/index.html']){
  const r=root(),parent={document:{documentElement:{}},getComputedStyle:()=>({getPropertyValue:k=>({'--background':'#152600','--primary':'#ccee00','--foreground':'#faffcc'}[k]||'')})};parent.parent=parent;
  const window={parent};
  vm.runInNewContext(read('public/gex-data-app/site-bootstrap.js'),{window,document:{documentElement:r},location:{search:'',pathname},URLSearchParams,localStorage:{getItem:()=>JSON.stringify({background:'#990000'})}});
  assert.equal(r.style.backgroundColor,'#152600');assert.equal(r.properties['--site-primary'],'#ccee00');
 }
});
test('embedded standalone startup respects storage and cross-origin parents are never read',()=>{
 const r=root(),window={};Object.defineProperty(window,'parent',{get(){throw Error('cross origin')}});
 vm.runInNewContext(read('public/gex-data-app/site-bootstrap.js'),{window,document:{documentElement:r},location:{search:'',pathname:'/gex-data-app/'},URLSearchParams,localStorage:{getItem:()=>JSON.stringify({background:'#152600'})}});assert.equal(r.style.backgroundColor,'#152600');
});
test('legacy migration cannot repaint a saved theme and bootstrap assets are versioned',()=>{
 const source=read('src/components/AppSidebar.tsx');assert.doesNotMatch(source,/saveTheme\(defaultTheme\)/);
 for(const app of ['gex-data-app','kwanty-app'])assert.match(read('public/'+app+'/index.html'),/site-bootstrap.js\?v=20261027-theme-paint/);
 const css=read('src/app/globals.css').split('/* Shared precision rail')[0];for(const [key,value]of Object.entries(defaultTheme)){const name='--'+key.replace(/([A-Z])/g,'-$1').toLowerCase();if(css.includes(name+':'))assert.ok(css.includes(name+': '+value),name);}
});

test('Liquidity Map resolves its background before loading modules, including unavailable storage',()=>{
 const script=read('public/heatmap-app/index.html').match(/<script>([\s\S]*?)<\/script>/)[1];
 for(const raw of [JSON.stringify({background:'#152600'}),'{broken',null]){
  const r=root();vm.runInNewContext(script,{document:{documentElement:r},localStorage:{getItem:()=>raw}});assert.equal(r.style.backgroundColor,raw?.includes('#152600')?'#152600':defaultTheme.background);
 }
});
