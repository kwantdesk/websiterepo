import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountTickerShortcuts} from '../public/kwanty-app/ticker-shortcuts.js';
import {createSelectPreferences,SELECT_PREFERENCES_KEY} from '../public/kwanty-app/select-preferences.js';

function harness(){
 const storage=new Map(),preferences=createSelectPreferences({getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)});
 const doc={activeElement:null,defaultView:{Event:class{constructor(type){this.type=type;}}}};
 class Node{
  constructor(){this.ownerDocument=doc;this.children=[];this.dataset={};this.attributes={};this.events={};}
  replaceChildren(){this.children=[];}append(node){this.children.push(node);}contains(node){return this.children.includes(node);}
  setAttribute(key,value){this.attributes[key]=value;}focus(){doc.activeElement=this;}
  addEventListener(type,fn){(this.events[type]??=[]).push(fn);}removeEventListener(type,fn){this.events[type]=this.events[type]?.filter(value=>value!==fn);}
  dispatchEvent(event){for(const fn of this.events[event.type]||[])fn(event);}click(){this.dispatchEvent({type:'click'});}
 }
 doc.createElement=()=>new Node();const root=new Node(),select=new Node();
 select.options=['SPX','SPY','NDX','QQQ','DISABLED'].map(value=>({value,textContent:value,disabled:value==='DISABLED'}));
 select.value='SPX';let ticker='SPX',visible=true,switches=0,opened=0;const panels=[{ticker},{ticker},{ticker}];
 select.nextElementSibling={click:()=>opened++};
 select.addEventListener('change',()=>{ticker=select.value;switches++;for(const panel of panels)panel.ticker=ticker;});
 const mount=()=>mountTickerShortcuts({root,select,preferences,currentTicker:()=>ticker,isVisible:()=>visible});
 const controls=mount();
 return {root,select,preferences,panels,controls,mount,storage,doc,get switches(){return switches;},get opened(){return opened;},set visible(value){visible=value;}};
}

test('toolbar reads saved favourites only, updates live, and follows the shared ticker change path',()=>{
 const h=harness();assert.deepEqual(h.root.children.map(button=>button.textContent),['☆ Favourites']);
 h.root.children[0].click();assert.equal(h.opened,1);
 for(const ticker of ['SPY','NDX','QQQ','OLD','DISABLED'])h.preferences.toggleFavourite('instruments',ticker);
 assert.deepEqual(h.root.children.map(button=>button.textContent),['NDX','QQQ','SPY']);
 const qqq=h.root.children.find(button=>button.dataset.ticker==='QQQ');qqq.click();
 assert.equal(h.select.value,'QQQ');assert.equal(h.switches,1);assert.ok(h.panels.every(panel=>panel.ticker==='QQQ'));
 assert.equal(h.root.children.find(button=>button.dataset.ticker==='QQQ').attributes['aria-pressed'],'true');
 assert.equal(h.preferences.get('instruments').recent[0],'QQQ');
 h.root.children.find(button=>button.dataset.ticker==='QQQ').click();assert.equal(h.switches,1,'same ticker does not reload');
 h.select.value='NDX';h.select.dispatchEvent({type:'change'});
 assert.equal(h.root.children.find(button=>button.dataset.ticker==='NDX').attributes['aria-pressed'],'true');
 h.preferences.toggleFavourite('instruments','QQQ');assert.deepEqual(h.root.children.map(button=>button.textContent),['NDX','SPY']);
 h.controls.dispose();const reopened=h.mount();assert.deepEqual(h.root.children.map(button=>button.textContent),['NDX','SPY']);
 assert.ok(h.storage.has(SELECT_PREFERENCES_KEY));
 h.visible=false;reopened.render();assert.equal(h.root.hidden,true);assert.equal(h.root.children.length,0);
 h.visible=true;reopened.render();assert.equal(h.root.children.length,2);
 reopened.dispose();h.preferences.toggleFavourite('instruments','SPX');assert.equal(h.root.children.length,2,'unmounted observer removed');
});

test('shortcut row does not cap favourites at four and preserves keyboard focus on preference updates',()=>{
 const h=harness();for(let i=0;i<12;i++){const value='SYM'+i;h.select.options.push({value,textContent:value});h.preferences.toggleFavourite('instruments',value);}
 assert.equal(h.root.children.length,12);h.root.children[0].focus();const focused=h.doc.activeElement.dataset.ticker;
 h.preferences.toggleFavourite('instruments','SPX');assert.equal(h.doc.activeElement.dataset.ticker,focused);
 h.controls.dispose();
});

test('preference observers run only after successful account persistence',()=>{
 const calls=[];let fail=false;const prefs=createSelectPreferences({getItem:()=>null,setItem:()=>{if(fail)throw Error('quota');}});
 const dispose=prefs.subscribe(group=>calls.push(group));prefs.toggleFavourite('instruments','NDX');assert.deepEqual(calls,['instruments']);
 fail=true;assert.throws(()=>prefs.toggleFavourite('instruments','QQQ'));assert.equal(calls.length,1);dispose();
});

test('favourite group sits next to timeframes and shares the existing dropdown, not a new data path',()=>{
 const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const html=read('public/kwanty-app/index.html'),app=read('public/kwanty-app/app.js'),css=read('public/kwanty-app/site.css');
 assert.ok(html.indexOf('id="tickerFavourites"')>html.indexOf('class="timeframe-buttons"'));
 assert.ok(html.indexOf('id="tickerFavourites"')<html.indexOf('id="priceViewMode"'));
 assert.match(app,/select:\$\('#ticker'\),preferences:window.__kwantSelectPreferences/);
 assert.match(css,/\.ticker-favourites\{[^}]*overflow-x:auto/);
 assert.match(app,/tickerShortcuts\.render\(\)/);
 assert.doesNotMatch(read('public/kwanty-app/ticker-shortcuts.js'),/fetch\(|setInterval\(|setTimeout\(/);
});
