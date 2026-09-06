import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { ISeriesPrimitive, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "@/lib/lightweightChartsCompat";

export type IchimokuCloudOptions = {
  points: Array<{ time: number; spanA: number; spanB: number }>;
  bullishColor: string;
  bearishColor: string;
  opacity: number;
};

export class IchimokuCloudPrimitive implements ISeriesPrimitive<Time> {
  private attachment: SeriesAttachedParameter<Time> | null = null;
  private options: IchimokuCloudOptions | null = null;
  private readonly view: ISeriesPrimitivePaneView = {
    zOrder: () => "bottom",
    renderer: () => ({ draw: target => this.draw(target) }),
  };
  attached(attachment: SeriesAttachedParameter<Time>) { this.attachment = attachment; }
  detached() { this.attachment = null; this.options = null; }
  paneViews() { return [this.view]; }
  update(options: IchimokuCloudOptions) { this.options = options; this.attachment?.requestUpdate(); }

  private draw(target: CanvasRenderingTarget2D) {
    const attachment = this.attachment;
    const options = this.options;
    if (!attachment || !options || options.opacity <= 0 || options.points.length < 2) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();
      try {
        context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();
        context.globalAlpha = Math.max(0, Math.min(1, options.opacity));
        for (let index = 1; index < options.points.length; index += 1) {
          const previous = options.points[index - 1];
          const current = options.points[index];
          const x1 = attachment.chart.timeScale().timeToCoordinate(previous.time as Time);
          const x2 = attachment.chart.timeScale().timeToCoordinate(current.time as Time);
          const a1 = attachment.series.priceToCoordinate(previous.spanA);
          const b1 = attachment.series.priceToCoordinate(previous.spanB);
          const a2 = attachment.series.priceToCoordinate(current.spanA);
          const b2 = attachment.series.priceToCoordinate(current.spanB);
          if ([x1, x2, a1, b1, a2, b2].some(value => value == null || !Number.isFinite(value))) continue;
          context.fillStyle = (previous.spanA + current.spanA) >= (previous.spanB + current.spanB)
            ? options.bullishColor : options.bearishColor;
          context.beginPath();
          context.moveTo(x1!, a1!); context.lineTo(x2!, a2!); context.lineTo(x2!, b2!); context.lineTo(x1!, b1!);
          context.closePath(); context.fill();
        }
      } finally { context.restore(); }
    });
  }
}
