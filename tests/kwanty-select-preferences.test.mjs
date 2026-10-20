import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {choiceGroup,choiceSections,createSelectPreferences,SELECT_PREFERENCES_KEY} from '../public/kwanty-app/select-preferences.js';
const options=['SPX','QQQ','NDX','ES','NQ'].map(value=>({value,label:value}));
function memory(initial){const values=new Map(initial?[[SELECT_PREFERENCES_KEY,initial]]:[]);return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}

test('ticker directory stays complete and alphabetic despite recent and favourite shortcuts',()=>{
 const shuffled=['SPX','qqq','NDX','ES_SPX','AAPL','NQ_NDX','a2','A10'].map(value=>({value,label:value}));
 const rows=choiceSections(shuffled,{recent:['SPX','NDX'],favourites:['qqq','AAPL']},'',{group:'instruments'});
 assert.deepEqual(rows.map(row=>row.label),['Recent','Favourites','All tickers (A–Z)']);
 assert.deepEqual(rows.at(-1).options.map(row=>row.value),['a2','A10','AAPL','ES_SPX','NDX','NQ_NDX','qqq','SPX']);
 assert.ok(rows.at(-1).options.some(row=>row.value==='SPX'));assert.ok(rows.at(-1).options.some(row=>row.value==='qqq'));
 assert.deepEqual(shuffled.map(row=>row.value),['SPX','qqq','NDX','ES_SPX','AAPL','NQ_NDX','a2','A10']);
});
test('ticker search is case insensitive, trimmed, alphabetic and contains no repeated shortcut results',()=>{
 const prefs={recent:['NQ','QQQ'],favourites:['QQQ']};
 const sections=choiceSections(options,prefs,'  q  ',{group:'instruments'});
 assert.deepEqual(sections.map(row=>row.label),['Search results']);
 assert.deepEqual(sections[0].options.map(row=>row.value),['NQ','QQQ']);
 assert.deepEqual(choiceSections(options,prefs,'no-match',{group:'instruments'}),[]);
 const filtered=choiceSections(options,{...prefs,favouritesOnly:true},'q',{group:'instruments'});
 assert.deepEqual(filtered[0].options.map(row=>row.value),['QQQ']);
});
test('ticker favourites-only and recents toggle retain predictable alphabetic lists',()=>{
 const rows=choiceSections(options,{recent:['QQQ'],favourites:['SPX','ES'],showRecents:false},'',{group:'instruments'});
 assert.deepEqual(rows.map(row=>row.label),['Favourites','All tickers (A–Z)']);
 assert.deepEqual(rows.at(-1).options.map(row=>row.value),['ES','NDX','NQ','QQQ','SPX']);
 const only=choiceSections(options,{recent:['SPX'],favourites:['SPX','ES'],favouritesOnly:true},'',{group:'instruments'});
 assert.deepEqual(only.map(row=>row.label),['Favourite tickers (A–Z)']);assert.deepEqual(only[0].options.map(row=>row.value),['ES','SPX']);
});
test('all three KWANTY modes use the same searchable ticker menu contract',()=>{
 const adapter=readFileSync(new URL('../public/gex-data-app/themed-select.js',import.meta.url),'utf8');
 assert.match(adapter,/group==='instruments'\?'Search tickers'/);
 assert.match(adapter,/preferences\.sections\(options,prefs,search\.value,\{group\}\)/);
 const app=readFileSync(new URL('../public/kwanty-app/index.html',import.meta.url),'utf8');
 assert.equal((app.match(/id="ticker"/g)||[]).length,1);
});

test('Classic, State and Orderflow share ticker recents/favourites across reopening',()=>{
  const storage=memory(),classic=createSelectPreferences(storage),state=createSelectPreferences(storage),orderflow=createSelectPreferences(storage);
  const group=choiceGroup({id:'ticker'});classic.toggleFavourite(group,'NDX');state.select(group,'QQQ');orderflow.select(group,'NQ');
  assert.deepEqual(classic.get(group).recent,['NQ','QQQ']);assert.deepEqual(state.get(group).favourites,['NDX']);
  assert.deepEqual(createSelectPreferences(storage).get(group),orderflow.get(group));
});
test('recents are most recent first, deduplicated and limited to16',()=>{
  const prefs=createSelectPreferences(memory());for(let i=0;i<30;i++)prefs.select('instruments','SYM'+i);
  prefs.select('instruments','SYM20');const recent=prefs.get('instruments').recent;
  assert.equal(recent.length,16);assert.equal(recent[0],'SYM20');assert.equal(new Set(recent).size,16);
});
test('recent, favourite and all sections never duplicate a choice',()=>{
  const sections=choiceSections(options,{recent:['NQ','QQQ','REMOVED'],favourites:['NDX','NQ'],showRecents:true});
  assert.deepEqual(sections.map(section=>section.label),['Recent','Favourites','All options']);
  assert.deepEqual(sections[0].options.map(option=>option.value),['NQ','QQQ']);
  assert.deepEqual(sections[1].options.map(option=>option.value),['NDX']);
  const all=sections.flatMap(section=>section.options.map(option=>option.value));assert.equal(new Set(all).size,5);
});
test('favourites-only excludes unfavourited recents, search and recents-first persist',()=>{
  const storage=memory(),prefs=createSelectPreferences(storage);prefs.select('instruments','NQ');prefs.toggleFavourite('instruments','NDX');prefs.toggleFavourite('instruments','QQQ');
  prefs.update('instruments',{favouritesOnly:true,showRecents:false});
  const saved=createSelectPreferences(storage).get('instruments');assert.equal(saved.favouritesOnly,true);assert.equal(saved.showRecents,false);
  assert.deepEqual(choiceSections(options,saved,'q').flatMap(section=>section.options.map(option=>option.value)),['QQQ']);
  assert.deepEqual(choiceSections(options,saved,'nothing'),[]);
});
test('turning the filter off restores all choices; toggling favourites never selects one',()=>{
  const prefs=createSelectPreferences(memory());prefs.toggleFavourite('instruments','NQ');prefs.update('instruments',{favouritesOnly:true});
  assert.equal(choiceSections(options,prefs.get('instruments')).flatMap(section=>section.options).length,1);
  prefs.update('instruments',{favouritesOnly:false});assert.equal(choiceSections(options,prefs.get('instruments')).flatMap(section=>section.options).length,5);
  prefs.toggleFavourite('instruments','NQ');assert.deepEqual(prefs.get('instruments').favourites,[]);assert.deepEqual(prefs.get('instruments').recent,[]);
});
test('metric/time-window lists share across panel IDs without mixing with tickers',()=>{
  assert.equal(choiceGroup({label:'Metric panel-1'}),choiceGroup({label:'Metric panel-99'}));
  assert.equal(choiceGroup({label:'Time window panel-1'}),choiceGroup({label:'Time window panel-99'}));
  assert.notEqual(choiceGroup({label:'Metric panel-1'}),choiceGroup({label:'Time window panel-1'}));
  assert.equal(choiceGroup({values:['left','right']}),choiceGroup({values:['right','left']}));
  assert.equal(choiceGroup({name:'timeZone'}),'setting:timeZone');
});
test('accounts are isolated, corrupt stores recover, unsafe groups and quota failures reject',()=>{
  const a=createSelectPreferences(memory()),b=createSelectPreferences(memory());a.toggleFavourite('instruments','NQ');assert.deepEqual(b.get('instruments').favourites,[]);
  const corrupt=createSelectPreferences(memory('{bad'));assert.deepEqual(corrupt.get('instruments').recent,[]);corrupt.select('instruments','ES');assert.deepEqual(corrupt.get('instruments').recent,['ES']);
  assert.throws(()=>a.select('__proto__','BAD'));assert.equal({}.recent,undefined);
  const failed=createSelectPreferences({getItem:()=>null,setItem:()=>{throw Error('quota');}});assert.throws(()=>failed.toggleFavourite('instruments','NQ'),/quota/);assert.deepEqual(failed.get('instruments').favourites,[]);
});
test('stale options stay saved but absent; disabled options retain their disabled flag',()=>{
  const prefs={favourites:['OLD','NQ'],recent:['OLD'],favouritesOnly:true};
  const rows=choiceSections([{value:'NQ',label:'NQ',disabled:true}],prefs).flatMap(section=>section.options);
  assert.equal(rows.length,1);assert.equal(rows[0].disabled,true);assert.equal(rows[0].value,'NQ');
});
test('host account persistence preserves favourites when workspaces are restored',()=>{
  const host=readFileSync(new URL('../src/components/kwanty/KwantyWorkspace.tsx',import.meta.url),'utf8');
  assert.match(host,/snapshot:[^\n]+key !== "kwanty:select-preferences:v1"/);
  assert.match(host,/const selectPreferences = readValues\(\)\["kwanty:select-preferences:v1"\]/);
  assert.match(host,/selectPreferences \? \{ "kwanty:select-preferences:v1": selectPreferences \}/);
  const runtime=readFileSync(new URL('../public/kwanty-app/site-runtime.js',import.meta.url),'utf8');
  assert.match(runtime,/window\.__kwantSelectPreferences=createSelectPreferences\(botStorage\)/);
});
