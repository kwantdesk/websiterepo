import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {mountDarkPoolLevelLimit} from '../../public/gex-data-app/dark-pool-level-controls.js';
import {prepareDarkPoolLevels,DARK_POOL_LEVEL_COLUMNS} from '../../public/gex-data-app/equity-renderers.js';
import {formatTableValue} from '../../public/gex-data-app/table-view.js';
class Node{
  constructor(tag,document){this.tagName=tag;this.ownerDocument=document;this.children=[];this.style={};this.events={};this.attributes={};this.isConnected=true;}
  append(...nodes){this.children.push(...nodes);}setAttribute(key,value){this.attributes[key]=value;}addEventListener(key,fn){this.events[key]=fn;}remove(){this.isConnected=false;}
  fire(key){if(!this.disabled)this.events[key]?.({target:this});}
}
const all=node=>[node,...node.children.flatMap(all)];
test('Top-N slider uses actual count, six source marks and integer changes without closing or inventing inventory',()=>{
  const document={createElement:tag=>new Node(tag,document)},host=document.createElement('div'),scope={limit:50,available:289},writes=[];let menu;
  const api=mountDarkPoolLevelLimit({host,getScope:()=>scope,popup:(_anchor,title,build)=>{menu=document.createElement('section');menu.title=title;build(menu);return menu;},onChange:limit=>{writes.push(limit);scope.limit=limit;api.sync();}});
  const trigger=all(host).find(node=>node.tagName==='button');trigger.fire('click');
  const slider=all(menu).find(node=>node.type==='range');assert.equal(menu.title,'Modify Level Limit');assert.deepEqual([slider.min,slider.max,slider.step,slider.value],['1','289','1','50']);
  assert.deepEqual(all(menu).filter(node=>node.tagName==='span').map(node=>node.textContent),['1','48','96','145','193','241']);
  assert.equal(all(menu).find(node=>node.attributes['aria-label']==='Reset Top Levels Count').hidden,true);
  slider.value='10';slider.fire('input');assert.deepEqual(writes,[10]);assert.equal(trigger.textContent,'Top 10 ⌄');assert.equal(menu.isConnected,true);
  const reset=all(menu).find(node=>node.attributes['aria-label']==='Reset Top Levels Count');assert.equal(reset.hidden,false);reset.fire('click');assert.equal(writes.at(-1),50);assert.equal(slider.value,'50');assert.equal(reset.hidden,true);
  scope.available=1324;api.sync();assert.equal(menu.isConnected,false);slider.value='20';slider.fire('input');assert.equal(writes.at(-1),50);
  trigger.fire('click');assert.equal(all(menu).find(node=>node.type==='range').max,'1324');
  scope.available=0;api.sync();assert.equal(trigger.disabled,true);api.destroy();
});

test('actual Dark Pool renderer selects by notional but leaves price-descending table headers as sort owner',()=>{
  const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');const fragment=source.slice(source.indexOf('  function renderDarkLevelsQuant('),source.indexOf('  function renderOhlcQuant('));let table;
  const env={getControl:key=>({topLevels:'2',levelMetric:'tradeCount'})[key]??'',number:Number,prepareDarkPoolLevels,DARK_POOL_LEVEL_COLUMNS,
    showTable:(rows,columns,total,config)=>{table={rows,columns,total,config};},setSummary(){},formatPrice:String,netDriftContractControls:null};
  vm.runInNewContext(fragment+'\nthis.render=renderDarkLevelsQuant;',env);
  env.render({data:{'100':{notionalValue:1000,tradeCount:2,size:10},'101':{notionalValue:2000,tradeCount:1,size:20},'102':{notionalValue:5,tradeCount:999,size:30}}});
  assert.deepEqual(table.rows.map(row=>row.price),[101,100]);assert.equal(table.config.sortKey,'price');
  assert.equal(table.config.inlineFilters,false);
  assert.notEqual(table.columns.find(column=>column.key==='tradeCount').sortable,false);
});

test('actual table adapter mounts Dark Pool columns in top bar and restores ordinary tools across host remounts',()=>{
  const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),fragment=source.slice(source.indexOf('  function showTable('),source.indexOf('  function renderFlowStatistics('));
  const originalHome={id:'table-tools'},toolbar={id:'tool-controls'},normalHost={parent:originalHome},topHost={parent:toolbar},wrap={hidden:true,classList:{toggle(name,value){this[name]=value;}}};
  const nodes={'#toolTableWrap':wrap,'#tableColumnControls':normalHost,'#darkPoolColumnControls':topHost,'#toolVisual':{},'#chartToolbar':{},'#toolTable':{},'#tableSearch':{},'#tableCount':{},'#loadMore':{}},instances=[];
  const env={activeTool:{id:'dark-pool-levels'},tableRuntime:null,tableColumnHost:null,tableCursor:null,toolCursor:null,instanceKey:'test',gexStorage:{getItem:()=>null,setItem(){}},q:key=>nodes[key],
    createTableView:options=>{const instance={options,sets:[],destroyed:0,setRows(rows,config){this.sets.push({rows,config});},destroy(){this.destroyed++;}};instances.push(instance);return instance;}};
  vm.runInNewContext(source.slice(source.indexOf('  function syncGainersHeaderSort('),source.indexOf('\n  function ',source.indexOf('  function syncGainersHeaderSort(')+5))+fragment+'\nthis.show=showTable;',env);
  const rows=[{rank:1,price:100,notionalValue:1000,tradeFraction:.5}],schema=[{key:'price'}];
  env.show(rows,schema,null,{sortKey:'price',inlineFilters:false});
  assert.equal(instances[0].options.columnHost,topHost);assert.equal(instances[0].options.search,null);assert.equal(instances[0].options.count,null);
  assert.equal(instances[0].sets[0].config.inlineFilters,false);assert.equal(instances[0].sets[0].rows,rows);assert.equal(wrap.classList['dark-pool-level-table'],true);
  env.show(rows,schema,null,{sortKey:'price',inlineFilters:false});assert.equal(instances.length,1,'same toolbar host preserves runtime and column state');
  const remount={parent:toolbar};nodes['#darkPoolColumnControls']=remount;env.show(rows,schema,null,{inlineFilters:false});assert.equal(instances[0].destroyed,1);assert.equal(instances[1].options.columnHost,remount);
  env.activeTool={id:'unrelated-table'};env.show(rows,schema);assert.equal(instances[1].destroyed,1);assert.equal(instances[2].options.columnHost,normalHost);
  assert.equal(instances[2].options.search,nodes['#tableSearch']);assert.equal(instances[2].options.count,nodes['#tableCount']);assert.equal(instances[2].sets[0].config.inlineFilters,true);
  assert.equal(wrap.classList['dark-pool-level-table'],false);assert.equal(normalHost.parent,originalHome,'ordinary column host never enters disposable top controls');
});

test('actual Dark Pool rank schema renders ordinal1324 without grouping and is immutable/non-sortable like source41880',()=>{
  const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),fragment=source.slice(source.indexOf('  function renderDarkLevelsQuant('),source.indexOf('  function renderOhlcQuant('));let table;
  const data=Object.fromEntries(Array.from({length:1324},(_,index)=>[String(index+100),{notionalValue:index+1,tradeCount:1234,size:2000}]));
  const env={getControl:key=>key==='topLevels'?'1324':'',number:Number,prepareDarkPoolLevels,DARK_POOL_LEVEL_COLUMNS,showTable:(rows,columns)=>{table={rows,columns};},setSummary(){},formatPrice:String,netDriftContractControls:null};
  vm.runInNewContext(fragment+'\nthis.render=renderDarkLevelsQuant;',env);env.render({data});
  const rank=table.columns.find(column=>column.key==='rank'),trades=table.columns.find(column=>column.key==='tradeCount');
  assert.equal(table.rows.length,1324);assert.equal(rank.sortable,false);assert.equal(rank.canHide,false);
  for(const index of [0,999,1239,1323])assert.equal(formatTableValue(table.rows[index].rank,rank,table.rows[index],{timeZone:'UTC'}),String(index+1));
  assert.equal(typeof table.rows[1323].rank,'number','observed ordinal data remains numeric');
  assert.equal(formatTableValue(1234,trades,{}, {timeZone:'UTC'}),'1.23 K','other numeric columns retain their own formatting');
});

test('actual Dark Pool price schema uses source auto currency while other execution price columns retain cents',()=>{
  const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),fragment=source.slice(source.indexOf('  function renderDarkLevelsQuant('),source.indexOf('  function renderOhlcQuant('));let table;
  const env={getControl:key=>key==='topLevels'?'50':'',number:Number,prepareDarkPoolLevels,DARK_POOL_LEVEL_COLUMNS,showTable:(rows,columns)=>{table={rows,columns};},setSummary(){},formatPrice:String,netDriftContractControls:null};
  vm.runInNewContext(fragment+'\nthis.render=renderDarkLevelsQuant;',env);env.render({data:{'773':{notionalValue:100,tradeCount:1,size:1},'773.1':{notionalValue:200,tradeCount:2,size:2}}});
  const column=table.columns.find(column=>column.key==='price');
  assert.equal(formatTableValue(773,column,{}, {timeZone:'UTC'}),'$773');
  assert.equal(formatTableValue(773.1,column,{}, {timeZone:'UTC'}),'$773.10');
  assert.equal(formatTableValue(773,{key:'price',type:'money'}, {},{timeZone:'UTC'}),'$773.00');
  assert.equal(formatTableValue(773,{key:'price',type:'priceSide'}, {},{timeZone:'UTC'}),'$773.00');
  assert.equal(table.rows[0].price,773.1);assert.equal(table.rows[1].price,773);
});
