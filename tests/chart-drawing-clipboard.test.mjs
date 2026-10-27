import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as clipboard from '../src/lib/chartDrawingClipboard.ts';
import { DRAW_TOOL_LIST, createDrawing } from '../src/lib/chartDrawTools.ts';
import { createDefaultConfigs } from '../src/chart/precision-tools/defaults.ts';
import { PrecisionToolsStore } from '../src/chart/precision-tools/store.ts';

test('every placed sidebar tool clones its full settings and offsets anchors without changing risk prices',()=>{
  for(const spec of DRAW_TOOL_LIST.filter(row=>!['cursor','eraser'].includes(row.id))){
    const source=createDrawing(spec.id,[{time:1000,price:100},{time:1100,price:95},{time:1100,price:115}],'Trade note 🧲');
    source.style.profileRows=120; source.style.profileGroupTicks=8;
    const frozen=structuredClone(source); clipboard.copyChartDrawing(source);
    source.points[0].price=999;source.style.profileRows=20;
    const a=clipboard.pasteChartDrawing((_,n)=>60*n),b=clipboard.pasteChartDrawing((_,n)=>60*n);
    assert.notEqual(a.id,frozen.id);assert.notEqual(a.id,b.id);
    assert.deepEqual(a.style,frozen.style);assert.equal(a.text,frozen.text);
    assert.deepEqual(a.points,frozen.points.map(p=>({...p,time:p.time+60})),spec.id);
    assert.deepEqual(b.points,frozen.points.map(p=>({...p,time:p.time+120})),spec.id);
    a.style.profileRows=40;
    assert.equal(clipboard.pasteChartDrawing(()=>180).style.profileRows,120);
  }
});

class Surface {
  listeners=new Map();
  closest(){return null;}
  contains(node){return node===this;}
  addEventListener(type,fn){const items=this.listeners.get(type)||[];items.push(fn);this.listeners.set(type,items);}
  removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item!==fn));}
  emit(type,patch={}){
    const event={target:{closest:()=>null},ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,defaultPrevented:false,
      preventDefault(){this.defaultPrevented=true},stopImmediatePropagation(){this.stopped=true},...patch};
    for(const fn of this.listeners.get(type)||[]){fn(event);if(event.stopped)break;}return event;
  }
}
let ids=0;
let compiledHook,hookRuntime;
function mountHook(doc,drawing,options={}){
  const effects=[],states=[],container=options.container??new Surface();
  hookRuntime={effects,states};
  const args={svgRef:{current:{parentElement:container,ownerDocument:doc,contains:()=>true}},
    drawings:[drawing],selectedId:drawing.id,toX:t=>t,toY:p=>p,fromXY:(x,y)=>({time:x,price:y}),
    onCommit:row=>args.drawings.push(row),onSelect:id=>{args.selectedId=id},...options.extra};
  const source=fs.readFileSync(new URL('../src/components/useChartDrawingClipboard.tsx',import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports={};if(!compiledHook)vm.runInNewContext(js,{exports,require:name=>{
    if(name==='react')return{useEffect:fn=>hookRuntime.effects.push(fn),useId:()=>`layer-${++ids}`,useRef:current=>({current}),useState:()=>{const state=hookRuntime.states;return[null,value=>state.push(value)]}};
    if(name==='react-dom')return{createPortal:()=>null};
    if(name==='react/jsx-runtime')return{jsx:()=>null,jsxs:()=>null};
    if(name.includes('chartDrawingClipboard'))return clipboard;
    throw Error(name);
  }});
  compiledHook??=exports.useChartDrawingClipboard;
  compiledHook(args);const cleanup=effects.map(fn=>fn());
  return{args,container,states,cleanup:()=>cleanup.forEach(fn=>fn?.())};
}

test('actual clipboard hook routes Ctrl/Command copy-paste to one focused pane and preserves text editing',()=>{
  clipboard.clearChartDrawingClipboard();
  const doc=new Surface();doc.defaultView=new Surface();doc.defaultView.innerWidth=1200;doc.defaultView.innerHeight=800;doc.body={};
  const a=mountHook(doc,createDrawing('longPosition',[{time:1000,price:100},{time:1100,price:95},{time:1100,price:115}]));
  const b=mountHook(doc,createDrawing('entryArrow',[{time:2000,price:200}]));
  doc.emit('pointerdown',{button:0,target:a.container});
  assert.equal(doc.emit('keydown',{key:'c',ctrlKey:true}).defaultPrevented,true);
  doc.emit('pointerdown',{button:0,target:b.container});
  assert.equal(doc.emit('keydown',{key:'v',metaKey:true}).defaultPrevented,true);
  assert.equal(a.args.drawings.length,1);assert.equal(b.args.drawings.length,2);
  assert.equal(b.args.drawings[1].tool,'longPosition');assert.equal(b.args.selectedId,b.args.drawings[1].id);
  assert.equal(b.args.drawings[1].points[0].time,1024);
  const typing=doc.emit('keydown',{key:'v',ctrlKey:true,target:{closest:()=>({})}});
  assert.equal(typing.defaultPrevented,false);assert.equal(b.args.drawings.length,2);
  assert.equal(doc.emit('keydown',{key:'v',ctrlKey:true,shiftKey:true}).defaultPrevented,false);
  doc.emit('keydown',{key:'v',ctrlKey:true,repeat:true});assert.equal(b.args.drawings.length,2);
  a.cleanup();b.cleanup();
  assert.equal((doc.listeners.get('keydown')||[]).length,0);
});

test('an older transparent drawing hit wins over another layer blank-space Paste menu',()=>{
  const doc=new Surface();doc.defaultView=new Surface();doc.defaultView.innerWidth=1000;doc.defaultView.innerHeight=700;doc.body={};
  const source=createDrawing('rectangle',[{time:100,price:100},{time:150,price:120}]);
  clipboard.copyChartDrawing(source);
  const container=new Surface();
  const modern=mountHook(doc,source,{container});
  const older=mountHook(doc,{...source,id:'older'},{container,extra:{findAt:()=> 'older',clipboard:{has:()=>false,copy:()=>true,paste:()=>true}}});
  container.emit('contextmenu',{clientX:100,clientY:100});
  assert.equal(modern.states.length,0);assert.equal(older.states.at(-1).drawingId,'older');
  modern.cleanup();older.cleanup();
});

test('right-click selects the hit drawing and blank space offers paste, while right-drag remains a ruler',()=>{
  const doc=new Surface();doc.defaultView=new Surface();doc.defaultView.innerWidth=1000;doc.defaultView.innerHeight=700;doc.body={};
  const source=createDrawing('fixedRangeVolumeProfile',[{time:1000,price:100},{time:1100,price:105}]);
  const layer=mountHook(doc,source);layer.args.selectedId=null;
  const hit={getAttribute:()=>source.id};
  const event=layer.container.emit('contextmenu',{clientX:999,clientY:699,target:{closest:selector=>selector==='[data-chart-drawing-id]'?hit:null}});
  assert.equal(event.defaultPrevented,true);assert.equal(layer.args.selectedId,source.id);
  assert.deepEqual({...layer.states.at(-1)},{x:770,y:590,drawingId:source.id});
  clipboard.copyChartDrawing(source);
  assert.equal(layer.container.emit('contextmenu',{clientX:100,clientY:100}).defaultPrevented,true);
  doc.emit('pointerdown',{button:2,clientX:100,clientY:100,target:layer.container});
  doc.emit('pointermove',{clientX:140,clientY:110});
  assert.equal(layer.container.emit('contextmenu',{clientX:140,clientY:110}).defaultPrevented,false);
  layer.cleanup();
});

test('every precision tool copies its price/time anchors and freehand path consistently',()=>{
  const store=new PrecisionToolsStore();
  for(const config of createDefaultConfigs().filter(row=>row.slot===1)){
    const anchor={time:1000,logicalIndex:10,price:100};
    const object=store.createDraft(config.toolId,config,anchor);
    object.path=[anchor,{time:1100,logicalIndex:11,price:101}];
    object.options.custom=[1,2,3];
    clipboard.copyPrecisionDrawings([object]);
    const [copy]=clipboard.pastePrecisionDrawings(()=>({time:200,logicalIndex:2}));
    assert.notEqual(copy.id,object.id);assert.deepEqual(copy.style,object.style);
    assert.equal(copy.anchors[0].price,100);assert.equal(copy.anchors[0].time,1200);assert.equal(copy.anchors[0].logicalIndex,12);
    assert.equal(copy.path[1].time,1300);assert.equal(copy.path[1].logicalIndex,13);
    copy.options.custom[0]=99;assert.equal(object.options.custom[0],1);
    assert.equal(clipboard.hasChartDrawingClipboard(),false,'one clipboard owner prevents double paste between engines');
  }
});

test('actual legacy position and professional paste functions preserve prices and create independent copies',()=>{
  const text=fs.readFileSync(new URL('../src/components/Chart.tsx',import.meta.url),'utf8');
  const source=ts.createSourceFile('Chart.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const functions=[];const names=new Set(['copyLegacyDrawing','pasteLegacyOrProfessionalDrawing','copySelectedProfessionalDrawing','pasteProfessionalDrawing']);
  const visit=node=>{if(ts.isFunctionDeclaration(node)&&names.has(node.name?.text))functions.push(node.getText(source));ts.forEachChild(node,visit)};visit(source);
  let id=0;const legacy={id:'legacy',tool:'longPosition',points:[{time:1000,price:100},{time:1100,price:95},{time:1100,price:115}],positionStyle:{targetColor:'red'}};
  const professional={id:'professional',type:'fixed-market-profile',anchors:[{time:1000,price:100},{time:1100,price:105}],style:{lineColor:'red'},options:{levels:[1,2]}};
  const added=[];const context=vm.createContext({structuredClone,createId:()=>`new-${++id}`,clearChartDrawingClipboard:clipboard.clearChartDrawingClipboard,
    drawings:[legacy],legacyDrawingClipboardRef:{current:null},legacyDrawingPasteCountRef:{current:0},professionalClipboardRef:{current:null},professionalClipboardPasteCountRef:{current:0},
    professionalDrawingManagerRef:{current:{getSelectedDrawing:()=>({toJSON:()=>professional}),addDrawing:d=>added.push(d),selectDrawing:()=>{}}},
    candleIntervalMs:60000,drawingFromSerialized:record=>record,configureProfessionalDrawingMarketData:()=>{},drawingMarketDataSource:{},setSelectedProfessionalDrawingId:()=>{},
    setDrawings:fn=>{context.drawings=fn(context.drawings)},setSelectedDrawingId:()=>{},
  });
  vm.runInContext(ts.transpileModule(functions.join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  context.copyLegacyDrawing('legacy');context.pasteLegacyOrProfessionalDrawing();context.pasteLegacyOrProfessionalDrawing();
  assert.deepEqual(Array.from(context.drawings.at(-1).points,p=>p.price),[100,95,115]);assert.equal(context.drawings.at(-1).points[0].time,1120);
  context.drawings[1].positionStyle.targetColor='blue';assert.equal(legacy.positionStyle.targetColor,'red');
  context.copySelectedProfessionalDrawing();context.pasteProfessionalDrawing();context.pasteProfessionalDrawing();
  assert.deepEqual(Array.from(added[0].anchors,p=>p.price),[100,105]);assert.equal(added[1].anchors[0].time,1120);
  added[0].options.levels[0]=99;assert.equal(professional.options.levels[0],1);
});
