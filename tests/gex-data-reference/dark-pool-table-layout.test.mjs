import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {createTableView} from '../../public/gex-data-app/table-view.js';
import {prepareDarkPoolLevels,DARK_POOL_LEVEL_COLUMNS} from '../../public/gex-data-app/equity-renderers.js';

class Node{
 constructor(document,tag='div'){this.ownerDocument=document;this.tagName=tag;this.children=[];this.style={};this.dataset={};this.attributes={};this.classList={add(){}};}
 append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 setAttribute(key,value){this.attributes[key]=value;}addEventListener(){}removeEventListener(){}
 querySelectorAll(selector){return selector==='tr:first-child th'?(this.children[0]?.children??[]):[];}
}
test('actual Dark Pool renderer keeps early columns compact, lets only the final visible column fill and preserves resized widths',()=>{
 const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),fragment=source.slice(source.indexOf('  function renderDarkLevelsQuant('),source.indexOf('  function renderOhlcQuant('));let received;
 const env={getControl:key=>key==='topLevels'?'50':'',number:Number,prepareDarkPoolLevels,DARK_POOL_LEVEL_COLUMNS,formatPrice:String,setSummary(){},netDriftContractControls:null,showTable:(rows,columns,total,config)=>{received={rows,columns,total,config};}};
 vm.runInNewContext(fragment+'\nthis.render=renderDarkLevelsQuant;',env);env.render({data:{750:{notionalValue:100,tradeCount:4,size:10},751:{notionalValue:50,tradeCount:2,size:5}}});
 const document={createElement:tag=>new Node(document,tag),createTextNode:text=>({textContent:text}),addEventListener(){},removeEventListener(){}};document.body=new Node(document);
 const table=new Node(document,'table');table.tBodies=[];let head;table.createTHead=()=>head=new Node(document,'thead');table.createTBody=()=>new Node(document,'tbody');table.createTFoot=()=>new Node(document,'tfoot');
 const saved={widths:{price:115},order:['rank','price','notionalValue','tradeCount','volume'],hidden:[]};
 const view=createTableView({table,storage:{getItem:()=>JSON.stringify(saved),setItem(){}}});
 view.setRows(received.rows,{...received.config,columns:received.columns,toolId:'dark-pool-levels'});
 assert.equal(table.style.width,'100%');assert.equal(table.style.minWidth,'615px');
 assert.deepEqual(head.children[0].children.map(node=>node.style.width),['70px','115px','150px','140px','auto']);
 view.setVisible('volume',false);assert.equal(head.children[0].children.at(-1).style.width,'auto');assert.equal(head.children[0].children[1].style.width,'115px');view.destroy();
});

test('Dark Pool opt-in local sort survives reopening without overriding server-owned sorts',()=>{
 const store=new Map(),storage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};
 function open(configuration={}){
  const document={createElement:tag=>new Node(document,tag),createTextNode:text=>({textContent:text}),addEventListener(){},removeEventListener(){}};document.body=new Node(document);
  const table=new Node(document,'table');table.tBodies=[];table.createTHead=()=>new Node(document,'thead');table.createTBody=()=>new Node(document,'tbody');table.createTFoot=()=>new Node(document,'tfoot');
  const view=createTableView({table,storage});view.setRows([{price:750,notionalValue:100},{price:751,notionalValue:50}],{toolId:'dark-pool-levels',columns:DARK_POOL_LEVEL_COLUMNS,sortKey:'price',persistLocalSort:true,...configuration});return view;
 }
 const first=open();first.setSort('notionalValue',1);assert.equal(first.getVisibleRows()[0].notionalValue,50);first.destroy();
 const reopened=open();assert.equal(reopened.getSort().id,'notionalValue');assert.equal(reopened.getSort().direction,1);assert.equal(reopened.getVisibleRows()[0].notionalValue,50);reopened.destroy();
 const server=open({onSortChange(){}});assert.equal(server.getSort().id,'price');server.destroy();
 const other=open({persistLocalSort:false});assert.equal(other.getSort().id,'price');other.destroy();
});
