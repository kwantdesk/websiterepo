"use client";
// Local-only synthetic acceptance test. No owner accounts or market providers.
import React, {useState,useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import ChartDrawLayer from '@/components/ChartDrawLayer';
import {DRAW_TOOL_LIST,createDrawing,type DrawToolId,type Drawing} from '@/lib/chartDrawTools';
import {chartSvgBodyHit} from '@/lib/chartSvgHitTargets';
const specs=DRAW_TOOL_LIST.filter(s=>!['cursor','eraser'].includes(s.id));
function make(tool:DrawToolId){const spec=specs.find(s=>s.id===tool)!;const n=['longPosition','shortPosition'].includes(tool)?3:typeof spec.points==='number'?spec.points:6;const d=createDrawing(tool,Array.from({length:n},(_,i)=>({time:100+i*70,price:100+(i%2?140:30*i)})),tool==='emoji'?'📍':'Trade note');d.style.width=2;d.style.showLabels=true;return d;}
const candles=Array.from({length:30},(_,i)=>({time:i*30,open:120,high:180,low:95,close:150,volume:100}));
const noop=()=>{};
function Surface({tool,inventory=false}:{tool:DrawToolId;inventory?:boolean}){
 const [drawing,setDrawing]=useState<Drawing>(()=>make(tool)),[selected,setSelected]=useState<string|null>(null),[pans,setPans]=useState(0),[moves,setMoves]=useState(0),[eraseMode,setEraseMode]=useState(false),[eraseCheck,setEraseCheck]=useState('');
 const host=useRef<HTMLElement>(null);
 useEffect(()=>{if(!eraseMode)return;const svg=host.current!.querySelector('svg')!;const a=drawing.points[0],b=drawing.points[1];if(b)setEraseCheck(chartSvgBodyHit(svg,drawing.id,(a.time+b.time)/2,(a.price+b.price)/2)?'Eraser path PASS':'Eraser path FAIL')},[eraseMode,drawing]);
 return <section ref={host} data-tool={tool} style={{margin:12}}><h2>{tool}</h2><div style={{position:'relative',width:800,height:500,border:'1px solid #344456',background:'#090f18'}} onPointerDown={()=>setPans(p=>p+1)}>
 <ChartDrawLayer width={800} height={500} priceScaleWidth={50} activeTool={eraseMode?"eraser":"cursor"} emoji="📍" keepDrawing={false} drawings={[drawing]} selectedId={selected} toX={t=>t} toY={p=>p} fromXY={(x,y)=>({time:x,price:y})} candles={candles} magnet={false} magnetStrength="weak" viewportVersion={0} chartReady={1} subscribeViewport={()=>noop} onCommit={noop} onUpdate={d=>{setDrawing(d);setMoves(n=>n+1)}} onDelete={noop} onSelect={setSelected} onToolConsumed={noop} onRequestText={noop} onOpenSettings={noop} themeColor="#39d8ff" themeBearColor="#ff3978" currentPrice={120}/>
 </div><output>{inventory?'Inventory':`Chart pan presses: ${pans} · Drawing updates: ${moves}`}</output>{!inventory?<button onClick={()=>setEraseMode(m=>!m)}>Toggle eraser</button>:null}<span>{eraseCheck}</span></section>
}
function Audit(){const [report,setReport]=useState('Not run');
 const run=()=>{
  const results=Array.from(document.querySelectorAll<HTMLElement>('#inventory section[data-tool]')).map(section=>{
   const svg=section.querySelector('svg')!,group=svg.querySelector<SVGGElement>('[data-chart-drawing-id]')!;
   if(!group)return `${section.dataset.tool}: missing body`;
   const targets=group.querySelectorAll('[data-painted-hit]');
   if(!targets.length)return `${section.dataset.tool}: missing targets`;
   // Every empty location must miss both browser pointer targeting and the JS eraser query.
   let mismatches=0,samples=0;
   for(let y=25;y<475;y+=25)for(let x=25;x<750;x+=25){
    const expected=Array.from(targets).some(element=>{
     const screen=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM()!);
     if((element as SVGGraphicsElement).dataset.paintedHit==='text'){const r=element.getBoundingClientRect();return screen.x>=r.left&&screen.x<=r.right&&screen.y>=r.top&&screen.y<=r.bottom;}
     const e=element as SVGGeometryElement,p=screen.matrixTransform(e.getScreenCTM()!.inverse());return e.isPointInStroke(p)||e.dataset.hitFill==='true'&&e.isPointInFill(p);
    });
    if(chartSvgBodyHit(svg,group.dataset.chartDrawingId!,x,y)!==expected)mismatches++;samples++;
   }
   return `${section.dataset.tool}: ${mismatches?'FAIL':'PASS'} (${samples} points)`;
  });
  const trend=document.querySelector<SVGSVGElement>('[data-tool="trendLine"] svg')!,fib=document.querySelector<SVGSVGElement>('[data-tool="fibRetracement"] svg')!;
  const checks=[!chartSvgBodyHit(trend,trend.querySelector<SVGGElement>('[data-chart-drawing-id]')!.dataset.chartDrawingId!,155,105),!chartSvgBodyHit(fib,fib.querySelector<SVGGElement>('[data-chart-drawing-id]')!.dataset.chartDrawingId!,150,210)];
  setReport(`${results.filter(r=>r.includes(': PASS')).length}/${results.length} SVG tools; trend and Fibonacci empty-space checks ${checks.every(Boolean)?'PASS':'FAIL'}\n`+results.join('\n'));
 };
 return <main style={{fontFamily:'sans-serif',background:'#090f18',color:'#dce8f5',padding:12}}><h1>Drawing hit-area acceptance</h1><p>Actual ChartDrawLayer · local synthetic data · no account changes</p><button onClick={run}>Audit every SVG tool</button><pre id="result" style={{maxHeight:150,overflow:"auto"}}>{report}</pre><div style={{display:'flex',flexWrap:'wrap'}}><Surface tool="trendLine"/><Surface tool="fibRetracement"/></div><details><summary>All tool renderers</summary><div id="inventory">{specs.map(s=><Surface key={s.id} tool={s.id} inventory/>)}</div></details></main>
}
createRoot(document.body.appendChild(document.createElement('div'))).render(<Audit/>);
