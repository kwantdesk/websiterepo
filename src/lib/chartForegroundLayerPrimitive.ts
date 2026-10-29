import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { ISeriesPrimitive, SeriesAttachedParameter, Time } from "@/lib/lightweightChartsCompat";

/** Present the chart's native foreground above SVG drawings, without moving
 * its input canvas or drawing translucent profiles twice. One bitmap copy per
 * native paint; no extra animation loop, profile calculation or market request. */
export class ChartForegroundLayerPrimitive implements ISeriesPrimitive<Time> {
  private params: SeriesAttachedParameter<Time> | null = null;
  private enabled = false;
  private canvas: HTMLCanvasElement | null = null;
  private source: HTMLCanvasElement | null = null;
  private sourceOpacity = "";
  private queued = false;
  private generation = 0;
  private readonly view = {
    zOrder: () => "top" as const,
    renderer: () => ({ draw: (target: CanvasRenderingTarget2D) => {
      target.useBitmapCoordinateSpace(({ context }) => this.schedule(context.canvas));
    } }),
  };

  private readonly host: HTMLElement | null;
  constructor(host: HTMLElement | null = null) { this.host = host; }

  attached(params: SeriesAttachedParameter<Time>) { this.params = params; }
  detached() { this.clear(); this.params = null; }
  paneViews() { return this.enabled ? [this.view] : []; }

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.clear();
    this.params?.requestUpdate();
  }

  private restoreSource() {
    if (this.source) this.source.style.opacity = this.sourceOpacity;
    this.source = null;
  }

  private clear() {
    this.generation += 1;
    this.queued = false;
    this.restoreSource();
    this.canvas?.remove();
    this.canvas = null;
  }

  private schedule(source: HTMLCanvasElement) {
    if (!this.enabled || !this.params) return;
    if (this.source !== source) {
      this.restoreSource();
      this.source = source;
      this.sourceOpacity = source.style.opacity;
    }
    if (this.queued) return;
    this.queued = true;
    const generation = this.generation;
    // After ALL series, primitives and labels finish this paint, but before
    // the browser presents it. A second rAF would introduce a one-frame lag.
    queueMicrotask(() => {
      if (generation !== this.generation) return;
      this.queued = false;
      if (this.enabled && this.params && this.source) this.present();
    });
  }

  private present() {
    const source = this.source;
    const host = this.host ?? this.params?.chart.chartElement();
    if (!source || !host) return;
    try {
      const sourceRect = source.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      if (!(source.width > 0 && source.height > 0 && sourceRect.width > 0 && sourceRect.height > 0)) {
        source.style.opacity = this.sourceOpacity;
        if (this.canvas) this.canvas.style.display = "none";
        return;
      }
      if (!this.canvas) {
        this.canvas = host.ownerDocument.createElement("canvas");
        this.canvas.dataset.chartForegroundLayer = "volume-profiles";
        this.canvas.setAttribute("aria-hidden", "true");
        Object.assign(this.canvas.style, { position: "absolute", zIndex: "25", pointerEvents: "none" });
        host.appendChild(this.canvas);
      }
      const canvas = this.canvas;
      if (canvas.width !== source.width) canvas.width = source.width;
      if (canvas.height !== source.height) canvas.height = source.height;
      const scaleX = host.clientWidth > 0 ? hostRect.width / host.clientWidth : 1;
      const scaleY = host.clientHeight > 0 ? hostRect.height / host.clientHeight : 1;
      const styles = {
        left: `${(sourceRect.left - hostRect.left) / (scaleX || 1)}px`,
        top: `${(sourceRect.top - hostRect.top) / (scaleY || 1)}px`,
        width: `${sourceRect.width / (scaleX || 1)}px`,
        height: `${sourceRect.height / (scaleY || 1)}px`, display: "block", opacity: this.sourceOpacity,
      };
      for (const [key, value] of Object.entries(styles)) {
        if (canvas.style[key as keyof typeof styles] !== value) canvas.style[key as keyof typeof styles] = value;
      }
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Foreground canvas unavailable");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0);
      // Opacity leaves the original pointer target working. Hide it ONLY
      // after the successful copy, otherwise a failure would blank studies.
      if (source.style.opacity !== "0") source.style.opacity = "0";
    } catch {
      source.style.opacity = this.sourceOpacity;
      this.canvas?.remove();
      this.canvas = null;
    }
  }
}
