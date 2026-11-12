"use client";

import { useEffect, useMemo, useState } from "react";
import { WORKSPACE_NAVIGATION_EVENT } from "@/lib/workspaceNavigationIntent";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { activeWorkspaceSection, isWorkspaceFeatureArchived } from "@/lib/archivedWorkspaceFeatures";

import type { PrimaryWorkspaceSection } from "@/components/KwantifyWorkspace";
import AppSidebar from "@/components/AppSidebar";
import KwantLoader from "@/components/KwantLoader";
import WorkspaceFailureBoundary from "@/components/WorkspaceFailureBoundary";

const SECTION_BY_PATH: Record<string, PrimaryWorkspaceSection> = {
  "/charts": "charts",
  "/gamvue": "gamvue",
  "/gex-data": "gexdata",
  "/kwanty": "kwanty",
  "/gex-box": "gexdata",
  "/gamma": "gamma",
  "/gexmap": "gexmap",
  "/liqmap": "liqmap",
  "/heatmap": "heatmap",
  "/gexbot": "gexdata",
  "/gexdesk": "gexdesk",
  "/gameplan": "gameplan",
  "/kwantbot": "kwantbot",
  "/news": "news",
  "/zyon": "zyon",
  "/journal": "journal",
  "/socials": "socials",
  "/backtesting": "backtesting",
};

function workspaceLocation(pathname: string) {
  const direct = SECTION_BY_PATH[pathname];
  if (direct) return { section: activeWorkspaceSection(direct), socialProfileHandle: "" };

  if (pathname.startsWith("/gex-box/")) {
    return { section: "gexdata" as const, socialProfileHandle: "" };
  }

  if (pathname.startsWith("/socials/")) {
    const encodedHandle = pathname.slice("/socials/".length).split("/")[0] ?? "";
    let socialProfileHandle = encodedHandle;
    try {
      socialProfileHandle = decodeURIComponent(encodedHandle);
    } catch {
      // Keep the safe encoded value when a malformed URL is supplied.
    }
    return { section: "socials" as const, socialProfileHandle };
  }

  return { section: "charts" as const, socialProfileHandle: "" };
}

function WorkspaceNavigationShell() {
  const pathname = usePathname();
  const location = workspaceLocation(pathname);
  return <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
    <AppSidebar activeItem={location.section} orientation="horizontal" navigationMode="persistent" />
    <main className="min-h-0 flex-1 bg-background">
      <KwantLoader page screen quiet={location.section === "gamvue"} title="Loading workspace" />
    </main>
  </div>;
}

// The primary navigation must not wait for the large trading-engine bundle to
// download/evaluate on entry from Home. Existing auth/data gates stay inside it.
const KwantifyWorkspace = dynamic(() => import("@/components/KwantifyWorkspace"), {
  ssr: false,
  loading: WorkspaceNavigationShell,
});

const KwantifySettingsWorkspace = dynamic(() => import("@/components/KwantifySettingsWorkspace"), {
  ssr: false,
  loading: () => <div className="flex h-screen flex-col bg-background text-foreground">
    <AppSidebar activeItem="settings" orientation="horizontal" navigationMode="persistent" />
    <main className="min-h-0 flex-1 bg-background">
      <KwantLoader page screen title="Loading settings" />
    </main>
  </div>,
});

export default function PersistentWorkspaceLayout({
  children: _children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [requestedPath, setRequestedPath] = useState<string | null>(null);
  const activePath = requestedPath ?? pathname;
  useEffect(() => {
    const request = (event: Event) => {
      const href = (event as CustomEvent<{ href?: string }>).detail?.href;
      if (typeof href === "string" && href.startsWith("/") && !href.startsWith("//")) {
        setRequestedPath(new URL(href, window.location.href).pathname);
      }
    };
    const restore = () => setRequestedPath(window.location.pathname);
    window.addEventListener(WORKSPACE_NAVIGATION_EVENT, request);
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener(WORKSPACE_NAVIGATION_EVENT, request);
      window.removeEventListener("popstate", restore);
    };
  }, []);
  useEffect(() => {
    if (requestedPath === pathname) setRequestedPath(null);
  }, [pathname, requestedPath]);
  useEffect(() => {
    if (isWorkspaceFeatureArchived(SECTION_BY_PATH[activePath])) router.replace("/charts");
  }, [activePath, router]);
  const location = useMemo(() => workspaceLocation(activePath), [activePath]);

  return (
    <WorkspaceFailureBoundary
      variant="shell"
      resetKey={activePath}
      label={activePath === "/settings" ? "Settings" : location.section.toUpperCase()}
    >
      {activePath === "/settings" ? <KwantifySettingsWorkspace navigationMode="persistent" /> : <KwantifyWorkspace
        section={location.section}
        socialProfileHandle={location.socialProfileHandle}
      />}
    </WorkspaceFailureBoundary>
  );
}
