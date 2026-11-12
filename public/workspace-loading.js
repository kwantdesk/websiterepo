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
  loader.innerHTML = '<span class="kwant-loader-emblem" aria-hidden="true"><span class="kwant-loader-orbit"></span></span>';
  target.replaceChildren(loader);
}
