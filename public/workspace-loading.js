import { startWorkspaceLoading } from "./gex-data-app/workspace-load-timeline.js?v=1";

const stopLoading = new WeakMap();

export function hideWorkspaceLoading(target) {
  stopLoading.get(target)?.();
  stopLoading.delete(target);
}

export function showWorkspaceLoading(target, title = "Loading workspace", continueProgress = false) {
  const existing = target.firstElementChild;
  if (existing?.classList.contains("site-workspace-loader")) {
    existing.setAttribute("aria-label", title);
    if (continueProgress && !stopLoading.has(target)) stopLoading.set(target, startWorkspaceLoading(existing));
    return;
  }

  hideWorkspaceLoading(target);
  const loader = document.createElement("div");
  loader.className = "site-workspace-loader";
  loader.setAttribute("role", "status");
  loader.setAttribute("aria-label", title);
  loader.setAttribute("aria-busy", "true");
  loader.innerHTML = '<div class="kwant-loader-content" aria-hidden="true"><span class="kwant-loader-label">Loading&hellip;</span><span class="kwant-loader-track"><span class="kwant-loader-fill"></span></span></div>';
  if (continueProgress) stopLoading.set(target, startWorkspaceLoading(loader));
  target.replaceChildren(loader);
}
