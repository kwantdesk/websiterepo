import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import ChartDrawLayer from "@/components/ChartDrawLayer";
import type { Drawing, DrawToolId } from "@/lib/chartDrawTools";

const subscribeViewport = () => () => {};
const toX = (time: number) => time;
const toY = (price: number) => price;
const fromXY = (x: number, y: number) => ({ time: x, price: y });
function Fixture() {
  const [tool, setTool] = useState<DrawToolId>("path");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  return <>
    <button onClick={() => setTool("cursor")}>Cursor</button>
    {(["path", "polyline", "trendLine", "rectangle", "brush", "highlighter"] as DrawToolId[]).map(id => <button key={id} onClick={() => { setTool(id); setDrawings([]); }}>New {id}</button>)}
    <section style={{ position: "relative", width: 800, height: 500, background: "#111" }}>
      <ChartDrawLayer width={800} height={500} priceScaleWidth={50}
        activeTool={tool} emoji="" keepDrawing={false} drawings={drawings} selectedId={null}
        toX={toX} toY={toY} fromXY={fromXY} candles={[]} magnet={false}
        magnetStrength="weak" viewportVersion={0} chartReady={1} subscribeViewport={subscribeViewport}
        onCommit={drawing => setDrawings(current => [...current, drawing])}
        onUpdate={() => {}} onDelete={() => {}} onSelect={() => {}}
        onToolConsumed={() => setTool("cursor")} onRequestText={() => {}} onOpenSettings={() => {}}
        themeColor="#00ddff" />
    </section>
    <output style={{ display: "none" }}>{JSON.stringify(drawings)}</output>
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
