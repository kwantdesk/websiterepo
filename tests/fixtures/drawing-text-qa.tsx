import React, { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import ChartDrawSettings from "@/components/ChartDrawSettings";
import ChartDrawLayer from "@/components/ChartDrawLayer";
import { createDrawing, type Drawing, type DrawToolId } from "@/lib/chartDrawTools";

function App() {
  const [drawings, setDrawings] = useState<Drawing[]>(() => [createDrawing("trendLine", [{time:200,price:250},{time:420,price:310}])]);
  const [settingsId, openSettings] = useState<string|null>(null);
  const [selected, select] = useState<string|null>(null);
  const [locked, lock] = useState(false);
  const [offset, pan] = useState(0);
  const update = (drawing: Drawing) => setDrawings(list => list.map(item => item.id === drawing.id ? drawing : item));
  const subscribe = useCallback(() => () => {}, []);
  return <><select aria-label="Tool" onChange={e => {select(null);setDrawings([createDrawing(e.target.value as DrawToolId,[{time:200,price:250},{time:420,price:310},{time:480,price:200}])]);}}>
    {["trendLine","rectangle","horizontalLine","verticalLine","polyline","ellipse","fibRetracement","longPosition","text","emoji"].map(tool => <option key={tool}>{tool}</option>)}
  </select><button onClick={()=>pan(offset+30)}>Pan</button><button onClick={()=>lock(!locked)}>Lock</button>
  <div style={{position:"relative",width:700,height:500}} onPointerDown={e=>{if(!(e.target as Element).closest('[data-draw-hit]'))select(null)}}>
    <ChartDrawLayer width={700} height={500} priceScaleWidth={60} activeTool="cursor" emoji="🙂" keepDrawing={false}
      readOnly={locked} drawings={drawings} selectedId={selected} toX={time=>time+offset} toY={price=>price}
      fromXY={(x,y)=>({time:x-offset,price:y})} candles={[]} magnet={false} magnetStrength="weak"
      viewportVersion={offset} chartReady={1} subscribeViewport={subscribe} onCommit={drawing=>setDrawings([...drawings,drawing])}
      onUpdate={update} onDelete={()=>{}} onSelect={select} onToolConsumed={()=>{}} onRequestText={()=>{}} onOpenSettings={openSettings} />
  </div><ChartDrawSettings drawing={drawings.find(d=>d.id===settingsId)??null} onChange={update} onClose={()=>openSettings(null)} /><output>{JSON.stringify(drawings)}</output></>;
}
createRoot(document.getElementById("root")!).render(<App/>);
