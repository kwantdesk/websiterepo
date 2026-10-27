import test from 'node:test';import assert from 'node:assert/strict';
import {pointHitsPaintedShape,rectangleHitShape,ellipseHitShape,paintedHitContext} from '../src/lib/drawingPaintedHit.ts';
import {PRECISION_TOOL_REGISTRY} from '../src/chart/precision-tools/registry.ts';
import {defaultPrecisionStyle,defaultPrecisionLabels,defaultToolOptions} from '../src/chart/precision-tools/defaults.ts';
import {precisionPaintedHitShapes} from '../src/chart/precision-tools/renderer.ts';
import {hitTestObjects} from '../src/chart/precision-tools/hitTesting.ts';
import {TOOL_DEFINITIONS} from '../src/vendor/lightweight-charts-drawing/registry/tool-registry.ts';
import {hitTestGeometry} from '../src/vendor/lightweight-charts-drawing/core/geometry.ts';
import {DrawingManager} from '../src/vendor/lightweight-charts-drawing/core/drawing-manager.ts';
import {drawingPaintedHitShapes,hitTestDrawingPaint} from '../src/vendor/lightweight-charts-drawing/core/painted-hit.ts';
import {drawingSpecs,svgDrawingFixture} from './helpers/drawing-hit-harness.mjs';
const adapter={width:800,height:500,priceScaleWidth:50,timeScaleHeight:25,minMove:1,precision:2,pointValue:50,instrument:'ES',timeframe:'1m',pixelsPerBar:10,
 candles:Array.from({length:40},(_,i)=>({timestamp:i*1000,open:100+i,high:102+i,low:98+i,close:101+i,volume:100})),
 trades:Array.from({length:40},(_,i)=>({timestamp:i*1000,price:100+i,open:100+i,close:100+i,low:100+i,high:100+i,size:100,volume:100,bidVolume:40,askVolume:60,delta:20,trades:1,side:i%2?'buy':'sell'})),
 timeToX:t=>t/100,xToAnchor:(x,y)=>({time:x*100,logicalIndex:x/10,price:y}),priceToY:p=>p,yToPrice:y=>y,setVisibleTimeRange(){},requestChartRender(){}};
function precision(id){return {schemaVersion:1,id,toolId:id,name:id,anchors:[{time:10000,logicalIndex:10,price:100},{time:40000,logicalIndex:40,price:350},{time:40000,logicalIndex:40,price:50}],
 path:[{time:10000,logicalIndex:10,price:100},{time:20000,logicalIndex:20,price:350},{time:40000,logicalIndex:40,price:100}],text:'Trade note',style:defaultPrecisionStyle(),labels:{...defaultPrecisionLabels(),visible:false},visibility:{visible:true,locked:false,timeframes:[],minZoom:null,maxZoom:null},alert:null,configSlot:1,options:defaultToolOptions(id),createdAt:1,updatedAt:1,zIndex:1};}
const viewport={width:800,height:500,timeScale:{coordinateToTime:x=>x,coordinateToLogical:x=>x,timeToCoordinate:t=>Number(t),logicalToCoordinate:x=>x},priceScale:{coordinateToPrice:y=>y,priceToCoordinate:p=>p}};
function vendor(def){const n=Math.max(1,def.requiredAnchors||6),anchors=Array.from({length:n},(_,i)=>({time:100+i*50,price:100+(i%2?150:30*i)}));const drawing=def.factory(def.type,anchors,undefined,{text:'Trade note'});drawing.getViewport=()=>viewport;return drawing;}
test('trend-line bounding box is empty; only the actual segment grabs',()=>{const o=precision('precision-line');assert.equal(hitTestObjects([o],{x:300,y:120},adapter),null);assert.equal(hitTestObjects([o],{x:250,y:225},adapter)?.kind,'body');assert.equal(hitTestObjects([o],{x:250,y:234},adapter),null)});
test('Fibonacci gaps, hidden levels and decorative bands do not capture panning',()=>{const o=precision('precision-fibonacci-retracement');o.options.levels=[0,0.5,1];assert.equal(hitTestObjects([o],{x:300,y:180},adapter),null);assert.ok(hitTestObjects([o],{x:300,y:225},adapter));o.options.levels=[0,1];assert.equal(hitTestObjects([o],{x:300,y:225},adapter),null)});
test('empty shape interiors and freehand bounding boxes are not handles',()=>{for(const id of ['precision-rectangle','precision-ellipse','precision-pencil'])assert.equal(hitTestObjects([precision(id)],{x:250,y:210},adapter),null,id);const o=precision('precision-rectangle');assert.ok(hitTestObjects([o],{x:250,y:100},adapter));assert.equal(hitTestObjects([o],{x:250,y:109},adapter),null)});
test('hidden tools and invisible unselected handles cannot grab',()=>{const o=precision('precision-ellipse');assert.equal(hitTestObjects([o],{x:100,y:100},adapter),null);assert.equal(hitTestObjects([o],{x:100,y:100},adapter,2,[o.id])?.kind,'resize');o.visibility.visible=false;assert.equal(hitTestObjects([o],{x:100,y:100},adapter,2,[o.id]),null)});
test('strokes respect dashes, rotated outlines, arcs and transparent fills',()=>{assert.equal(pointHitsPaintedShape({x:50,y:50},rectangleHitShape(10,10,100,100)),false);assert.equal(pointHitsPaintedShape({x:60,y:10},rectangleHitShape(10,10,100,100)),true);assert.equal(pointHitsPaintedShape({x:-100,y:0},ellipseHitShape(0,0,100,100,0,0,Math.PI/2)),false);const c=paintedHitContext();c.context.setLineDash([5,20]);c.context.beginPath();c.context.moveTo(0,0);c.context.lineTo(100,0);c.context.stroke();assert.equal(pointHitsPaintedShape({x:15,y:0},c.shapes[0]),false);assert.equal(pointHitsPaintedShape({x:2,y:0},c.shapes[0]),true)});
for(const [id] of PRECISION_TOOL_REGISTRY)test(`Precision painter: ${id}`,()=>{const o=precision(id);const shapes=precisionPaintedHitShapes(o,adapter);assert.ok(shapes.length>0,id);assert.equal(hitTestObjects([o],{x:790,y:490},adapter),null);assert.ok(shapes.every(s=>s.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))),id)});
for(const def of TOOL_DEFINITIONS)test(`Professional painter: ${def.type}`,()=>{const d=vendor(def);const shapes=drawingPaintedHitShapes(d,viewport);assert.ok(shapes.length>0,def.type);assert.ok(shapes.every(s=>s.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))),def.type);assert.equal(hitTestDrawingPaint(d,{x:-100,y:300},viewport),false);
 const sample=shapes.flatMap(s=>s.points.slice(1).map((p,i)=>({x:(p.x+s.points[i].x)/2,y:(p.y+s.points[i].y)/2}))).find(p=>p.x>6&&p.y>6&&p.x<794&&p.y<494&&hitTestDrawingPaint(d,p,viewport));
 assert.ok(sample,def.type+' has a hittable painted mark');assert.ok(d.hitTest(sample.x,sample.y));
 const manager=new DrawingManager();manager.getViewport=()=>viewport;manager._drawings.set(d.id,d);d.testHit=()=>true;
 assert.equal(manager.hitTest({x:-100,y:300}),null,'legacy broad tool hit cannot override actual paint');assert.equal(manager.hitTest(sample)?.id,d.id);
 d.options={...d.options,visible:false};assert.equal(hitTestDrawingPaint(d,{x:100,y:100},viewport),false)});
for(const spec of drawingSpecs)test(`SVG painter: ${spec.id}`,()=>{const {html}=svgDrawingFixture(spec.id);assert.match(html,/data-painted-hit=/,spec.id);assert.doesNotMatch(html,/data-draw-hit="body"[^>]*pointer-events:all/);const hidden=svgDrawingFixture(spec.id,{drawings:[]}).html;assert.doesNotMatch(hidden,/data-painted-hit=/)});

test('geometry API keeps rotations, arc endpoints, label alignment and ray extensions bounded',()=>{
 const box={type:'rectangle',topLeft:{x:100,y:100},width:100,height:100,rotation:Math.PI/4,strokeColor:'#fff'};
 assert.equal(hitTestGeometry({x:150,y:150},box),false);
 assert.equal(hitTestGeometry({x:150,y:150-50*Math.SQRT2},box),true);
 assert.equal(hitTestGeometry({x:100,y:100},box),false);
 assert.equal(hitTestGeometry({x:100,y:100},{...box,rotation:0,borderRadius:20}),false);
 const label={type:'text',position:{x:300,y:300},text:'ABC',font:'12px Aleph',align:'left',baseline:'top'};
 assert.equal(hitTestGeometry({x:285,y:305},label),false);assert.equal(hitTestGeometry({x:305,y:305},label),true);
 const arc={type:'arc',center:{x:200,y:200},radius:50,startAngle:0,endAngle:Math.PI/2};
 assert.equal(hitTestGeometry({x:150,y:200},arc),false);assert.equal(hitTestGeometry({x:250,y:200},arc),true);
 const ray={type:'line',start:{x:100,y:100},end:{x:200,y:200},extendRight:true};
 assert.equal(hitTestGeometry({x:400,y:400},ray,2,viewport),true);assert.equal(hitTestGeometry({x:400,y:300},ray,2,viewport),false);
});
test('nested shaded bands still do not create body hit areas',()=>{
 const c=paintedHitContext();c.context.save();c.context.save();c.context.fillRect(0,0,800,500);assert.equal(c.shapes.length,0);
});
