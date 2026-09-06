import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { ISeriesPrimitive, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "./lightweightChartsCompat";

export type TextOnChartOptions = { text: string; fontSize: number; textColor: string; backgroundColor: string };

export class TextOnChartPrimitive implements ISeriesPrimitive<Time> {
  private attachment: SeriesAttachedParameter<Time> | null = null;
  private options: TextOnChartOptions | null = null;
  private readonly view: ISeriesPrimitivePaneView = { zOrder: () => "top", renderer: () => ({ draw: target => this.draw(target) }) };
  attached(value: SeriesAttachedParameter<Time>) { this.attachment = value; }
  detached() { this.attachment = null; this.options = null; }
  paneViews() { return [this.view]; }
  update(options: TextOnChartOptions) { this.options = options; this.attachment?.requestUpdate(); }
  private draw(target: CanvasRenderingTarget2D) {
    const options = this.options;
    if (!this.attachment || !options?.text.trim()) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const size = Math.max(6, Math.min(50, options.fontSize));
      const lines = options.text.replace(/\r/g, "").split("\n").slice(0, 20);
      context.save();
      try {
        context.font = `400 ${size}px sans-serif`; context.textBaseline = "top";
        const width = Math.min(mediaSize.width - 16, Math.max(...lines.map(line => context.measureText(line).width)) + 10);
        const height = lines.length * size * 1.2 + 8;
        context.fillStyle = options.backgroundColor; context.fillRect(8, 8, Math.max(0, width), height);
        context.beginPath(); context.rect(8, 8, Math.max(0, width), height); context.clip();
        context.fillStyle = options.textColor;
        lines.forEach((line, index) => context.fillText(line, 13, 12 + index * size * 1.2));
      } finally { context.restore(); }
    });
  }
}
