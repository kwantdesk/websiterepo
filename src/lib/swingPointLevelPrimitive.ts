import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { ISeriesPrimitive, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "./lightweightChartsCompat";

type Point = { time: number; value: number; breakBefore?: boolean };
export type SwingPointLevelOptions = {
  side: "high" | "low";
  displayMode: "line" | "text" | "line-and-text";
  lineStyle: "solid" | "dashed" | "dotted" | "dash-dot" | "dash-dot-dot";
  lineWidth: number; lineColor: string; textColor: string; textSize: number; textOffset: number;
};

const dash = (style: SwingPointLevelOptions["lineStyle"]) => style === "dashed" ? [8, 5]
  : style === "dotted" ? [2, 4] : style === "dash-dot" ? [8, 4, 2, 4]
    : style === "dash-dot-dot" ? [8, 4, 2, 4, 2, 4] : [];

export class SwingPointLevelPrimitive implements ISeriesPrimitive<Time> {
  private attachment: SeriesAttachedParameter<Time> | null = null;
  private points: readonly Point[] = [];
  private options: SwingPointLevelOptions | null = null;
  private readonly view: ISeriesPrimitivePaneView = { zOrder: () => "top", renderer: () => ({ draw: target => this.draw(target) }) };
  attached(attachment: SeriesAttachedParameter<Time>) { this.attachment = attachment; }
  detached() { this.attachment = null; this.points = []; this.options = null; }
  paneViews() { return [this.view]; }
  update(points: readonly Point[], options: SwingPointLevelOptions) { this.points = points; this.options = options; this.attachment?.requestUpdate(); }
  private draw(target: CanvasRenderingTarget2D) {
    const attachment = this.attachment, options = this.options;
    if (!attachment || !options || !this.points.length) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save(); context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();
      const segments: Point[][] = [];
      for (const point of this.points) { if (point.breakBefore || !segments.length) segments.push([]); segments.at(-1)!.push(point); }
      for (const segment of segments) {
        const first = segment[0], last = segment.at(-1)!;
        const x1 = attachment.chart.timeScale().timeToCoordinate(first.time as Time);
        const x2 = attachment.chart.timeScale().timeToCoordinate(last.time as Time);
        const y = attachment.series.priceToCoordinate(first.value);
        if (x1 == null || x2 == null || y == null) continue;
        if (options.displayMode !== "text") {
          context.strokeStyle = options.lineColor; context.lineWidth = options.lineWidth; context.setLineDash(dash(options.lineStyle));
          context.beginPath(); context.moveTo(x1, y); context.lineTo(x2, y); context.stroke();
        }
        if (options.displayMode !== "line") {
          const labelY = attachment.series.priceToCoordinate(first.value + (options.side === "high" ? options.textOffset : -options.textOffset));
          context.fillStyle = options.textColor; context.font = `600 ${options.textSize}px monospace`;
          context.textAlign = "left"; context.textBaseline = options.side === "high" ? "bottom" : "top";
          context.fillText(options.side === "high" ? "SH" : "SL", x1 + 3, labelY ?? y);
        }
      }
      context.restore();
    });
  }
}
