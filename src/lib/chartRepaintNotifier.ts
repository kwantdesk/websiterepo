import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";

/**
 * A zero-pixel primitive whose only job is to report that the chart repainted.
 *
 * Overlays drawn in HTML/SVG have to re-project themselves whenever the chart's
 * transform changes. Subscribing to the time scale's visible-range event only
 * covers HORIZONTAL movement: the price scale rescales constantly (auto-scale
 * on new bars, dragging the price axis, switching instruments) and fires no
 * such event, so an SVG overlay kept painting at stale Y coordinates and its
 * lines visibly drifted away from the bars they were anchored to.
 *
 * The chart calls every primitive's draw() on each repaint, so this is the one
 * signal guaranteed to fire for BOTH axes at exactly the moment the geometry
 * changes. Listeners coalesce to one animation frame, so a burst of repaints
 * still costs a single overlay update.
 */
export class ChartRepaintNotifierPrimitive implements ISeriesPrimitive<Time> {
  private readonly listeners = new Set<() => void>();
  private readonly paneView: ISeriesPrimitivePaneView;

  constructor() {
    const renderer: ISeriesPrimitivePaneRenderer = {
      draw: (_target: CanvasRenderingTarget2D) => {
        // Notify AFTER the current paint so listeners read the new transform.
        for (const listener of this.listeners) listener();
      },
    };
    this.paneView = {
      zOrder: () => "bottom" as const,
      renderer: () => renderer,
    };
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  attached(_param: SeriesAttachedParameter<Time>) {}

  detached() {
    this.listeners.clear();
  }

  paneViews() {
    return [this.paneView];
  }
}
