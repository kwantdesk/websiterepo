import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import ChartDrawSettings from "@/components/ChartDrawSettings";
import { createDrawing, normalizeDrawings, resolveDrawColor, type Drawing } from "@/lib/chartDrawTools";

function App() {
  const [drawing, update] = useState<Drawing>(() => createDrawing("entryArrow", [{time:100,price:100}]));
  const [open, setOpen] = useState(true);
  return <>
    <button onClick={()=>{update(createDrawing('entryArrow',[{time:100,price:100}]));setOpen(true)}}>New entry</button>
    <button onClick={()=>{update(createDrawing('exitArrow',[{time:100,price:100}]));setOpen(true)}}>New exit</button>
    <button onClick={()=>{update(normalizeDrawings(JSON.parse(JSON.stringify([drawing])))[0]);setOpen(true)}}>Restore drawing</button>
    <output>{JSON.stringify({drawing,color:resolveDrawColor(drawing.style,'#abcdef')})}</output>
    {open ? <ChartDrawSettings drawing={drawing} themeColor="#abcdef" onChange={update} onClose={()=>setOpen(false)}/> : null}
  </>;
}
createRoot(document.getElementById("root")!).render(<App/>);
