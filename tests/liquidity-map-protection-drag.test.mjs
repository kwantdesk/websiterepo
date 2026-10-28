import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {liquidityMapTradeLevels,liquidityMapLevelLabel,liquidityMapPickedPrice} from '../src/lib/liquidityMapTrading.ts';
import {paperLabelWidthPx,PAPER_LABEL_HEIGHT,PAPER_LABEL_FONT_PX} from '../src/lib/paperTradeOverlay.ts';
const source=readFileSync(new URL('../src/components/liquidity-map/LiquidityMapTrading.tsx',import.meta.url),'utf8');
function harness(){
 const events=[],capture=new Set(),drag={current:null},plot={left:0,top:49,width:900,height:520,topPrice:30020,bottomPrice:29980};
 const level={id:'p:tp',ownerId:'p',accountId:'a',kind:'take_profit',targetId:'t',price:30010,draggable:true};
 const trading={enabled:true,onDrag:(...a)=>events.push(['drag',...a]),onProtection:(...a)=>events.push(['protection',...a]),onOrderPrice:(...a)=>events.push(['order',...a])};
 const current={current:{plot,trading,scope:'a:NQ:false',levels:[level],active:true,replay:false}};
 const layer={current:{setPointerCapture:id=>capture.add(id),hasPointerCapture:id=>capture.has(id),releasePointerCapture:id=>capture.delete(id)}};
 const cancelDrag=()=>{const d=drag.current;drag.current=null;if(d){layer.current.releasePointerCapture(d.pointerId);d.release();}};
 const context={drag,current,layer,plot,trading,scope:current.current.scope,symbol:'NQ',replay:false,liquidityMapPickedPrice,
  iframeRef:{current:{clientHeight:600,getBoundingClientRect:()=>({top:100,height:1200})}},onActivate:()=>events.push(['activate']),cancelDrag,setPreview:value=>events.push(['preview',value])};
 const block=source.slice(source.indexOf('  const startDrag ='),source.indexOf('  return <>'));
 const code=ts.transpileModule(block+'\nglobalThis.handlers={startDrag,moveDrag,endDrag};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,context);
 const event=(y,pointerId=7)=>({button:0,pointerId,clientY:y,preventDefault(){},stopPropagation(){},currentTarget:{setPointerCapture(){throw Error('Moving button must not capture');}}});
 return{...context,events,capture,level,event,handlers:context.handlers};
}
test('stable plot captures drag and scaled iframe projection commits the final release price',()=>{
 const h=harness();h.handlers.startDrag(h.event(0),h.level);assert.ok(h.capture.has(7));
 h.handlers.moveDrag(h.event(458)); // 30010 at CSS y179 in a 2x iframe
 assert.equal(h.drag.current.price,30010);
 h.handlers.endDrag(h.event(718)); // final release, without a final move event
 const commit=h.events.find(e=>e[0]==='protection');
 assert.equal(commit[3].price,30000);assert.equal(commit[3].targetId,'t');
 assert.equal(h.drag.current,null);assert.equal(h.capture.size,0);assert.deepEqual(h.events.at(-1),['drag','p',false]);
});
test('unrelated pointers cannot move or commit; stale scope/replay cannot submit',()=>{
 for(const patch of [{scope:'other'},{replay:true},{active:false}]){
  const h=harness();h.handlers.startDrag(h.event(0),h.level);
  h.handlers.moveDrag(h.event(718,8));h.handlers.endDrag(h.event(718,8));assert.equal(h.drag.current.price,30010);
  Object.assign(h.current.current,patch);h.handlers.endDrag(h.event(718));
  assert.equal(h.events.some(e=>e[0]==='protection'),false);assert.equal(h.capture.size,0);
 }
});
test('capture belongs to the persistent plot, not a price label that disappears outside the viewport',()=>{
 assert.match(source,/<div ref=\{layer\}[\s\S]*onPointerMove=\{moveDrag\} onPointerUp=\{endDrag\}/);
 assert.doesNotMatch(source,/event.currentTarget.setPointerCapture/);
 assert.match(source,/onPointerCancel=\{cancelDrag\} onLostPointerCapture=\{cancelDrag\}/);
});
test('partial targets use remaining size and normal-chart signed quantity / projected P&L labels',()=>{
 const position={id:'p',accountId:'a',symbol:'NQ',status:'open',remainingQuantity:3,side:'buy',entryPrice:30000,stopLoss:29990,unrealizedPnl:120,
  takeProfits:[{id:'t',price:30010,quantity:2,filledQuantity:1}]};
 const levels=liquidityMapTradeLevels('NQ','a',[position],[]);
 assert.equal(liquidityMapLevelLabel(levels.find(l=>l.kind==='take_profit'),'NQ'),'TP · -1 · 30010.00 · +$200.00');
 assert.equal(liquidityMapLevelLabel(levels.find(l=>l.kind==='stop_loss'),'NQ',29995),'SL · -3 · 29995.00 · -$300.00');
 assert.equal(liquidityMapLevelLabel(levels[0],'NQ'),'+3 · +$120.00');
 assert.equal(PAPER_LABEL_HEIGHT,24*.75);assert.equal(PAPER_LABEL_FONT_PX,12*.75);assert.equal(paperLabelWidthPx('SL · -3 · 29995.00 · -$300.00',0,true),190.75);
});
test('label dimensions match the actual normal chart implementation across widths and handle counts',()=>{
 const chart=readFileSync(new URL('../src/components/Chart.tsx',import.meta.url),'utf8').replaceAll('\r\n','\n');
 const block=chart.slice(chart.indexOf('const PAPER_LABEL_SCALE ='),chart.indexOf('/**\n * The order labels used to be painted here'));
 const context={};
 vm.runInNewContext(ts.transpileModule(block+'\nglobalThis.normalWidth=paperLabelWidthPx;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 for(const text of ['SL','TP · -3 · 29995.00 · -$300.00','BUY 12 LIMIT · 29995.00 · working','x'.repeat(100)])for(const handles of [0,1,2])for(const close of [false,true])assert.equal(paperLabelWidthPx(text,handles,close),context.normalWidth(text,handles,close));
});
