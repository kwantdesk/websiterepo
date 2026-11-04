import test from 'node:test';
import assert from 'node:assert/strict';
import {claimMenu,releaseMenu,dismissDialogOnBackdrop} from '../../public/gex-data-app/menu-coordination.js';
function doc(){const listeners={};return {listeners,querySelectorAll:()=>[],addEventListener(type,fn){(listeners[type]??=[]).push(fn);},fire(type,target){for(const fn of listeners[type]??[])fn({target});}};}
function element(document,parent=null){return {ownerDocument:document,parent,contains(target){for(let node=target;node;node=node.parent)if(node===this)return true;return false;}};}
test('nested filter picker preserves parent; sibling picker replaces only nested picker',()=>{
 const d=doc(),panel=element(d),first=element(d,panel),second=element(d,panel),outside=element(d);const closed=[];
 claimMenu(d,panel,reason=>closed.push(['panel',reason]));claimMenu(d,first,reason=>closed.push(['first',reason]));
 assert.deepEqual(closed,[]);claimMenu(d,second,reason=>closed.push(['second',reason]));assert.deepEqual(closed,[['first','replace']]);
 d.fire('pointerdown',panel);assert.deepEqual(closed,[['first','replace'],['second','outside']]);
 d.fire('click',panel);assert.equal(closed.length,2);d.fire('pointerdown',outside);assert.deepEqual(closed.at(-1),['panel','outside']);
});
test('existing, newly inserted and reloaded iframe documents dismiss outside without listener accumulation',()=>{
 const d=doc(),child=doc(),frame=element(d),loads=[];frame.matches=()=>true;frame.querySelectorAll=()=>[];frame.contentDocument=child;frame.addEventListener=(_type,fn)=>loads.push(fn);child.defaultView={frameElement:frame};
 let observe;d.documentElement={};d.defaultView={MutationObserver:class{constructor(fn){observe=fn;}observe(){}}};d.querySelectorAll=()=>[frame];
 const panel=element(d);let closes=0;claimMenu(d,panel,()=>closes++);child.fire('pointerdown',element(child));assert.equal(closes,1);
 const next=doc();next.defaultView={frameElement:frame};frame.contentDocument=next;loads[0]();claimMenu(d,panel,()=>closes++);next.fire('pointerdown',element(next));assert.equal(closes,2);
 const added=element(d),newDoc=doc();added.matches=()=>true;added.querySelectorAll=()=>[];added.contentDocument=newDoc;added.addEventListener=()=>{};newDoc.defaultView={frameElement:added};observe([{addedNodes:[added]}]);
 claimMenu(d,panel,()=>closes++);newDoc.fire('click',element(newDoc));assert.equal(closes,3);assert.equal(child.listeners.pointerdown.length,1);assert.equal(d.listeners.pointerdown.length,1);
 claimMenu(d,panel,()=>closes++);releaseMenu(d,panel);next.fire('click',element(next));assert.equal(closes,3);
});
test('iframe inside menu counts as inside',()=>{
 const d=doc(),child=doc(),panel=element(d),frame=element(d,panel);frame.contentDocument=child;frame.addEventListener=()=>{};d.querySelectorAll=()=>[frame];child.defaultView={frameElement:frame};let closes=0;
 claimMenu(d,panel,()=>closes++);child.fire('pointerdown',element(child));assert.equal(closes,0);
});
test('dialog closes only for a completed backdrop gesture, never inside clicks or drags starting inside',()=>{
 const handlers={},dialog={getBoundingClientRect:()=>({left:20,right:200,top:20,bottom:200}),addEventListener:(type,fn)=>handlers[type]=fn,close:()=>closes++};let closes=0;dismissDialogOnBackdrop(dialog);
 const fire=(type,x,y,target=dialog)=>handlers[type]({clientX:x,clientY:y,pointerId:1,target});
 fire('pointerdown',40,40);fire('pointerup',10,40);assert.equal(closes,0);
 fire('pointerdown',10,40);fire('pointerup',40,40);assert.equal(closes,0);
 fire('pointerdown',10,40);handlers.pointercancel();fire('pointerup',10,40);assert.equal(closes,0);
 fire('pointerdown',10,40);fire('pointerup',10,40);assert.equal(closes,1);
});
