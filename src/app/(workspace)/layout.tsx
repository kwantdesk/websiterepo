"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { activeWorkspaceSection, isWorkspaceFeatureArchived } from "@/lib/archivedWorkspaceFeatures";

import KwantifyWorkspace, {
  type PrimaryWorkspaceSection,
} from "@/components/KwantifyWorkspace";
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
