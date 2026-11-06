"use client";
import { useEffect, useRef, type RefObject } from "react";
import { DrawingEditHistory } from "@/lib/drawingEditHistory";

const activePanes = new WeakMap<Document, HTMLElement>();
const textTarget = (target: EventTarget | null) => (target as Element | null)?.closest?.(
  'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
);

export function useChartDrawingUndo(
  root: RefObject<HTMLElement | null>,
  scope: string,
  enabled: boolean,
  flushPending: RefObject<(() => void) | null>,
) {
  const ref = useRef({ scope, history: new DrawingEditHistory() });
  if (ref.current.scope !== scope) ref.current = { scope, history: new DrawingEditHistory() };
  const { history } = ref.current;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  useEffect(() => {
    const pane = root.current;
    if (!pane) return;
    const doc = pane.ownerDocument;
    const view = doc.defaultView;
    const claim = (event: Event) => {
      if (event.composedPath().includes(pane)) {
        activePanes.set(doc, pane);
      } else if (activePanes.get(doc) === pane) {
        activePanes.delete(doc);
      }
    };
    const pointerDown = (event: PointerEvent) => {
      claim(event);
      if (!event.composedPath().includes(pane)) return;
      flushPending.current?.();
      history.beginGesture();
      // Drawings capture the pointer before the browser can leave a text field.
      if (!textTarget(event.target) && textTarget(doc.activeElement)) {
        (doc.activeElement as HTMLElement).blur();
      }
    };
    const key = (event: KeyboardEvent) => {
      if (!enabledRef.current || event.defaultPrevented || event.altKey || !(event.ctrlKey || event.metaKey)
        || activePanes.get(doc) !== pane || !pane.isConnected || textTarget(event.target)) return;
      const command = event.key.toLowerCase();
      if (command !== "z" && command !== "y") return;
      flushPending.current?.();
      if (history.step(command === "y" || event.shiftKey)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    // Capture before drawing layers stop propagation to claim a drag.
    view?.addEventListener("pointerdown", pointerDown, true);
    doc.addEventListener("focusin", claim, true);
    doc.addEventListener("keydown", key, true);
    return () => {
      view?.removeEventListener("pointerdown", pointerDown, true);
      doc.removeEventListener("focusin", claim, true);
      doc.removeEventListener("keydown", key, true);
      if (activePanes.get(doc) === pane) activePanes.delete(doc);
    };
  }, [flushPending, history, root]);
  return history;
}
