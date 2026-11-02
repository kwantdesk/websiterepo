/**
 * Leaf dropdowns must see an outside press before chart drag guards stop it.
 * Focus also dismisses them when the user tabs to a neighbouring control.
 * Each caller checks its own trigger and portaled menu, not every menu of
 * the same type, so adjacent selectors cannot keep one another open.
 */
export function captureDropdownDismissal(listener: (event: Event) => void) {
  let listening = true;
  const onFocus = (event: FocusEvent) => {
    // React can autofocus a portal's input before attaching its parent ref.
    // Resolve containment after that commit, and ignore superseded focus.
    queueMicrotask(() => {
      if (listening && document.activeElement === event.target) listener(event);
    });
  };
  document.addEventListener("pointerdown", listener, true);
  document.addEventListener("focusin", onFocus, true);
  return () => {
    listening = false;
    document.removeEventListener("pointerdown", listener, true);
    document.removeEventListener("focusin", onFocus, true);
  };
}
