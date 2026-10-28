"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { activeWorkspaceSection, isWorkspaceFeatureArchived } from "@/lib/archivedWorkspaceFeatures";

import type { PrimaryWorkspaceSection } from "@/components/KwantifyWorkspace";
import AppSidebar from "@/components/AppSidebar";
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
    <AppSidebar activeItem={location.section} orientation="horizontal" />
    <main className="min-h-0 flex-1 bg-background" aria-label={`${location.section} workspace`} aria-busy="true" />
  </div>;
}

// The primary navigation must not wait for the large trading-engine bundle to
// download/evaluate on entry from Home. Existing auth/data gates stay inside it.
const KwantifyWorkspace = dynamic(() => import("@/components/KwantifyWorkspace"), {
  ssr: false,
  loading: WorkspaceNavigationShell,
});

export default function PersistentWorkspaceLayout({
  children: _children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (isWorkspaceFeatureArchived(SECTION_BY_PATH[pathname])) router.replace("/charts");
  }, [pathname, router]);
  const location = useMemo(() => workspaceLocation(pathname), [pathname]);

  return (
    <WorkspaceFailureBoundary
      variant="shell"
      resetKey={pathname}
      label={location.section.toUpperCase()}
    >
      <KwantifyWorkspace
        section={location.section}
        socialProfileHandle={location.socialProfileHandle}
      />
    </WorkspaceFailureBoundary>
  );
}
