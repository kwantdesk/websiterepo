const loaderSelector = '.kwant-loader, .site-workspace-loader, [data-workspace-loading="quiet"]';

export function syncWorkspaceSpinner(loader) {
  const win = loader.ownerDocument?.defaultView;
  if (!win) return;
  const turnMs = win.matchMedia('(prefers-reduced-motion: reduce)').matches ? 2400 : 800;
  loader.style.setProperty('--kwant-loader-phase', `-${win.performance.now() % turnMs}ms`);
}

// Capture the old surface before the DOM swaps. The callback runs after the
// new content is in place and keeps no interactive or accessible duplicate.
export function prepareWorkspaceLoadingExit(loader) {
  const doc = loader?.ownerDocument;
  const win = doc?.defaultView;
  if (!win || !loader.isConnected) return;
  const rect = loader.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1 || rect.right <= 0 || rect.bottom <= 0
    || rect.left >= win.innerWidth || rect.top >= win.innerHeight) return;
  const style = win.getComputedStyle(loader);
  if (style.visibility !== 'visible' || Number(style.opacity) === 0) return;
  const centreX = Math.min(win.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
  const centreY = Math.min(win.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
  const surface = doc.elementFromPoint(centreX, centreY);
  if (surface && !loader.contains(surface)) return;
  const copy = loader.cloneNode(true);
  copy.removeAttribute('id');
  copy.removeAttribute('role');
  copy.removeAttribute('aria-live');
  copy.removeAttribute('aria-busy');
  copy.removeAttribute('aria-label');
  copy.setAttribute('aria-hidden', 'true');
  copy.classList.add('kwant-loader-exit');
  Object.assign(copy.style, {
    position: 'fixed', inset: 'auto', left: `${rect.left}px`, top: `${rect.top}px`,
    width: `${rect.width}px`, height: `${rect.height}px`, minHeight: '0',
    maxWidth: 'none', maxHeight: 'none', margin: '0', zIndex: '90',
    backgroundColor: style.backgroundColor, borderRadius: style.borderRadius,
  });
  return () => {
    if (!doc.body || doc.elementFromPoint(centreX, centreY)?.closest(loaderSelector)) return;
    syncWorkspaceSpinner(copy);
    doc.body.append(copy);
    copy.addEventListener('animationend', (event) => {
      if (event.target === copy) copy.remove();
    });
    win.setTimeout(() => copy.remove(), 200);
  };
}

export function hideWorkspaceLoading(target) {
  if (target.hidden) return;
  const loader = target.matches('.site-workspace-loader') ? target : target.firstElementChild;
  const finish = loader?.matches('.site-workspace-loader') ? prepareWorkspaceLoadingExit(loader) : undefined;
  target.hidden = true;
  finish?.();
}

export function showWorkspaceLoading(target, title = "Loading workspace") {
  const existing = target.firstElementChild;
  if (existing?.classList.contains("site-workspace-loader")) {
    existing.setAttribute("aria-label", title);
    return;
  }

  const loader = document.createElement("div");
  loader.className = "site-workspace-loader";
  loader.setAttribute("role", "status");
  loader.setAttribute("aria-label", title);
  loader.setAttribute("aria-busy", "true");
  loader.innerHTML = '<div class="kwant-loader-content" aria-hidden="true"><span class="kwant-loader-label">Loading&hellip;</span><span class="kwant-loader-spinner"></span></div>';
  target.replaceChildren(loader);
  syncWorkspaceSpinner(loader);
}
