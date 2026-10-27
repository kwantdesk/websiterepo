const owners = new WeakMap<HTMLElement, number>();

/** Applied in a layout effect: a route must never paint between font scopes. */
export function acquireCockpitTypography(body: HTMLElement) {
  owners.set(body, (owners.get(body) ?? 0) + 1);
  body.classList.add("kwant-cockpit-ui");
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = Math.max(0, (owners.get(body) ?? 1) - 1);
    if (remaining) owners.set(body, remaining);
    else { owners.delete(body); body.classList.remove("kwant-cockpit-ui"); }
  };
}
