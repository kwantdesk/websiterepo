"use client";
import { useId, useMemo } from "react";
import { NativeVolumeProfilePrimitive } from "@/lib/nativeVolumeProfilePrimitive";
import type { SeriesAttachedParameter, Time } from "@/lib/lightweightChartsCompat";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { InstitutionalVolumeProfile } from "@/lib/institutionalMarketData";
import type { Drawing } from "@/lib/chartDrawTools";
import { drawingVolumeProfileStyle, type DrawingProfileTheme } from "@/lib/drawingVolumeProfileStyle";
import { ProfileSvgPath, createProfileSvgSurface } from "@/lib/profileSvgSurface";

type Props = {
  drawing: Drawing; profile: InstitutionalVolumeProfile; theme: DrawingProfileTheme;
  width: number; height: number; toX: (time: number) => number | null; toY: (price: number) => number | null;
  fromY: (y: number) => number | null;
};
export default function ChartDrawingVolumeProfile({ drawing, profile, theme, width, height, toX, toY, fromY }: Props) {
  const id = `${useId().replace(/:/g, "")}-${drawing.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const primitive = useMemo(() => new NativeVolumeProfilePrimitive(() => new ProfileSvgPath() as unknown as Path2D), []);
  const measureContext = useMemo(() => typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null, []);
  const stats = useMemo(() => {
    let maxVolume = 1, maxAbsDelta = 1;
    for (const level of profile.levels) {
      maxVolume = Math.max(maxVolume, level.volume);
      maxAbsDelta = Math.max(maxAbsDelta, Math.abs(level.delta));
    }
    return { maxVolume, maxAbsDelta };
  }, [profile]);
  const surface = createProfileSvgSurface(id, (text, font) => {
    if (!measureContext) return text.length * 6;
    measureContext.font = font;
    return measureContext.measureText(text).width;
  });
  // The same native painter resolves row grouping, both histogram halves,
  // contours, gradients, opacity and VA/POC. SVG only transports its output,
  // preserving the draw layer's existing selection/hit testing and clipping.
  primitive.attached({
    chart: { timeScale: () => ({ timeToCoordinate: (time: Time) => toX(Number(time)), getVisibleLogicalRange: () => null }) },
    series: { priceToCoordinate: toY, coordinateToPrice: fromY }, requestUpdate: () => {},
  } as unknown as SeriesAttachedParameter<Time>);
  primitive.setModels([{
    id: drawing.id, profile, style: drawingVolumeProfileStyle(drawing.style, theme),
    lastCandleTime: null, intervalSeconds: null,
    ...stats,
    lowPrice: profile.levels[0]?.price ?? 0, highPrice: profile.levels.at(-1)?.price ?? 0,
  }]);
  const target = { useMediaCoordinateSpace: (callback: (scope: { context: CanvasRenderingContext2D; mediaSize: { width: number; height: number } }) => void) => callback({ context: surface.context, mediaSize: { width, height } }) };
  primitive.paneViews()[0]?.renderer()?.draw(target as unknown as CanvasRenderingTarget2D);
  const color = (value: string | { id: string }) => typeof value === "string" ? value : `url(#${value.id})`;
  return <g data-drawing-volume-profile={drawing.id}>
    <defs>
      {surface.gradients.map(g => <linearGradient key={g.id} id={g.id} gradientUnits="userSpaceOnUse" x1={g.x0} y1={g.y0} x2={g.x1} y2={g.y1}>{g.stops.map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} />)}</linearGradient>)}
      {surface.clips.map(c => <clipPath key={c.id} id={c.id}><path d={c.d} /></clipPath>)}
    </defs>
    {surface.paints.map((p, i) => p.kind === "text"
      ? <text key={i} x={p.x} y={p.y} fill={color(p.fillStyle)} opacity={p.globalAlpha} style={{ font: p.font }} textAnchor={p.textAlign === "center" ? "middle" : ["right", "end"].includes(p.textAlign) ? "end" : "start"} dominantBaseline={p.textBaseline === "middle" ? "central" : p.textBaseline === "top" ? "hanging" : "alphabetic"} clipPath={p.clip ? `url(#${p.clip})` : undefined}>{p.text}</text>
      : <path key={i} d={p.d} fill={p.kind === "fill" ? color(p.fillStyle) : "none"} stroke={p.kind === "stroke" ? color(p.strokeStyle) : "none"} strokeWidth={p.lineWidth} strokeDasharray={p.dash.join(" ")} strokeLinejoin={p.lineJoin as "miter" | "round" | "bevel"} opacity={p.globalAlpha} clipPath={p.clip ? `url(#${p.clip})` : undefined} />)}
  </g>;
}
