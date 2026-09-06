import type { ISeriesPrimitive, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "@/lib/lightweightChartsCompat";

export type PivotPointLabelOptions = { label: string; align: "left" | "right"; fontSize: number; color?: string; backgroundColor?: string };
type Point = { time: number; value: number; breakBefore?: boolean };

export class PivotPointLabels implements ISeriesPrimitive<Time> {
  private attachedTo: SeriesAttachedParameter<Time> | null = null;
  private points: readonly Point[] = [];
  private options: PivotPointLabelOptions | null = null;
  private color = "#ffffff";
  private readonly view: ISeriesPrimitivePaneView = {
    zOrder: () => "top",
    renderer: () => ({ draw: target => {
      const attached = this.attachedTo;
      const options = this.options;
      if (!attached || !options || !this.points.length) return;
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        const segments: Point[][] = [];
        for (const point of this.points) {
          if (point.breakBefore || !segments.length) segments.push([]);
          segments.at(-1)?.push(point);
        }
        context.save();
        context.beginPath();
        context.rect(0, 0, mediaSize.width, mediaSize.height);
        context.clip();
        context.fillStyle = options.color ?? this.color;
        context.font = `600 ${Math.max(6, Math.min(40, options.fontSize))}px monospace`;
        context.textBaseline = "bottom";
        context.textAlign = options.align;
        for (const segment of segments) {
          const point = options.align === "left" ? segment[0] : segment.at(-1);
          if (!point) continue;
          const x = attached.chart.timeScale().timeToCoordinate(point.time as Time);
          const y = attached.series.priceToCoordinate(point.value);
          if (x === null || y === null || x < 0 || x > mediaSize.width || y < 0 || y > mediaSize.height) continue;
          const offset = options.align === "left" ? 4 : -4;
          const labelX = Math.max(2, Math.min(mediaSize.width - 2, x + offset));
          const labelY = y - 2;
          if (options.backgroundColor) {
            const metrics = context.measureText(options.label);
            const paddingX = 3;
            const height = Math.max(8, options.fontSize + 4);
            const left = options.align === "left" ? labelX - paddingX : labelX - metrics.width - paddingX;
            context.fillStyle = options.backgroundColor;
            context.fillRect(left, labelY - height + 2, metrics.width + paddingX * 2, height);
            context.fillStyle = options.color ?? this.color;
          }
          context.fillText(options.label, labelX, labelY);
        }
        context.restore();
      });
    } }),
  };

  attached(parameter: SeriesAttachedParameter<Time>) { this.attachedTo = parameter; }
  detached() { this.attachedTo = null; this.points = []; this.options = null; }
  paneViews() { return [this.view]; }
  update(points: readonly Point[], options: PivotPointLabelOptions, color: string) {
    this.points = points;
    this.options = options;
    this.color = color;
    this.attachedTo?.requestUpdate();
  }
}
