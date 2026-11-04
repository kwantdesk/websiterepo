import test from 'node:test';
import assert from 'node:assert/strict';
import {mountSessionDateControls} from '../../public/gex-data-app/session-date-controls.js';
import {claimMenu,releaseMenu} from '../../public/gex-data-app/menu-coordination.js';

class Element{
  constructor(tag,document){this.tagName=tag;this.ownerDocument=document;this.children=[];this.attributes={};this.events={};this.parent=null;this.classList={add:()=>{}};}
  append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
  replaceChildren(...children){this.children.forEach(child=>{child.parent=null;});this.children=[];this.append(...children);}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(event,callback){(this.events[event]||=[]).push(callback);}
  fire(event){if(!this.disabled)for(const callback of this.events[event]||[])callback({target:this});}
  contains(other){return this===other||this.children.some(child=>child.contains(other));}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
  get isConnected(){return this===this.ownerDocument.body||!!this.parent?.isConnected;}
}
const descendants=node=>[node,...node.children.flatMap(descendants)];
const byText=(node,text)=>descendants(node).find(child=>child.textContent===text);
const byLabel=(node,text)=>descendants(node).find(child=>child.attributes['aria-label']===text);
function harness(initial={}){
  const events={};const document={createElement:tag=>new Element(tag,document),addEventListener(type,callback){(events[type]||=[]).push(callback);}};document.body=new Element('body',document);const host=document.createElement('div');document.body.append(host);
  const scope={currentDate:'2026-11-03',date:'',...initial},changes=[];let menu;
  const api=mountSessionDateControls({host,getScope:()=>scope,popup:(_anchor,_title,build)=>{menu?.remove();menu=document.createElement('section');document.body.append(menu);build(menu);return menu;},onChange:next=>{changes.push(next);scope.date=next;}});
  return {api,host,scope,changes,document,events,fire(type,event){for(const handler of events[type]||[])handler(event);},get menu(){return menu;},open(){byLabel(host,'Session Date').fire('click');}};
}

test('single calendar opens themed with Current, no native date input and no commit on navigation',()=>{
  const h=harness();assert.equal(byLabel(h.host,'Session Date').textContent,'Current ⌄');h.open();assert.equal(h.menu.isConnected,true);assert.ok(byText(h.menu,'November 2026'));assert.equal(descendants(h.menu).some(node=>node.tagName==='input'),false);
  byLabel(h.menu,'Previous month').fire('click');assert.ok(byText(h.menu,'October 2026'));assert.deepEqual(h.changes,[]);assert.equal(byLabel(h.host,'Session Date').attributes['aria-expanded'],'true');
});

test('day selection immediately commits one ISO string, highlights selected day and Clear restores Current',()=>{
  const h=harness({date:'2026-10-16'});h.open();assert.equal(byLabel(h.menu,'Oct 16, 2026').attributes['aria-pressed'],'true');byLabel(h.menu,'Oct 19, 2026').fire('click');
  assert.deepEqual(h.changes,['2026-10-19']);assert.equal(h.menu.isConnected,false);assert.equal(byLabel(h.host,'Session Date').textContent,'Oct 19, 2026 ⌄');h.open();byText(h.menu,'Clear').fire('click');assert.deepEqual(h.changes,['2026-10-19','']);assert.equal(byLabel(h.host,'Session Date').textContent,'Current ⌄');
});

test('future cutoff only follows explicit valid currentDate, never machine time',()=>{
  const h=harness();h.open();assert.equal(byLabel(h.menu,'Nov 4, 2026').disabled,true);assert.equal(byLabel(h.menu,'Next month').disabled,true);byLabel(h.menu,'Nov 4, 2026').fire('click');assert.deepEqual(h.changes,[]);
  const unlimited=harness({date:'2030-02-01',currentDate:undefined});unlimited.open();assert.equal(byLabel(unlimited.menu,'Feb 28, 2030').disabled,false);assert.equal(byLabel(unlimited.menu,'Next month').disabled,false);byLabel(unlimited.menu,'Feb 28, 2030').fire('click');assert.deepEqual(unlimited.changes,['2030-02-28']);
});

test('calendar remains date-only across leap days, DST changes and year boundaries',()=>{
  const h=harness({date:'2024-02-01',currentDate:undefined});h.open();byLabel(h.menu,'Feb 29, 2024').fire('click');assert.deepEqual(h.changes,['2024-02-29']);h.scope.date='2026-03-01';h.api.sync();h.open();byLabel(h.menu,'Mar 8, 2026').fire('click');assert.equal(h.changes.at(-1),'2026-03-08');h.scope.date='2026-12-31';h.api.sync();h.open();byLabel(h.menu,'Next month').fire('click');assert.ok(byText(h.menu,'January 2027'));byLabel(h.menu,'Jan 1, 2027').fire('click');assert.equal(h.changes.at(-1),'2027-01-01');
});

test('outside and Escape dismiss without committing; reopening invalidates retained callbacks',()=>{
  const h=harness();h.open();const stale=byLabel(h.menu,'Nov 2, 2026');h.fire('pointerdown',{target:h.document.body});assert.equal(h.menu.isConnected,false);assert.equal(byLabel(h.host,'Session Date').attributes['aria-expanded'],'false');stale.fire('click');h.open();h.fire('keydown',{key:'Escape'});assert.equal(h.menu.isConnected,false);h.open();stale.fire('click');assert.deepEqual(h.changes,[]);assert.equal(h.menu.isConnected,true);
});

test('scope changes and destroy prevent stale commits and remove menus without event listeners per mount',()=>{
  const h=harness();h.open();const late=byLabel(h.menu,'Nov 2, 2026');h.scope.disabled=true;h.api.sync();assert.equal(h.menu.isConnected,false);late.fire('click');h.open();assert.deepEqual(h.changes,[]);assert.equal(byLabel(h.host,'Session Date').disabled,true);
  h.scope.disabled=false;h.api.sync();h.open();const clear=byText(h.menu,'Clear');h.api.destroy();clear.fire('click');h.api.destroy();assert.equal(h.host.children.length,0);assert.equal(h.menu.isConnected,false);assert.deepEqual(h.changes,[]);
  assert.deepEqual(Object.fromEntries(Object.entries(h.events).map(([type,callbacks])=>[type,callbacks.length])),{pointerdown:1,click:1,keydown:1});
});

test('neighboring coordinated menu replaces the calendar and detached calendar cannot claim changes',()=>{
  const h=harness();h.open();const stale=byLabel(h.menu,'Nov 2, 2026'),peer=h.document.createElement('section');h.document.body.append(peer);let dismissed=0;claimMenu(h.document,peer,()=>{dismissed++;peer.remove();});
  assert.equal(h.menu.isConnected,false);stale.fire('click');assert.deepEqual(h.changes,[]);h.open();assert.equal(dismissed,1);assert.equal(peer.isConnected,false);assert.equal(h.menu.isConnected,true);h.api.destroy();releaseMenu(h.document,peer);
});

test('unsynced scope overrides and externally removed popup never commit a stale date',()=>{
  const h=harness();h.open();const stale=byLabel(h.menu,'Nov 2, 2026');h.scope.date='2026-10-16';stale.fire('click');assert.deepEqual(h.changes,[]);h.api.sync();h.open();const other=byLabel(h.menu,'Oct 19, 2026');h.menu.remove();other.fire('click');assert.deepEqual(h.changes,[]);
});
