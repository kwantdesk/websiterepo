import type { ISeriesPrimitive, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "./lightweightChartsCompat";

export type SuperTrendLabelOptions = {
  name: string; nameLabel: boolean; valueLabel: boolean;
  nameBackground: boolean; valueBackground: boolean; chartColorForMarker: boolean;
};
type Point = { time: number; value: number; color?: string };

/** Attached to the trend's own series, so secondary-axis projection stays correct. */
export class SuperTrendLabels implements ISeriesPrimitive<Time> {
  private attachedTo: SeriesAttachedParameter<Time> | null = null;
  private points: readonly Point[] = [];
  private options: SuperTrendLabelOptions | null = null;
  private background = "#000000";
  private precision = 2;
  private fallbackColor = "#ffffff";
  private readonly view: ISeriesPrimitivePaneView = {
    zOrder: () => "top",
    renderer: () => ({ draw: target => {
      const attached = this.attachedTo, options = this.options;
      if (!attached || !options || (!options.nameLabel && !options.valueLabel)) return;
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        // Find the latest genuinely visible point; never pin an off-screen
        // future value to an unrelated historical viewport.
        let anchor: { point: Point; x: number; y: number } | undefined;
        for (let i = this.points.length - 1; i >= 0; i--) {
          const point = this.points[i];
          const x = attached.chart.timeScale().timeToCoordinate(point.time as Time);
          const y = attached.series.priceToCoordinate(point.value);
          if (x !== null && y !== null && x >= 0 && x <= mediaSize.width && y >= 0 && y <= mediaSize.height) {
            anchor = { point, x, y }; break;
          }
        }
        if (!anchor) return;
        const color = anchor.point.color ?? this.fallbackColor;
        const labels = [
          ...(options.nameLabel ? [{ text: options.name, background: options.nameBackground }] : []),
          ...(options.valueLabel ? [{ text: anchor.point.value.toFixed(this.precision), background: options.valueBackground }] : []),
        ];
        context.save();
        context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();
        context.font = "600 10px monospace"; context.textBaseline = "middle";
        let y = Math.max(10, Math.min(mediaSize.height - labels.length * 18, anchor.y - labels.length * 18));
        for (const label of labels) {
          const width = Math.min(mediaSize.width - 4, context.measureText(label.text).width + 10);
          if (width <= 0) continue;
          const x = Math.max(2, Math.min(mediaSize.width - width - 2, anchor.x - width));
          if (label.background) {
            context.fillStyle = options.chartColorForMarker ? this.background : color;
            context.fillRect(x, y, width, 16);
            context.strokeStyle = color; context.strokeRect(x, y, width, 16);
          }
          context.fillStyle = label.background && !options.chartColorForMarker ? this.background : color;
          context.fillText(label.text, x + 5, y + 8, Math.max(1, width - 10));
          y += 18;
        }
        context.restore();
      });
    } }),
  };

  attached(param: SeriesAttachedParameter<Time>) { this.attachedTo = param; }
  detached() { this.attachedTo = null; this.points = []; this.options = null; }
  paneViews() { return [this.view]; }
  update(points: readonly Point[], options: SuperTrendLabelOptions, background: string, color: string, precision: number) {
    this.points = points; this.options = options; this.background = background;
    this.fallbackColor = color; this.precision = Math.max(0, Math.min(10, Math.round(precision)));
    this.attachedTo?.requestUpdate();
  }
}
