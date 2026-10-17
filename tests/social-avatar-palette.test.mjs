import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import sharp from "sharp";
const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
function load(path) { const exports={}; vm.runInNewContext(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,Intl,Date});return exports; }
const {recolorAvatarPixels,paletteEquals,normalizeAvatarColor}=load("../src/lib/avatarPalette.ts");
const definitions=JSON.parse(read("../src/lib/socialAvatarPalettes.json"));

test("all thirty palettes cover every pixel, expose each paint colour and reset byte-identically",async()=>{
  assert.equal(Object.keys(definitions).length,30);
  let duration=0;
  for(const [id,definition] of Object.entries(definitions)) {
    const source=await sharp(fs.readFileSync(new URL(`../public/images/avatars/console-v1/${id}.webp`,import.meta.url))).ensureAlpha().raw().toBuffer();
    const image=await sharp(fs.readFileSync(new URL(`../public${definition.map}`,import.meta.url))).ensureAlpha().raw().toBuffer();
    const original=new Uint8ClampedArray(source),map=new Uint8ClampedArray(image);
    assert.ok(definition.colors.length>=3&&definition.colors.length<=12);
    assert.equal(definition.colors.length,definition.labels.length);
    assert.equal(definition.labels[0],"Background");assert.equal(definition.labels[1],"Outline");
    const used=new Set();for(let p=0;p<map.length;p+=4){assert.ok(map[p]<definition.colors.length&&map[p+1]<definition.colors.length);used.add(map[p]);if(map[p+2])used.add(map[p+1]);}
    assert.equal(used.size,definition.colors.length,`${id}: no invisible colour controls`);
    assert.deepEqual(Buffer.from(recolorAvatarPixels(original,map,definition.colors,definition.colors)),source,`${id}: stock preserves every pixel`);
    const selected=definition.colors.map((_,i)=>["#4AE0DC","#191B30","#FF5599","#FFF2B1","#AA82FF","#7BFD79","#E0A888"][i%7]);
    const start=performance.now();const output=recolorAvatarPixels(original,map,definition.colors,selected);duration+=performance.now()-start;
    assert.notDeepEqual(Buffer.from(output),source);
    for(let p=3;p<output.length;p+=4)assert.equal(output[p],original[p]);
  }
  console.log(`Thirty 500px recolours: ${Math.round(duration)}ms total (${(duration/30).toFixed(1)}ms average)`);
});

test("colour changes affect only their mapped region, including weighted antialiased pixels",()=>{
  const source=new Uint8ClampedArray([10,10,10,255,100,100,100,255,55,55,55,255]);
  const map=new Uint8ClampedArray([0,0,0,255,1,1,0,255,0,1,128,255]);
  const output=recolorAvatarPixels(source,map,["#0A0A0A","#646464"],["#1E0A0A","#646464"]);
  assert.equal(output[0],30);assert.equal(output[4],100);assert.ok(output[8]>55&&output[8]<75);
  assert.equal(normalizeAvatarColor("abc"),"#AABBCC");assert.equal(normalizeAvatarColor("invalid"),null);
  assert.ok(paletteEquals(["#aabbcc"],["#AABBCC"]));
  assert.throws(()=>recolorAvatarPixels(source,map,["#000000"],["bad"]));
});

test("editable palette survives profile JSON roundtrip and invalid settings fail closed",()=>{
  const {normalizeSocialProfile}=load("../src/lib/socials.ts");
  const avatarAppearance={version:1,presetId:"robot",colors:definitions.robot.colors.map(color=>color.toLowerCase())};
  const profile=normalizeSocialProfile({avatarUrl:"data:image/webp;base64,custom",avatarAppearance});
  const restored=normalizeSocialProfile(JSON.parse(JSON.stringify(profile)));
  assert.equal(restored.avatarUrl,profile.avatarUrl);
  assert.deepEqual(Array.from(restored.avatarAppearance.colors),definitions.robot.colors);
  for(const appearance of [{...avatarAppearance,version:2},{...avatarAppearance,colors:["bad","#FFFFFF"]},{...avatarAppearance,presetId:"../invalid"},{...avatarAppearance,colors:Array(13).fill("#FFFFFF")}])assert.equal(normalizeSocialProfile({avatarAppearance:appearance}).avatarAppearance,undefined);
});

test("editor/export use the same pixels, prepare before saving, and retain stock/recent controls",()=>{
  const editor=read("../src/components/socials/AvatarPaletteEditor.tsx"), page=read("../src/components/socials/SocialsWorkspace.tsx");
  assert.match(editor,/requestAnimationFrame/);assert.match(editor,/colorsRef.current/);
  assert.match(editor,/Reset all/);assert.match(editor,/Stock/);assert.match(editor,/Recent/);
  assert.match(editor,/olisa-recent-colors/);assert.match(editor,/kwantdesk:preferences-changed/);
  assert.match(editor,/encodeCanvasImage\(canvas,\{maxBytes:350000/);
  assert.ok(page.indexOf("await avatarPaletteEditorRef.current?.prepare()")<page.indexOf("...(preparedAvatar ?"));
  assert.match(read("../src/components/socials/useProfileAvatarEditor.tsx"),/avatarAppearance: undefined/);
});

test("real profile Save prepares and persists both rendered image and editable settings before reporting success",async()=>{
  const {normalizeSocialProfile}=load("../src/lib/socials.ts");
  const source=read("../src/components/socials/SocialsWorkspace.tsx"),ast=ts.createSourceFile("socials.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let declaration;const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==="saveProfile")declaration=node.getText(ast);ts.forEachChild(node,visit);};visit(ast);
  const calls=[],state={notice:"",editing:true};
  const appearance={version:1,presetId:"robot",colors:[...definitions.robot.colors]};appearance.colors[0]="#345678";
  const profile=normalizeSocialProfile({displayName:"Trader",handle:"trader",avatarUrl:"https://kwantdesk.com/images/avatars/console-v1/robot.webp"});
  const context={profileDraft:profile,currentProfile:profile,profileSaveState:"idle",avatarLoadSequenceRef:{current:0},resolvedLabel:"Trader",resolvedAccountKey:"user-1",requestedProfileHandle:"trader",
    avatarPaletteEditorRef:{current:{prepare:async()=>{calls.push("prepare");return {avatarUrl:"data:image/webp;base64,latest",avatarAppearance:appearance};}}},
    normalizeSocialProfile,isValidProfileHandle:()=>true,PROFILE_HANDLE_REQUIREMENTS:"invalid handle",setProfileSaveState:value=>context.profileSaveState=value,
    setNotice:value=>state.notice=value,setProfileDraft:value=>state.profile=value,setTab:()=>{},setProfileEditing:value=>state.editing=value,
    fetch:async(url,options)=>{calls.push("identity");state.identity=JSON.parse(options.body);return {ok:true,json:async()=>({})};},
    buildLocalObject:value=>value,saveObject:async value=>{calls.push("object");state.object=value;return {cloudSaved:true};},
    cacheProfileIdentity:()=>{},window:{setTimeout:fn=>fn(),dispatchEvent:()=>{}},CustomEvent:class{constructor(type){this.type=type;}},Date,Set,Math,Error,
  };
  const save=vm.runInNewContext(ts.transpileModule(`const ${declaration};saveProfile`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  await save();assert.deepEqual(calls,["prepare","identity","object"]);
  assert.equal(state.identity.avatarUrl,"data:image/webp;base64,latest");assert.equal(state.object.payload.avatarUrl,state.identity.avatarUrl);
  assert.equal(state.object.payload.avatarAppearance.colors[0],"#345678");assert.equal(state.editing,false);assert.match(state.notice,/saved to your account/);
  calls.length=0;state.editing=true;context.avatarPaletteEditorRef.current.prepare=async()=>{throw Error("Map unavailable");};
  await save();assert.equal(calls.length,0);assert.equal(state.editing,true);assert.equal(context.profileSaveState,"error");assert.equal(state.notice,"Map unavailable");
});
