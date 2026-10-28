type ViewportSubscription = (onChange: () => void) => () => void;
type FrameScheduler = Pick<Window, "requestAnimationFrame" | "cancelAnimationFrame">;

/** Reproject pane plots during navigation without invalidating the full Chart. */
export function subscribeIndicatorPaneFrames(
  subscribe: ViewportSubscription,
  invalidate: () => void,
  scheduler: FrameScheduler,
) {
  let frame: number | null = null;
  let disposed = false;
  const onChange = () => {
    if (disposed || frame !== null) return;
    frame = scheduler.requestAnimationFrame(() => {
      frame = null;
      if (!disposed) invalidate();
    });
  };
  const unsubscribe = subscribe(onChange);
  // Also catch a viewport change between the render and this subscription.
  onChange();
  return () => {
    disposed = true;
    unsubscribe();
    if (frame !== null) scheduler.cancelAnimationFrame(frame);
  };
}
