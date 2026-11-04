export const WORKSPACE_NAVIGATION_EVENT = "kwantdesk:workspace-navigation";

/** Paint an authenticated workspace destination before App Router's transition. */
export function commitWorkspaceNavigation(href: string) {
  if (!href.startsWith("/") || href.startsWith("//")) return;
  if (`${window.location.pathname}${window.location.search}` === href) return;
  window.dispatchEvent(new CustomEvent(WORKSPACE_NAVIGATION_EVENT, { detail: { href } }));
  window.history.pushState(null, "", href);
}
