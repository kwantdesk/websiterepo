import React from "react";
import { createRoot } from "react-dom/client";
import ChartDrawLayer from "@/components/ChartDrawLayer";
import { createDrawing } from "@/lib/chartDrawTools";

const view = { sx: 1, sy: 1, dx: 0, dy: 0 };
let notify = () => {};
const subscribe = (callback: () => void) => { notify = callback; return () => {}; };
const toX = (time: number) => time * view.sx + view.dx;
const toY = (price: number) => price * view.sy + view.dy;
const drawing = createDrawing("emoji", [{ time: 200, price: 200 }], "🙂");
drawing.style.fontSize = 48;
const candles = [100, 400].map(time => ({ time, open: 100, high: 102, low: 99, close: 101, volume: 1 }));
function App() {
  const [, redraw] = React.useState(0);
  Object.assign(window, {
    gestureEmoji: (next: typeof view) => { Object.assign(view, next); notify(); },
    repaintEmoji: () => redraw(value => value + 1),
  });
  return <section style={{ position: "relative", width: 1000, height: 800 }}>
    <ChartDrawLayer width={1000} height={800} activeTool="cursor" emoji="🙂"
      keepDrawing={false} drawings={[drawing]} selectedId={drawing.id}
      toX={toX} toY={toY} fromXY={(time, price) => ({ time, price })}
      candles={candles} magnet={false} magnetStrength="weak" viewportVersion={0}
      chartReady={1} subscribeViewport={subscribe} onCommit={() => {}}
      onUpdate={() => {}} onDelete={() => {}} onSelect={() => {}}
      onToolConsumed={() => {}} onRequestText={() => {}} onOpenSettings={() => {}} />
  </section>;
}
createRoot(document.getElementById("root")!).render(<App />);
