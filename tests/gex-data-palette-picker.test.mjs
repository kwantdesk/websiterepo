import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync(new URL('../src/components/gex-data/GexPaletteSettings.tsx',import.meta.url),'utf8');
function picker(){
  let cursor=0,tree;const hooks=[],events=[];
  const context={exports:{},require:name=>{
    if(name==='react')return {
      useState:value=>{const i=cursor++;if(!(i in hooks))hooks[i]=value;return [hooks[i],value=>{hooks[i]=value;}];},
      useRef:value=>{const i=cursor++;return hooks[i]??=( {current:value} );},useCallback:fn=>fn,
    };
    if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,...props}),jsxs:(type,props)=>({type,...props})};
    if(name==='lucide-react')return {X:'icon'};
    if(name.includes('gexMapPalette'))return {GEX_MAP_PALETTE_PRESETS:[{id:'viridis',label:'Viridis'}]};
    if(name.includes('gexBoxTheme'))return {resolveGexBoxRoles:()=>({scale:['#aabbcc'],call:'#aaff00',put:'#ff3366',strike:'#cccccc',header:'#999999'})};
    throw Error(name);
  }};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText,context);
  const draw=()=>{cursor=0;tree=context.exports.default({paletteId:'site',includeSiteTheme:true,onPreview:id=>events.push(['preview',id]),onSave:id=>events.push(['save',id]),onClose:()=>events.push(['close'])});};
  const all=node=>node&&typeof node==='object'?[node,...[node.children].flat(Infinity).flatMap(all)]:[];
  const text=node=>typeof node==='string'?node:node&&typeof node==='object'?[node.children].flat(Infinity).map(text).join(''):'';
  const click=(label,{aria=false}={})=>{const found=all(tree).find(n=>n.type==='button'&&(aria?n['aria-label']===label:text(n).includes(label)));assert.ok(found,label);found.onClick();draw();};
  draw();return {click,events,text:()=>text(tree)};
}

test('palette previews without saving; Save persists the chosen preset',()=>{
  const p=picker();p.click('Viridis');assert.deepEqual(p.events,[['preview','viridis']]);
  p.click('Save');assert.deepEqual(p.events,[['preview','viridis'],['save','viridis']]);
});
test('Discard restores the original site theme rather than saving the preview',()=>{
  const p=picker();p.click('Viridis');p.click('Discard');
  assert.deepEqual(p.events,[['preview','viridis'],['preview','site'],['close']]);
});
test('closing with a preview asks Save/Discard; Keep editing does not commit',()=>{
  const p=picker();p.click('Viridis');p.click('Close workspace style',{aria:true});
  assert.ok(p.text().includes('Save this palette?'));assert.equal(p.events.length,1);
  p.click('Keep editing');assert.equal(p.events.length,1);
  p.click('Follow website theme');assert.deepEqual(p.events.at(-1),['preview','site']);
});
