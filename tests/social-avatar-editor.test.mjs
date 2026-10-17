import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const read=p=>fs.readFileSync(new URL(p,import.meta.url),"utf8");
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const paletteApi={};vm.runInNewContext(compile(read("../src/lib/avatarPalette.ts")),{exports:paletteApi});
const definitions=JSON.parse(read("../src/lib/socialAvatarPalettes.json"));
const preset={id:"robot",name:"Robot",path:"/images/avatars/console-v1/robot.webp",url:"https://kwantdesk.com/images/avatars/console-v1/robot.webp"};

function editor(appearance,avatarUrl=preset.url) {
  const states=[],refs=[],effects=[],frames=new Map(),store=new Map([["olisa-recent-colors",JSON.stringify(["#ABCDEF"])]]),listeners=new Map();
  let cursor=0,dirty=true,tree,frameId=0,encoded=0,preview=null;
  const handle={current:null};
  const props={preset,appearance,avatarUrl,disabled:false};
  const jsx=(type,props)=>({type,props:props??{}});
  const canvas=()=>{let source="";return {width:0,height:0,getContext:()=>({drawImage:image=>{source=image.src;},getImageData:()=>({data:new Uint8ClampedArray(source.includes("maps")?[0,0,0,255]:[254,250,241,255])}),createImageData:()=>({data:new Uint8ClampedArray(4)}),putImageData:frame=>{preview=Array.from(frame.data);}})};};
  const react={
    forwardRef:fn=>fn,
    useState:initial=>{const i=cursor++;if(!(i in states))states[i]=typeof initial==="function"?initial():initial;return [states[i],value=>{const next=typeof value==="function"?value(states[i]):value;if(next!==states[i]){states[i]=next;dirty=true;}}];},
    useRef:initial=>refs[cursor++]??=( {current:initial} ),
    useEffect:(fn,deps)=>{const i=cursor++,old=effects[i];if(!old||deps.some((v,n)=>!Object.is(v,old.deps[n])))effects[i]={fn,deps,pending:true,cleanup:old?.cleanup};},
    useImperativeHandle:(ref,create)=>{cursor++;ref.current=create();},
  };
  const storage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)};
  const window={setTimeout,addEventListener:(type,fn)=>{const set=listeners.get(type)??new Set();set.add(fn);listeners.set(type,set);},removeEventListener:(type,fn)=>listeners.get(type)?.delete(fn),dispatchEvent:event=>{for(const fn of listeners.get(event.type)??[])fn();}};
  const module={exports:{}};
  const Image=class{naturalWidth=500;naturalHeight=500;set src(value){this._src=value;if(value)queueMicrotask(()=>this.onload?.());}get src(){return this._src;}};
  vm.runInNewContext(compile(read("../src/components/socials/AvatarPaletteEditor.tsx")),{module,exports:module.exports,require:name=>{
    if(name==="react")return react;if(name==="react/jsx-runtime")return {jsx,jsxs:jsx};
    if(name.endsWith("ChartColorField"))return {default:"picker"};if(name.endsWith("socialAvatarPalettes.json"))return {default:definitions};
    if(name.endsWith("avatarPalette"))return paletteApi;
    if(name.endsWith("clientImageProcessing"))return {encodeCanvasImage:async()=>{encoded++;return {dataUrl:"data:image/webp;base64,painted"};}};
    if(name.endsWith("browserStorageQuota"))return {writeProtectedItem:(key,value)=>{store.set(key,value);return {ok:true};}};
    if(name.endsWith("userPreferences"))return {PREFERENCES_HYDRATED_EVENT:"hydrate"};throw Error(name);
  },window,localStorage:storage,document:{createElement:canvas},Image,clearTimeout,CustomEvent:class{constructor(type){this.type=type;}},requestAnimationFrame:fn=>{const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
  const walk=(node,out=[])=>{if(Array.isArray(node)){node.forEach(n=>walk(n,out));return out;}if(!node||typeof node!=="object")return out;out.push(node);if(node.type==="canvas"&&node.props.ref)node.props.ref.current??=canvas();walk(node.props?.children,out);return out;};
  const flush=()=>{for(let pass=0;dirty;pass++){assert.ok(pass<15,"no render loop");dirty=false;cursor=0;tree=module.exports.default(props,handle);walk(tree);for(const effect of effects)if(effect?.pending){effect.pending=false;effect.cleanup?.();effect.cleanup=effect.fn();}for(const [id,fn]of frames){frames.delete(id);fn();}}};
  const nodes=()=>{flush();return walk(tree);};
  flush();return {handle,flush,nodes,props,store,get preview(){return preview;},get encoded(){return encoded;},ready:async()=>{await new Promise(resolve=>setImmediate(resolve));flush();}};
}

test("live picker exports the very latest colour even before a React/RAF flush",async()=>{
  const h=editor();await h.ready();
  const pickers=h.nodes().filter(n=>n.type==="picker");assert.equal(pickers.length,definitions.robot.colors.length);
  pickers[0].props.onChange("#123456");
  const prepared=await h.handle.current.prepare();
  assert.equal(prepared.avatarAppearance.colors[0],"#123456");assert.equal(prepared.avatarUrl,"data:image/webp;base64,painted");
  h.flush();assert.deepEqual(h.preview,[18,52,86,255]);
  const recent=h.nodes().find(n=>n.props?.["aria-label"]==="Use recent #ABCDEF for Background");recent.props.onClick();h.flush();
  assert.equal((await h.handle.current.prepare()).avatarAppearance.colors[0],"#ABCDEF");
  assert.equal(JSON.parse(h.store.get("olisa-recent-colors"))[0],"#ABCDEF");
  h.nodes().find(n=>n.props?.["aria-label"]===`Reset Background to ${definitions.robot.colors[0]}`).props.onClick();h.flush();
  assert.equal((await h.handle.current.prepare()).avatarUrl,preset.url);
});

test("saved colours reopen unchanged, reset all restores stock URL, and recents are account-tracked",async()=>{
  const colors=[...definitions.robot.colors];colors[2]="#E53583";
  const appearance={version:1,presetId:"robot",colors};
  const h=editor(appearance,"data:image/webp;base64,previous");await h.ready();
  assert.equal(h.nodes().filter(n=>n.type==="picker")[2].props.value,"#E53583");
  assert.equal((await h.handle.current.prepare()).avatarUrl,"data:image/webp;base64,previous");assert.equal(h.encoded,0);
  h.nodes().find(n=>n.type==="button"&&n.props.children==="Reset all").props.onClick();
  const reset=await h.handle.current.prepare();assert.equal(reset.avatarUrl,preset.url);assert.equal(reset.avatarAppearance,undefined);
  assert.ok(read("../src/lib/userPreferences.ts").includes('"olisa-recent-colors"'));
});
