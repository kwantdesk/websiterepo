import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { ISeriesPrimitive, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "@/lib/lightweightChartsCompat";
import type { GapZone } from "@/lib/gapDetector";

export type GapZoneRenderOptions = { zones: readonly GapZone[]; opacity: number; borderWidth?: number };

export class GapZonePrimitive implements ISeriesPrimitive<Time> {
  private attachment: SeriesAttachedParameter<Time> | null = null;
  private options: GapZoneRenderOptions = { zones: [], opacity: 0.4 };
  private color = "#ffffff";
  private readonly view: ISeriesPrimitivePaneView = {
    zOrder: () => "bottom",
    renderer: () => ({ draw: target => this.draw(target) }),
  };
  attached(attachment: SeriesAttachedParameter<Time>) { this.attachment = attachment; }
  detached() { this.attachment = null; this.options = { zones: [], opacity: 0.4 }; }
  paneViews() { return [this.view]; }
  update(options: GapZoneRenderOptions, color: string) {
    this.options = options;
    this.color = color;
    this.attachment?.requestUpdate();
  }
  private draw(target: CanvasRenderingTarget2D) {
    const attachment = this.attachment;
    if (!attachment || !this.options.zones.length || this.options.opacity <= 0) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();
      try {
        context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();
        context.globalAlpha = Math.max(0, Math.min(1, this.options.opacity));
        context.fillStyle = this.color;
        for (const zone of this.options.zones) {
          const start = attachment.chart.timeScale().timeToCoordinate(zone.startTime as Time);
          const end = attachment.chart.timeScale().timeToCoordinate(zone.endTime as Time);
          const high = attachment.series.priceToCoordinate(zone.high);
          const low = attachment.series.priceToCoordinate(zone.low);
          if ([start, end, high, low].some((value) => value === null || !Number.isFinite(value))) continue;
          const left = Math.min(start!, end!);
          const right = zone.extendToRight ? mediaSize.width : Math.max(start!, end!);
          const top = Math.min(high!, low!);
          const bottom = Math.max(high!, low!);
          if (right < 0 || left > mediaSize.width || bottom < 0 || top > mediaSize.height) continue;
          context.fillRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
          const borderWidth = Math.max(0, Math.min(8, this.options.borderWidth ?? 0));
          if (borderWidth > 0) {
            context.globalAlpha = 1;
            context.strokeStyle = this.color;
            context.lineWidth = borderWidth;
            context.strokeRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
            context.globalAlpha = Math.max(0, Math.min(1, this.options.opacity));
          }
        }
      } finally { context.restore(); }
    });
  }
}
