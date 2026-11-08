import test from 'node:test';
import assert from 'node:assert/strict';
import {mountOptionTapeSessionControls} from '../../public/gex-data-app/option-tape-session-controls.js';
import {optionTapeSessionRange} from '../../public/gex-data-app/option-tape-interaction-model.js';

class Element{
  constructor(tag,document){this.tagName=tag;this.ownerDocument=document;this.children=[];this.style={};this.attributes={};this.events={};this.parent=null;this.classList={add:()=>{}};}
  append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
  replaceChildren(...children){this.children.forEach(child=>{child.parent=null;});this.children=[];this.append(...children);}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(event,callback){(this.events[event]||=[]).push(callback);}
  fire(event){if(!this.disabled)for(const callback of this.events[event]||[])callback({target:this});}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
  get isConnected(){return this===this.ownerDocument.body||!!this.parent?.isConnected;}
}
const descendants=node=>[node,...node.children.flatMap(descendants)];
const byText=(node,text)=>descendants(node).find(child=>child.textContent===text);
const byLabel=(node,text)=>descendants(node).find(child=>child.attributes['aria-label']===text);
function harness(initial={}){
  const document={createElement:tag=>new Element(tag,document)};document.body=new Element('body',document);const host=document.createElement('div');document.body.append(host);
  const scope={currentDate:'2026-11-03',startDate:'',endDate:'',...initial},changes=[];let menu;
  const api=mountOptionTapeSessionControls({host,getScope:()=>scope,validateSelection:optionTapeSessionRange,popup:(_anchor,_title,build)=>{menu?.remove();menu=document.createElement('section');document.body.append(menu);build(menu);return menu;},onChange:next=>{changes.push({...next});Object.assign(scope,next);}});
  return {api,host,scope,changes,get menu(){return menu;},open(){byLabel(host,'Session Date Range').fire('click');}};
}

test('opt-in Dark Pool two-month shell commits first day immediately, keeps range selection open and Clear reflects blank state',()=>{
  const document={createElement:tag=>new Element(tag,document)};document.body=new Element('body',document);const host=document.createElement('div');document.body.append(host);
  const scope={currentDate:'2026-11-03',startDate:'',endDate:''},changes=[];let menu,api;
  api=mountOptionTapeSessionControls({host,getScope:()=>scope,monthsVisible:2,commitOnSelect:true,clearLabel:'Clear',emptyHint:'Leave blank for current session',validateSelection:optionTapeSessionRange,popup:(_anchor,title,build)=>{menu=document.createElement('section');menu.title=title;document.body.append(menu);build(menu);return menu;},onChange:next=>{changes.push({...next});Object.assign(scope,next);api.sync();}});
  byLabel(host,'Session Date Range').fire('click');assert.equal(menu.title,'Session Date Range');
  assert.ok(byText(menu,'November 2026'));assert.ok(byText(menu,'December 2026'));assert.ok(byText(menu,'Leave blank for current session'));
  assert.equal(byText(menu,'Clear').disabled,true);assert.equal(byText(menu,'Apply'),undefined);
  byLabel(menu,'Previous month').fire('click');assert.ok(byText(menu,'October 2026'));assert.ok(byText(menu,'November 2026'));
  byLabel(menu,'Oct 16, 2026').fire('click');assert.deepEqual(changes,[{startDate:'2026-10-16',endDate:'2026-10-16'}]);assert.equal(menu.isConnected,true);assert.equal(byLabel(host,'Session Date Range').textContent,'Oct 16, 2026');assert.equal(byText(menu,'Clear').disabled,false);
  byLabel(menu,'Oct 20, 2026').fire('click');assert.deepEqual(changes.at(-1),{startDate:'2026-10-16',endDate:'2026-10-20'});assert.equal(menu.isConnected,true);
  byText(menu,'Clear').fire('click');assert.deepEqual(changes.at(-1),{startDate:'',endDate:''});assert.equal(menu.isConnected,false);assert.equal(byLabel(host,'Session Date Range').textContent,'Session Date Range');
  byLabel(host,'Session Date Range').fire('click');assert.equal(byText(menu,'Clear').disabled,true);api.destroy();
});

test('Dark Pool business-day endpoint opt-in disables observed weekend dates without dropping saved weekends or spanning ranges',()=>{
  const document={createElement:tag=>new Element(tag,document)};document.body=new Element('body',document);const host=document.createElement('div');document.body.append(host);
  const scope={currentDate:'2026-11-03',startDate:'2026-10-17',endDate:'2026-10-18'},changes=[];let menu,api;
  api=mountOptionTapeSessionControls({host,getScope:()=>scope,monthsVisible:2,commitOnSelect:true,businessDayEndpoints:true,clearLabel:'Clear',validateSelection:optionTapeSessionRange,
    popup:(_anchor,_title,build)=>{menu=document.createElement('section');document.body.append(menu);build(menu);return menu;},onChange:next=>{changes.push({...next});Object.assign(scope,next);api.sync();}});
  assert.equal(byLabel(host,'Session Date Range').textContent,'Oct 17, 2026 – Oct 18, 2026','explicit legacy weekend endpoints are preserved');
  byLabel(host,'Session Date Range').fire('click');
  for(const day of [3,4,10,11,17,18,24,25,31]){const endpoint=byLabel(menu,`Oct ${day}, 2026`);assert.equal(endpoint.disabled,true);endpoint.fire('click');}
  assert.equal(byLabel(menu,'Nov 1, 2026').disabled,true);byLabel(menu,'Nov 1, 2026').fire('click');assert.deepEqual(changes,[]);
  assert.equal(byLabel(menu,'Oct 19, 2026').disabled,false);byLabel(menu,'Oct 19, 2026').fire('click');
  assert.deepEqual(changes.at(-1),{startDate:'2026-10-19',endDate:'2026-10-19'});
  byLabel(menu,'Oct 16, 2026').fire('click');assert.deepEqual(changes.at(-1),{startDate:'2026-10-16',endDate:'2026-10-19'});
  assert.equal(byLabel(menu,'Oct 17, 2026').attributes['aria-pressed'],'true','weekend interior remains part of selected range');
  assert.deepEqual(optionTapeSessionRange(changes.at(-1)),{timeRange:{startTime:'2026-10-16T04:00:00.000Z',endTime:'2026-10-20T04:00:00.000Z'}});
  api.destroy();
  const ordinary=harness({startDate:'2026-10-17',endDate:'2026-10-18'});ordinary.open();assert.notEqual(byLabel(ordinary.menu,'Oct 17, 2026').disabled,true,'other callers retain their existing endpoint rules');ordinary.api.destroy();
});

test('Equity date opt-in commits a single selected day then selecting the same day clears to current',()=>{
  const document={createElement:tag=>new Element(tag,document)};document.body=new Element('body',document);const host=document.createElement('div');document.body.append(host);
  const scope={currentDate:'2026-10-20',startDate:'',endDate:''},changes=[];let menu,api;
  api=mountOptionTapeSessionControls({host,getScope:()=>scope,commitOnSelect:true,toggleSameDay:true,clearLabel:'Clear',popup:(_anchor,_title,build)=>{menu=document.createElement('section');document.body.append(menu);build(menu);return menu;},onChange:selection=>{changes.push(selection);Object.assign(scope,selection);api.sync();}});
  byLabel(host,'Session Date Range').fire('click');byLabel(menu,'Oct 16, 2026').fire('click');assert.deepEqual(changes.at(-1),{startDate:'2026-10-16',endDate:'2026-10-16'});
  byLabel(menu,'Oct 16, 2026').fire('click');assert.deepEqual(changes.at(-1),{startDate:'',endDate:''});assert.equal(byLabel(host,'Session Date Range').textContent,'Session Date Range');api.destroy();
});
test('current-session picker opens immediately with themed calendar buttons and no native date input',()=>{
  const h=harness();h.open();assert.equal(h.menu.isConnected,true);assert.ok(byText(h.menu,'November 2026'));assert.equal(descendants(h.menu).some(node=>node.tagName==='input'),false);
  assert.equal(byLabel(h.menu,'Nov 4, 2026').disabled,true);assert.equal(byLabel(h.menu,'Next month').disabled,true);assert.equal(h.changes.length,0);
});
test('single selected date applies as a single session and closes without changing until Apply',()=>{
  const h=harness();h.open();byLabel(h.menu,'Nov 2, 2026').fire('click');assert.deepEqual(h.changes,[]);assert.equal(h.scope.startDate,'');byText(h.menu,'Apply').fire('click');
  assert.deepEqual(h.changes,[{startDate:'2026-11-02',endDate:'2026-11-02'}]);assert.equal(h.menu.isConnected,false);assert.equal(byLabel(h.host,'Session Date Range').textContent,'Nov 2, 2026');
});
test('range selection spans calendar months in either direction and current-session reset is explicit',()=>{
  const h=harness();h.open();byLabel(h.menu,'Nov 2, 2026').fire('click');byLabel(h.menu,'Previous month').fire('click');byLabel(h.menu,'Oct 30, 2026').fire('click');byText(h.menu,'Apply').fire('click');
  assert.deepEqual(h.changes,[{startDate:'2026-10-30',endDate:'2026-11-02'}]);assert.equal(byLabel(h.host,'Session Date Range').textContent,'Oct 30, 2026 – Nov 2, 2026');
  h.open();byText(h.menu,'Current session').fire('click');assert.deepEqual(h.changes[1],{startDate:'',endDate:''});assert.equal(byLabel(h.host,'Session Date Range').title,'Current session');
});
test('page/global date override disables the calendar and stale or destroyed popup callbacks cannot commit',()=>{
  const h=harness({startDate:'2026-10-16',endDate:'2026-10-19'});h.open();const oldApply=byText(h.menu,'Apply');h.scope.disabled=true;h.api.sync();assert.equal(h.menu.isConnected,false);oldApply.fire('click');h.open();assert.equal(h.changes.length,0);
  h.scope.disabled=false;h.api.sync();h.open();const late=byText(h.menu,'Current session');h.api.destroy();late.fire('click');assert.equal(h.changes.length,0);assert.equal(h.host.children.length,0);
});
test('closed previous popup cannot commit over a newly opened picker with the same selection',()=>{
  const h=harness();h.open();const stale=byText(h.menu,'Current session');h.open();stale.fire('click');assert.equal(h.changes.length,0);assert.equal(h.menu.isConnected,true);
});
test('request-model validation keeps an excessive range in the popup without committing or sending data',()=>{
  const h=harness({startDate:'2026-07-20',endDate:'2026-11-02'});h.open();byText(h.menu,'Apply').fire('click');assert.equal(h.menu.isConnected,true);assert.equal(h.changes.length,0);
  const error=descendants(h.menu).find(node=>node.attributes.role==='alert');assert.match(error.textContent,/at most three months/);
  byText(h.menu,'Current session').fire('click');assert.deepEqual(h.changes,[{startDate:'',endDate:''}]);assert.equal(h.menu.isConnected,false);
});
