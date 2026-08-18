export const PRECISION_CANVAS_MAX_PIXEL_RATIO = 1.5;
export const PRECISION_CANVAS_MAX_DEVICE_PIXELS = 2_000_000;

export type PrecisionCanvasBackingStore = {
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  scale: number;
};

/**
 * Drawing overlays do not need to match an unbounded monitor DPR. Keeping the
 * backing store inside a fixed pixel budget prevents several chart panes from
 * exhausting Chromium's GPU process while preserving CSS-pixel coordinates.
 */
export function resolvePrecisionCanvasBackingStore(
  width: number,
  height: number,
  devicePixelRatio: number,
): PrecisionCanvasBackingStore {
  const cssWidth = Math.max(1, Math.round(Number.isFinite(width) ? width : 1));
  const cssHeight = Math.max(1, Math.round(Number.isFinite(height) ? height : 1));
  const requestedScale = Math.min(
    PRECISION_CANVAS_MAX_PIXEL_RATIO,
    Math.max(1, Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1),
  );
  const budgetScale = Math.sqrt(PRECISION_CANVAS_MAX_DEVICE_PIXELS / (cssWidth * cssHeight));
  const scale = Math.max(Number.EPSILON, Math.min(requestedScale, budgetScale));

  return {
    cssWidth,
    cssHeight,
    pixelWidth: Math.max(1, Math.round(cssWidth * scale)),
    pixelHeight: Math.max(1, Math.round(cssHeight * scale)),
    scale,
  };
}

export function releaseCanvasBackingStore(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  if (canvas.width !== 1) canvas.width = 1;
  if (canvas.height !== 1) canvas.height = 1;
}
