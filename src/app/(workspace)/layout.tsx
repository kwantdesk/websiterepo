"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import KwantifyWorkspace, {
  type PrimaryWorkspaceSection,
} from "@/components/KwantifyWorkspace";

const SECTION_BY_PATH: Record<string, PrimaryWorkspaceSection> = {
  "/charts": "charts",
  "/gamma": "gamma",
  "/gamma-bot": "gammaBot",
  "/levelz": "levelz",
  "/gexmap": "gexmap",
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
  if (direct) return { section: direct, socialProfileHandle: "" };

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
  const location = useMemo(() => workspaceLocation(pathname), [pathname]);

  return (
    <KwantifyWorkspace
      section={location.section}
      socialProfileHandle={location.socialProfileHandle}
    />
  );
}
