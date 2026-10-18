import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {choicesWithSaved,instrumentChoices,setChoiceValue,snapshotTimeOptions,multiChoiceDropdown} from '../../public/gex-data-app/choice-controls.js';

test('instrument list and saved choices preserve valid selections without duplicate or HTML insertion',()=>{
  assert.ok(instrumentChoices().some(([value])=>value==='QQQ'));
  assert.deepEqual(choicesWithSaved([['QQQ','Nasdaq ETF'],['SPY','S&P ETF']],['TSM','QQQ','TSM']),[['QQQ','Nasdaq ETF'],['SPY','S&P ETF'],['TSM','TSM — saved selection']]);
  const control={value:'QQQ',options:[{value:'QQQ'}],ownerDocument:{createElement:()=>({})},append(option){this.options.push(option);}};
  setChoiceValue(control,'TSM');assert.equal(control.value,'TSM');assert.equal(control.options.at(-1).textContent,'TSM — saved selection');setChoiceValue(control,'QQQ');assert.equal(control.options.length,2);
});
test('snapshot dropdown offers only real available timestamps and keeps original indices',()=>{
  const timeline=[1000,5000,6000];const options=snapshotTimeOptions(timeline,time=>`time:${time}`);
  assert.deepEqual(options,[['0','time:1000'],['1','time:5000'],['2','time:6000 · Latest available']]);
  assert.deepEqual(snapshotTimeOptions([],String),[]);
});
class Element extends EventTarget {
  constructor(tag,doc){super();this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.attributes={};}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=[...items];}
  setAttribute(name,value){this.attributes[name]=value;}
}
test('multi-choice dropdown preserves OR selections, checkbox changes and clearing without typed CSV',()=>{
  const previous=globalThis.document;const doc={createElement:tag=>new Element(tag,doc)};globalThis.document=doc;
  try{
    const picker=multiChoiceDropdown({choices:[['SPY','SPY'],['QQQ','QQQ']],values:['SPY','TSM'],label:'Test instruments'});
    assert.equal(picker.tagName,'DETAILS');assert.equal(picker.value,'SPY, TSM');
    let changes=0;picker.addEventListener('change',()=>changes++);
    const options=picker.children[1],qqq=options.children.find(row=>row.children?.[0]?.value==='QQQ').children[0];
    qqq.checked=true;qqq.dispatchEvent(new Event('change'));assert.equal(picker.value,'SPY, TSM, QQQ');assert.equal(changes,1);
    picker.value='QQQ, AMD';assert.equal(picker.value,'QQQ, AMD');assert.equal(changes,1);
    picker.children[1].children[0].dispatchEvent(new Event('click'));assert.equal(picker.value,'');assert.equal(changes,2);assert.equal(picker.children[0].textContent,'All instruments');
  }finally{globalThis.document=previous;}
});
test('all instrument restores and overrides use the select-aware path; snapshot and enum choices are dropdowns',()=>{
  const app=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');
  assert.match(app,/ticker: \["Instrument", "select"/);assert.match(app,/tickerOptional: \["Instrument", "select"/);
  assert.match(app,/setChoiceValue\(control,result.value\[0\]\)/);assert.match(app,/setChoiceValue\(control,control.dataset.overrideOwn\)/);
  assert.match(app,/setControl\(input.dataset.control,value\)/);assert.match(app,/aria-label','Snapshot time/);assert.match(app,/range.value=timeSelect.value;select\(\)/);
  const editor=readFileSync(new URL('../../public/gex-data-app/filter-editor.js',import.meta.url),'utf8');assert.doesNotMatch(editor,/datalist/);assert.match(editor,/metadata\?\.choices\)input=multiChoiceDropdown/);
});
