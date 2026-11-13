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
  loader.innerHTML = '<div class="kwant-loader-content" aria-hidden="true"><span class="kwant-loader-label">Loading&hellip;</span><span class="kwant-loader-track"><span class="kwant-loader-fill"></span></span></div>';
  target.replaceChildren(loader);
}
