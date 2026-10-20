import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInspectorDialog} from '../public/heatmap-app/src/inspector-dialog.js';

function harness() {
 const listeners=new Map(),classes=new Set(),pending=[],changes=[];
 const opener={isConnected:true,focused:0,focus(){this.focused++;}};
 const menu={closed:false,classList:{add(){menu.closed=true;}}},trigger={expanded:true,setAttribute(_,value){trigger.expanded=value;}};
 const picker={classList:{remove(){picker.open=false;}},open:false,querySelector(selector){return selector.includes('menu')?menu:trigger;}};
 const dialog={open:false,shows:0,ownerDocument:{activeElement:opener},classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)},
  querySelectorAll(){return picker.open?[picker]:[];},addEventListener(name,callback){listeners.set(name,callback);},
  showModal(){this.open=true;this.shows++;},close(){this.open=false;pending.push(()=>listeners.get('close')());},
  getBoundingClientRect:()=>({left:100,right:700,top:80,bottom:600})};
 const title={},controller=createInspectorDialog({dialog,title,onChange:open=>changes.push(open)});
 return {dialog,title,controller,classes,changes,opener,picker,menu,trigger,flush:()=>pending.splice(0).forEach(fn=>fn()),
  emit:(name,event={})=>listeners.get(name)?.({preventDefault(){},...event})};
}
test('settings opens as one native modal, changes title without remounting, and restores opener focus',()=>{
 const h=harness();h.controller.open('Liquidity Map settings');assert.equal(h.dialog.open,true);assert.equal(h.title.textContent,'Liquidity Map settings');assert.equal(h.classes.has('open'),true);
 h.controller.open('Order flow settings');assert.equal(h.dialog.shows,1);assert.equal(h.title.textContent,'Order flow settings');
 h.controller.close();h.flush();assert.equal(h.classes.has('open'),false);assert.equal(h.dialog.open,false);assert.equal(h.opener.focused,1);
});
test('Escape closes the select first, then settings; close/cancel keep the parent state synchronized',()=>{
 const h=harness();h.controller.open('Settings');h.picker.open=true;let prevented=0;
 h.emit('cancel',{preventDefault(){prevented++;}});assert.equal(h.dialog.open,true);assert.equal(h.menu.closed,true);assert.equal(h.trigger.expanded,'false');
 h.emit('cancel',{preventDefault(){prevented++;}});assert.equal(h.dialog.open,false);assert.equal(prevented,2);assert.equal(h.changes.at(-1),false);
});
test('only a backdrop pointer-down dismisses; controls and dialog padding cannot close settings',()=>{
 const h=harness();h.controller.open('Settings');
 h.emit('pointerdown',{target:{},clientX:900,clientY:10});assert.equal(h.dialog.open,true);
 h.emit('pointerdown',{target:h.dialog,clientX:120,clientY:100});assert.equal(h.dialog.open,true);
 h.emit('pointerdown',{target:h.dialog,clientX:50,clientY:100});assert.equal(h.dialog.open,false);
});
test('delayed close events cannot hide a newly reopened dialog',()=>{
 const h=harness();h.controller.open('Settings');h.controller.close();h.controller.open('Depth');h.flush();
 assert.equal(h.dialog.open,true);assert.equal(h.classes.has('open'),true);assert.equal(h.changes.at(-1),true);
});
test('the actual inspector is centered, theme-bound, viewport-limited and leaves the chart visible',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const html=read('public/heatmap-app/index.html'),css=read('public/heatmap-app/embed.css'),main=read('public/heatmap-app/src/main.js'),workspace=read('src/components/liquidity-map/LiquidityMapWorkspace.tsx');
 assert.match(html,/<dialog class="inspector" id="inspector" aria-labelledby="inspectorTitle" aria-modal="true">/);
 assert.match(html,/aria-label="Close Liquidity Map settings" autofocus/);
 const centered=css.slice(css.indexOf('/* Same centred'));
 assert.match(centered,/inset: 0/);assert.match(centered,/margin: auto/);assert.match(centered,/calc\(100dvh - 48px\)/);assert.match(centered,/background: var\(--ui-panel\)/);
 assert.match(centered,/::backdrop \{ background: rgba\(0, 0, 0, .35\)/);assert.match(centered,/backdrop-filter: none/);
 assert.match(main,/if \(\$\('inspector'\)\.open\) return/);assert.match(main,/this.inspectorDialog.open\(/);
 assert.match(workspace,/active=\{active && !inspectorOpen\}/);assert.match(workspace,/className=\{inspectorOpen \? "hidden" : undefined\}/);
 assert.doesNotMatch(centered,/blur\(/);
});
