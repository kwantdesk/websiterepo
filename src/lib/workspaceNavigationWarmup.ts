const prepared = new Map<string, number>();
const RETRY_AFTER_MS = 30_000;

const workspaceCode: Record<string, () => Promise<unknown>> = {
  "/charts": () => import("@/components/Chart"),
  "/gamvue": () => import("@/components/Chart"),
  "/gex-data": () => import("@/components/gex-data/GexDataWorkspace"),
  "/kwanty": () => import("@/components/kwanty/KwantyWorkspace"),
  "/gamma": () => import("@/components/options-flow/GammaWorkspace"),
  "/gexmap": () => import("@/components/gex-map/GexMapWorkspace"),
  "/liqmap": () => import("@/components/liquidity-map/LiquidityMapWorkspace"),
  "/news": () => import("@/components/news/NewsWorkspace"),
  "/journal": () => import("@/components/journal/JournalWorkspace"),
  "/socials": () => import("@/components/socials/SocialsWorkspace"),
  "/backtesting": () => import("@/components/backtesting/BacktestingWorkspace"),
};

/** Intent only: prepare one destination's code, never start its data/feed. */
export function warmWorkspaceNavigation(href: string, prefetch: (href: string) => void) {
  if (!href.startsWith("/") || href.startsWith("//")) return;
  const now = Date.now();
  const previous = prepared.get(href);
  if (previous !== undefined && now - previous < RETRY_AFTER_MS) return;
  prepared.set(href, now);
  // Keep URL preparation independent of module resolution; neither blocks click.
  try { prefetch(href); } catch { /* Normal navigation remains available. */ }
  const load = workspaceCode[href];
  if (!load) return;
  void Promise.all([
    import("@/components/KwantifyWorkspace"),
    load(),
  ]).catch(() => {
    // Retry on a later intent after a failed/churned deployment chunk request.
    prepared.delete(href);
  });
}
