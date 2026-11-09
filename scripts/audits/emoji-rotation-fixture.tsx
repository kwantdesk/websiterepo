import React from "react";
import { createRoot } from "react-dom/client";
import ChartDrawSettings from "@/components/ChartDrawSettings";
import ChartDrawLayer from "@/components/ChartDrawLayer";
import { createDrawing, normalizeDrawings } from "@/lib/chartDrawTools";

const view = { sx: 1, sy: 1, dx: 0, dy: 0 };
let notify = () => {};
const subscribe = (callback: () => void) => { notify = callback; return () => {}; };
const toX = (time: number) => time * view.sx + view.dx;
const toY = (price: number) => price * view.sy + view.dy;
const initial = createDrawing("emoji", [{ time: 200, price: 200 }], "🙂");
initial.style.fontSize = 48;
const candles = [100, 400].map(time => ({ time, open: 100, high: 102, low: 99, close: 101, volume: 1 }));
function App() {
  const [drawing, setDrawing] = React.useState(() => normalizeDrawings(JSON.parse(localStorage.getItem("emoji-rotation-fixture") || "null"))[0] || initial);
  const [open,setOpen]=React.useState(false);
  const [locked,setLocked]=React.useState(false);
  const update=(next: typeof drawing) => {setDrawing(next);localStorage.setItem("emoji-rotation-fixture",JSON.stringify([next]));};
  const [, redraw] = React.useState(0);
  Object.assign(window, {
    readEmoji: () => drawing, lockEmoji: setLocked,
    gestureEmoji: (next: typeof view) => { Object.assign(view, next); notify(); },
    repaintEmoji: () => redraw(value => value + 1),
  });
  return <section style={{ position: "relative", width: 1000, height: 800 }}>
    <ChartDrawLayer readOnly={locked} width={1000} height={800} activeTool="cursor" emoji="🙂"
      keepDrawing={false} drawings={[drawing]} selectedId={drawing.id}
      toX={toX} toY={toY} fromXY={(time, price) => ({ time, price })}
      candles={candles} magnet={false} magnetStrength="weak" viewportVersion={0}
      chartReady={1} subscribeViewport={subscribe} onCommit={() => {}}
      onUpdate={update} onDelete={() => {}} onSelect={() => {}}
      onToolConsumed={() => {}} onRequestText={() => {}} onOpenSettings={() => setOpen(true)} />
    <ChartDrawSettings drawing={open ? drawing : null} onChange={update} onClose={() => setOpen(false)} />
  </section>;
}
createRoot(document.getElementById("root")!).render(<App />);
