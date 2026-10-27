/** Keep parent-owned trading/branding below every iframe modal, not just settings. */
export function observeLiquidityMapModals(root, onChange, Observer = MutationObserver) {
  let previous;
  const sync = () => {
    const open = [...root.querySelectorAll('dialog')].some(dialog => dialog.open);
    if (open !== previous) { previous = open; onChange(open); }
  };
  const observer = new Observer(sync);
  observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['open'], childList: true });
  sync();
  return () => observer.disconnect();
}
