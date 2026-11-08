import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import ChartDrawLayer from "@/components/ChartDrawLayer";
import ChartDrawSettings from "@/components/ChartDrawSettings";
import { createDrawing, normalizeDrawings, type Drawing } from "@/lib/chartDrawTools";
const point = { time: 200, price: 200 };
const toCoordinate = (value: number) => value;
const fromXY = (time: number, price: number) => ({ time, price });
const subscribeViewport = () => () => {};
function Fixture() {
  const [drawing, setDrawing] = useState(() => createDrawing("emoji", [point], "🇼"));
  const [open, setOpen] = useState(false);
  const change = (next: Drawing) => { setDrawing(next); localStorage.setItem("emoji-colour-audit", JSON.stringify([next])); };
  return <>
    <button onClick={() => change({ ...drawing, text: "😊" })}>Face</button>
    <button onClick={() => { setDrawing(normalizeDrawings(JSON.parse(localStorage.getItem("emoji-colour-audit")!))[0]); setOpen(false); }}>Restore</button>
    <section style={{ position: "relative", width: 800, height: 500, background: "#000" }}>
      <ChartDrawLayer width={800} height={500} priceScaleWidth={50} activeTool="cursor"
        emoji="🇼" keepDrawing={false} drawings={[drawing]} selectedId={null}
        toX={toCoordinate} toY={toCoordinate} fromXY={fromXY} candles={[]} magnet={false}
        magnetStrength="weak" viewportVersion={0} chartReady={1} subscribeViewport={subscribeViewport}
        onCommit={() => {}} onUpdate={change} onDelete={() => {}} onSelect={() => {}}
        onToolConsumed={() => {}} onRequestText={() => {}} onOpenSettings={() => setOpen(true)} themeColor="#FFFFFF" />
    </section>
    <ChartDrawSettings drawing={open ? drawing : null} onChange={change} onClose={() => setOpen(false)} themeColor="#FFFFFF" />
    <output hidden>{JSON.stringify(drawing)}</output>
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
