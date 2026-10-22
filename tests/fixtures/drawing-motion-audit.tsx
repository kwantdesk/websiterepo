"use client";

// Local-only acceptance fixture. Temporarily re-export from an auth/ route;
// never deploy this route or substitute these synthetic candles for live data.
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import ChartDrawLayer from "@/components/ChartDrawLayer";
import { createChart, type IChartApi, type ISeriesApi, type Time } from "@/lib/lightweightChartsCompat";
import { ChartRepaintNotifierPrimitive } from "@/lib/chartRepaintNotifier";
import { type Drawing } from "@/lib/chartDrawTools";

const candles = Array.from({ length: 200 }, (_, i) => ({
  time: 1792600000 + i * 60, open: 100 + Math.sin(i / 8),
  high: 101.5 + Math.sin(i / 8), low: 99 + Math.sin(i / 8), close: 100.5 + Math.sin(i / 8), volume: 100,
}));
const drawings: Drawing[] = [{ id: "anchor-test", tool: "trendLine",
  points: [candles[130], candles[170]].map(c => ({ time: c.time, price: c.close })),
  style: { color: "#ff3988", useThemeColor: false, width: 2, lineStyle: "solid", fillOpacity: 0.1, showLabels: true },
}];
const noop = () => {};

export default function DrawingMotionAudit() {
  const host = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const notifier = useRef<ChartRepaintNotifierPrimitive | null>(null);
  const [ready, setReady] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState("Ready for motion test");
  const subscribe = useCallback((callback: () => void) => notifier.current?.subscribe(callback) ?? noop, []);
  const toX = (time: number) => chart.current?.timeScale().timeToCoordinate(time as Time) ?? null;
  const toY = (price: number) => series.current?.priceToCoordinate(price) ?? null;
  useEffect(() => {
    const api = createChart(host.current!, { width: 1000, height: 520, layout: { background: { color: "#090e17" }, textColor: "#ccc" } });
    const price = api.addCandlestickSeries();
    price.setData(candles.map(c => ({ ...c, time: c.time as Time })));
    api.timeScale().setVisibleLogicalRange({ from: 100, to: 199 });
    const paint = new ChartRepaintNotifierPrimitive();
    price.attachPrimitive(paint);
    chart.current = api; series.current = price; notifier.current = paint;
    setReady(1);
    return () => { api.remove(); chart.current = null; series.current = null; };
  }, []);
  const run = () => {
    let samples = 0, maxError = 0, frame = 0;
    const stop = subscribe(() => {
      // Sample after all native paint listeners, in the SAME browser frame.
      queueMicrotask(() => {
        const line = surface.current?.querySelector("svg[data-viewport] g[data-draw-hit='drawing'] > line") as SVGLineElement | null;
        const svg = line?.ownerSVGElement;
        const matrix = line?.getCTM();
        if (!line || !svg || !matrix) return;
        for (const [index, point] of drawings[0].points.entries()) {
          const local = svg.createSVGPoint();
          local.x = index ? line.x2.baseVal.value : line.x1.baseVal.value;
          local.y = index ? line.y2.baseVal.value : line.y1.baseVal.value;
          const actual = local.matrixTransform(matrix);
          maxError = Math.max(maxError, Math.hypot(actual.x - (toX(point.time) ?? NaN), actual.y - (toY(point.price) ?? NaN)));
        }
        samples++;
      });
    });
    const step = () => {
      const api = chart.current!;
      const from = 95 + 22 * Math.sin(frame / 12);
      api.timeScale().setVisibleLogicalRange({ from, to: from + 85 + 15 * Math.cos(frame / 15) });
      if (frame % 4 === 0) startTransition(() => setRevision(v => v + 1));
      if (++frame < 180) requestAnimationFrame(step);
      else requestAnimationFrame(() => {
        stop(); setResult(`${samples > 100 && maxError < 0.1 ? "PASS" : "FAIL"}: ${samples} native paints, max anchor error ${maxError.toFixed(4)}px`);
      });
    };
    setResult("Testing pan, zoom, autoscale and concurrent React updates…");
    requestAnimationFrame(step);
  };
  return <main style={{ padding: 20, color: "white", background: "#090e17" }}>
    <h1>Drawing motion acceptance · synthetic data only</h1>
    <button onClick={run}>Run 180-frame motion test</button><p role="status">{result}</p>
    <div ref={surface} style={{ position: "relative", width: 1000, height: 520 }}>
      <div ref={host} />
      {ready ? <ChartDrawLayer width={1000} height={520} priceScaleWidth={chart.current?.priceScale("right").width() ?? 60}
        plotBottomInset={28} activeTool="cursor" emoji="" keepDrawing={false} drawings={drawings} selectedId={null}
        toX={toX} toY={toY} fromXY={() => null} candles={candles} magnet={false} magnetStrength="weak"
        viewportVersion={revision} chartReady={ready} subscribeViewport={subscribe}
        onCommit={noop} onUpdate={noop} onDelete={noop} onSelect={noop} onToolConsumed={noop} onRequestText={noop} onOpenSettings={noop} /> : null}
    </div>
  </main>;
}
