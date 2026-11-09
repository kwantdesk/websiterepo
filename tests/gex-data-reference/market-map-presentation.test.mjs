import {numericControlChoices} from '../../public/gex-data-app/numeric-control-options.js';
import {gainersIndustryChoices} from '../../public/gex-data-app/gainers-industry-controls.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {marketMapColor} from '../../public/gex-data-app/chart-primitives.js';
import {installTheme} from '../../public/gex-data-app/site-theme.js?v=1';
import {observeMarketMapIndustries,marketMapIndustryChoices,marketMapEnumLabel,marketMapTooltipRows} from '../../public/gex-data-app/market-map-presentation.js';
import {multiChoiceDropdown} from '../../public/gex-data-app/choice-controls.js';
import {toolControlDefault} from '../../public/gex-data-app/tool-control-defaults.js';

test('Market Map signed scale interpolates through the selected background and clamps at +/-3%',()=>{
  assert.equal(marketMapColor(0,'#ffffff'),'rgb(255,255,255)');
  assert.equal(marketMapColor(0,'#05070b'),'rgb(5,7,11)');
  assert.equal(marketMapColor(1.5,'#ffffff'),'rgb(142,230,147)');
  assert.equal(marketMapColor(-1.5,'#ffffff'),'rgb(230,128,128)');
  for(const value of [3,5,100])assert.equal(marketMapColor(value,'#ffffff'),'rgb(28,204,38)');
  for(const value of [-3,-5,-100])assert.equal(marketMapColor(value,'#ffffff'),'rgb(204,0,0)');
  assert.equal(marketMapColor(0,'#abc'),'rgb(170,187,204)');
  assert.equal(marketMapColor(0,'rgb(12, 34, 56)'),'rgb(12,34,56)');
  assert.equal(marketMapColor(0,'hsl(240 100% 50%)'),'rgb(0,0,255)');
});

test('actual theme changes immediately change the neutral Market Map colour without network',async()=>{
  const priorDocument=globalThis.document,priorFetch=globalThis.fetch;
  globalThis.document={documentElement:{style:{setProperty(){},removeProperty(){}},setAttribute(){}}};
  globalThis.fetch=async()=>({ok:true,json:async()=>[]});
  try{await installTheme({background:'#ffffff'});assert.equal(marketMapColor(0),'rgb(255,255,255)');await installTheme({background:'#05070b'});assert.equal(marketMapColor(0),'rgb(5,7,11)');}
  finally{globalThis.document=priorDocument;globalThis.fetch=priorFetch;}
});

const data={A:{industry:'SOFTWARE_INFRASTRUCTURE',sector:'TECHNOLOGY'},B:{industry:'BANKS_REGIONAL',sector:'FINANCIAL_SERVICES'},C:{industry:'SOFTWARE_INFRASTRUCTURE',sector:'COMMUNICATION_SERVICES'},D:{sector:'ENERGY'}};
test('industry inventory is observed-only, bounded, nonmutating and supports multiple sectors',()=>{
  const inventory=observeMarketMapIndustries(new Map(),data);
  assert.deepEqual(marketMapIndustryChoices(inventory),[['BANKS_REGIONAL','Banks Regional'],['SOFTWARE_INFRASTRUCTURE','Software Infrastructure']]);
  assert.deepEqual(marketMapIndustryChoices(inventory,'TECHNOLOGY, ENERGY'),[['SOFTWARE_INFRASTRUCTURE','Software Infrastructure']]);
  assert.deepEqual(marketMapIndustryChoices(inventory,'ENERGY'),[]);
  const next=observeMarketMapIndustries(inventory,{E:{industry:'OIL_GAS',sector:'ENERGY'}});
  assert.equal(inventory.size,2);assert.equal(next.size,3);
  assert.equal(observeMarketMapIndustries(new Map(),data,1).size,1);
  assert.equal(observeMarketMapIndustries(new Map(),{}).size,0);
  assert.equal(marketMapEnumLabel('FINANCIAL_SERVICES'),'Financial Services');
});

test('Market Map tooltip uses source field labels/display enums and unchanged public dollar values',()=>{
  const row={ticker:'TEST',companyName:'Example',weight:123456789,currentValue:42.75,change:1.25,sector:'FINANCIAL_SERVICES',industry:'BANKS_REGIONAL'},before=structuredClone(row);
  assert.deepEqual(marketMapTooltipRows(row,{formatPrice:value=>`$${value}`,formatMarketCap:value=>`$${value}`}),['TEST','Example','Market Cap: $123456789','Sector: Financial Services','Industry: Banks Regional',{parts:[{text:'Underlying Price: $42.75 ('},{text:'▲ ',tone:'bullish'},{text:'1.25%)'}]}]);
  assert.deepEqual(row,before);
  assert.deepEqual(marketMapTooltipRows(null,{}),[]);
});

class Element extends EventTarget{
  constructor(tag,document){super();this.tagName=tag.toUpperCase();this.ownerDocument=document;this.children=[];this.dataset={};this.attributes={};this.value='';}
  append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
  replaceChildren(...children){this.children=[];this.append(...children);}
  setAttribute(key,value){this.attributes[key]=value;}
  contains(target){return target===this||this.children.some(child=>child.contains?.(target));}
}
const descend=node=>[node,...node.children.flatMap(descend)];
const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');
function actual(name){const match=new RegExp(`^  function ${name}\\(`,'m').exec(source);assert.ok(match);const rest=source.slice(match.index+match[0].length),next=/^  (?:async )?function /m.exec(rest);assert.ok(next);return source.slice(match.index,match.index+match[0].length+next.index);}
function pickerHarness({saved,copied,toolId='market-map'}={}){
  const document={createElement:tag=>new Element(tag,document)},holder=document.createElement('div');
  const tool={id:toolId,controls:['industry']};
  const env={document,activeTool:tool,CONTROL_OPTIONS:{},toolControlDefault,numericControlChoices,marketMapIndustryChoices,marketMapIndustryInventory:observeMarketMapIndustries(new Map(),data),
    gainersIndustryChoices,instrumentChoices:()=>[],multiChoiceDropdown:options=>multiChoiceDropdown({...options,document}),element:(tag,cls)=>{const node=document.createElement(tag);node.className=cls;return node;},
    q:selector=>selector==='#toolControls'?holder:descend(holder).find(node=>node.dataset?.control===/data-control="([^"]+)"/.exec(selector)?.[1]),qa:()=>descend(holder).filter(node=>node.dataset?.control),
    commonSessionDateControls:null,netDriftContractControls:null,savedToolControls:saved?{[toolId]:saved}:{},VIEW_PARAMETERS:new URLSearchParams(copied?{instance:'copy',...copied}:{}),getFilterOverrides:()=>({page:{},global:{}})};
  const start=source.indexOf('  const CONTROL_META = {'),end=source.indexOf('\n  const q =',start),render=actual('renderControls'),stop=render.indexOf('    const surfaceSelections=');assert.ok(start>=0&&end>start&&stop>0);
  vm.runInNewContext(source.slice(start,end)+['makeControl','getControl','setControl'].map(actual).join('\n')+render.slice(0,stop)+'\n}\nthis.render=renderControls;',env);
  env.render(tool);return env.q('[data-control="industry"]');
}

test('actual Market Map factory provides themed searchable multi-select with saved/copy restoration',()=>{
  const picker=pickerHarness({saved:{industry:'BANKS_REGIONAL, LEGACY_INDUSTRY'}});
  assert.equal(picker.tagName,'DETAILS');assert.equal(picker.className,'choice-dropdown');assert.match(picker.title,/observed/);
  assert.equal(picker.children[1].children[0].type,'search');
  assert.equal(picker.value,'BANKS_REGIONAL, LEGACY_INDUSTRY');
  assert.equal(pickerHarness({copied:{c_industry:'SOFTWARE_INFRASTRUCTURE, BANKS_REGIONAL'}}).value,'SOFTWARE_INFRASTRUCTURE, BANKS_REGIONAL');
  assert.equal(pickerHarness({saved:{industry:'BANKS_REGIONAL'},copied:{c_industry:'SOFTWARE_INFRASTRUCTURE'}}).value,'BANKS_REGIONAL');
});

test('observed choice refresh preserves open menu, search and absent saved selections without reload events',()=>{
  const picker=pickerHarness({saved:{industry:'BANKS_REGIONAL, LEGACY_INDUSTRY'}}),panel=picker.children[1],search=panel.children[0];
  picker.open=true;search.value='bank';let changes=0;picker.addEventListener('change',()=>changes++);
  picker.setChoices([['OIL_GAS','Oil Gas']]);
  assert.equal(picker.open,true);assert.equal(panel.children[0],search);assert.equal(search.value,'bank');
  assert.equal(picker.value,'BANKS_REGIONAL, LEGACY_INDUSTRY');assert.equal(changes,0);
  assert.equal(panel.children[2].children[0].children[0].value,'BANKS_REGIONAL');
});


test('Market Map tooltip direction uses arrows without positive plus while tile precision stays independent',()=>{
  const base={ticker:'TEST',companyName:'Example',size:1,currentValue:100,sector:'TECHNOLOGY',industry:'SEMICONDUCTORS'};
  for(const [change,text,arrow]of [[1.25,'1.25%)','▲ '],[-1.25,'-1.25%)','▼ '],[0,'0.00%)',null],[1,'1.00%)','▲ ']]){
    const parts=marketMapTooltipRows({...base,change},{formatMarketCap:String}).at(-1).parts;
    assert.equal(parts[0].text,'Underlying Price: $100 (');assert.equal(parts.at(-1).text,text);assert.equal(parts.length,arrow?3:2);if(arrow)assert.equal(parts[1].text,arrow);
  }
});


test('Gainers Industry is searchable multi-select with factual sector choices and retained legacy selection',()=>{
  const picker=pickerHarness({toolId:'gainers-losers',saved:{industry:'SEMICONDUCTORS, LEGACY_INDUSTRY'}});assert.equal(picker.tagName,'DETAILS');assert.equal(picker.children[1].children[0].type,'search');assert.equal(picker.value,'SEMICONDUCTORS, LEGACY_INDUSTRY');
  const tech=gainersIndustryChoices('TECHNOLOGY');assert.ok(tech.some(([key,label])=>key==='SOFTWARE__INFRASTRUCTURE'&&label==='Software - Infrastructure'));assert.equal(tech.some(([key])=>key==='BANKS__REGIONAL'),false);assert.ok(gainersIndustryChoices('TECHNOLOGY, FINANCIAL_SERVICES').some(([key])=>key==='BANKS__REGIONAL'));assert.equal(gainersIndustryChoices().length,161);
});
