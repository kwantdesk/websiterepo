import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import ts from 'typescript';import {createRequire} from 'node:module';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {DRAW_TOOL_LIST,createDrawing} from '../../src/lib/chartDrawTools.ts';
const require=createRequire(import.meta.url),cache=new Map();
export function loadDrawingTsx(file){
 const absolute=path.resolve(file);if(cache.has(absolute))return cache.get(absolute);
 const exports={};cache.set(absolute,exports);
 const js=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(js,{exports,require:name=>{
  if(name.includes('useChartDrawingClipboard'))return {useChartDrawingClipboard:()=>null};
  let target=name.startsWith('@/')?path.resolve('src',name.slice(2)):name.startsWith('.')?path.resolve(path.dirname(absolute),name):name;
  if(fs.existsSync(target+'.tsx'))return loadDrawingTsx(target+'.tsx');
  return require(target);
 },console,performance,Set,Map,Date,Math,DOMPoint:globalThis.DOMPoint},{filename:absolute});return exports;
}
export const drawingSpecs=DRAW_TOOL_LIST.filter(s=>!['cursor','eraser'].includes(s.id));
export function svgDrawingFixture(tool,patch={}){
 const spec=drawingSpecs.find(s=>s.id===tool),n=typeof spec.points==='number'?spec.points:6;
 const points=Array.from({length:['longPosition','shortPosition'].includes(tool)?3:Math.max(1,n)},(_,i)=>({time:100+i*70,price:100+(i%2?140:30*i)}));
 const drawing=createDrawing(tool,points,tool==='emoji'?'📍':'Trade note');drawing.style.showLabels=true;drawing.style.width=2;
 const props={width:800,height:500,priceScaleWidth:50,activeTool:'cursor',emoji:'📍',keepDrawing:false,drawings:[drawing],selectedId:null,
 toX:t=>t,toY:p=>p,fromXY:(x,y)=>({time:x,price:y}),candles:Array.from({length:30},(_,i)=>({time:i*30,open:120,high:180,low:95,close:150,volume:100})),magnet:false,magnetStrength:'weak',viewportVersion:0,chartReady:true,
 onCommit(){},onUpdate(){},onDelete(){},onSelect(){},onToolConsumed(){},onRequestText(){},onOpenSettings(){},themeColor:'#33ddff',themeBearColor:'#ff4488',currentPrice:120,...patch};
 return {drawing,html:renderToStaticMarkup(React.createElement(loadDrawingTsx('src/components/ChartDrawLayer.tsx').default,props))};
}
