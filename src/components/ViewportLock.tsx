"use client";

import { useEffect } from "react";

/**
 * Holds the desk at a fixed scale on touch devices.
 *
 * The viewport tag already declares `maximum-scale=1, user-scalable=no`, which
 * is enough when the desk is installed to the Home Screen. Safari in the
 * browser deliberately ignores both, so on an iPad a two-finger gesture — or a
 * stray one while swiping back into the app — leaves the whole page zoomed
 * with no gesture that reliably returns it to a known scale. A trading surface
 * parked half off-screen at 1.4x is unusable, and the trader has no way to tell
 * it is zoomed rather than broken.
 *
 * Two things run here:
 *
 *   - iOS fires `gesturestart`/`gesturechange`/`gestureend` for pinch zoom.
 *     These are Safari's own page-zoom gestures and are separate from the touch
 *     events charting libraries read, so refusing them stops the page zooming
 *     without taking pinch-to-zoom away from the chart itself.
 *
 *   - Returning to a backgrounded tab can restore a scale Safari was holding.
 *     There is no API to set the zoom level, but rewriting the viewport tag
 *     makes Safari re-read the constraint, which snaps the page back to 1.
 *
 * Double-tap zoom is handled in CSS by `touch-action: manipulation`, not here:
 * cancelling `touchend` to block it also interferes with click generation,
 * which is not a trade worth making on a dealing screen.
 */
export default function ViewportLock() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Nothing below applies to a mouse, and matchMedia keeps a desktop browser
    // from paying for listeners it can never fire.
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;

    const refuse = (event: Event) => event.preventDefault();
    // `gesture*` is WebKit-only and absent from the DOM lib's event map.
    const gestures = ["gesturestart", "gesturechange", "gestureend"];
    for (const name of gestures) {
      document.addEventListener(name, refuse, { passive: false });
    }

    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    let frame: number | null = null;
    const reassertScale = () => {
      if (!meta) return;
      // Only intervene when Safari is actually holding a scale; rewriting the
      // tag unprompted causes a visible reflow on a dense layout.
      if ((window.visualViewport?.scale ?? 1) === 1) return;
      const declared = meta.content;
      meta.content = `${declared}, maximum-scale=1`;
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        // Restore the declared value, or the attribute accumulates duplicates
        // every time this runs.
        meta.content = declared;
      });
    };

    // Coming back to the tab is the case that bites: the desk is re-shown at
    // whatever scale Safari had parked it at.
    const onVisibility = () => { if (!document.hidden) reassertScale(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", reassertScale);
    window.visualViewport?.addEventListener("resize", reassertScale);

    return () => {
      for (const name of gestures) {
        document.removeEventListener(name, refuse);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", reassertScale);
      window.visualViewport?.removeEventListener("resize", reassertScale);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
