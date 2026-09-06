import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { ISeriesPrimitive, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "@/lib/lightweightChartsCompat";

export type ZigZagRetracementOptions = {
  startTime: number;
  endTime: number;
  levels: Array<{ ratio: number; label: string; value: number }>;
  extendRight: boolean;
  fontSize: number;
  lineWidth: number;
  lineColor: string;
  textColor: string;
  backgroundColor: string;
};

export class ZigZagRetracementPrimitive implements ISeriesPrimitive<Time> {
  private attachment: SeriesAttachedParameter<Time> | null = null;
  private options: ZigZagRetracementOptions | null = null;
  private readonly view: ISeriesPrimitivePaneView = { zOrder: () => "top", renderer: () => ({ draw: target => this.draw(target) }) };
  attached(attachment: SeriesAttachedParameter<Time>) { this.attachment = attachment; }
  detached() { this.attachment = null; this.options = null; }
  paneViews() { return [this.view]; }
  update(options: ZigZagRetracementOptions) { this.options = options; this.attachment?.requestUpdate(); }
  private draw(target: CanvasRenderingTarget2D) {
    const attachment = this.attachment, options = this.options;
    if (!attachment || !options || !options.levels.length) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const x1 = attachment.chart.timeScale().timeToCoordinate(options.startTime as Time);
      const nativeEnd = attachment.chart.timeScale().timeToCoordinate(options.endTime as Time);
      if (x1 === null || nativeEnd === null) return;
      const x2 = options.extendRight ? mediaSize.width : nativeEnd;
      context.save();
      try {
        context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();
        context.strokeStyle = options.lineColor; context.lineWidth = Math.max(1, Math.min(4, options.lineWidth));
        context.setLineDash([]); context.font = `600 ${Math.max(6, Math.min(40, options.fontSize))}px monospace`;
        context.textBaseline = "bottom";
        for (const level of options.levels) {
          const y = attachment.series.priceToCoordinate(level.value);
          if (y === null || !Number.isFinite(y) || y < 0 || y > mediaSize.height) continue;
          context.beginPath(); context.moveTo(Math.max(0, x1), y); context.lineTo(Math.min(mediaSize.width, x2), y); context.stroke();
          const label = level.label;
          const width = context.measureText(label).width + 8;
          const labelX = Math.max(0, Math.min(mediaSize.width - width, x2 - width));
          context.fillStyle = options.backgroundColor; context.fillRect(labelX, y - options.fontSize - 5, width, options.fontSize + 5);
          context.fillStyle = options.textColor; context.fillText(label, labelX + 4, y - 2);
        }
      } finally { context.restore(); }
    });
  }
}
