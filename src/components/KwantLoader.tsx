"use client";

import type { LucideIcon } from "lucide-react";
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { prepareWorkspaceLoadingExit, syncWorkspaceSpinner } from "../../public/workspace-loading.js";

type KwantLoaderProps = {
  title: string;
  detail?: string;
  icon?: LucideIcon;
  className?: string;
  compact?: boolean;
  /** Keep workspace handoffs visually identical and announce context to assistive technology. */
  screen?: boolean;
  /** Keep readiness accessible without a visible startup screen or animation. */
  quiet?: boolean;
  /** Fill the available page or pane supplied by the layout. */
  page?: boolean;
  style?: CSSProperties;
};

export default function KwantLoader({
  title,
  detail,
  icon: Icon,
  className = "",
  compact = false,
  screen = false,
  quiet = false,
  page = false,
  style,
}: KwantLoaderProps) {
  const loaderRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const loader = loaderRef.current;
    if (!loader || quiet) return;
    syncWorkspaceSpinner(loader);
    const mountedAt = performance.now();
    return () => {
      if (performance.now() - mountedAt < 40) return;
      const finish = prepareWorkspaceLoadingExit(loader);
      if (finish) queueMicrotask(() => {
        if (!loader.isConnected) finish();
      });
    };
  }, [quiet]);

  if (quiet) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={title}
        aria-busy="true"
        data-workspace-loading="quiet"
        className={`relative min-h-0 bg-background ${page ? "h-full w-full grow self-stretch" : ""} ${className}`}
        style={style}
      >
        <span className="sr-only">{title}</span>
      </div>
    );
  }
  return (
    <div
      ref={loaderRef}
      role="status"
      aria-live="polite"
      aria-label={title}
      aria-busy="true"
      className={`kwant-loader relative flex min-h-0 items-center justify-center overflow-hidden bg-background text-center ${
        page ? "h-full w-full grow self-stretch" : ""
      } ${className}`}
      style={style}
    >
      <div className={`kwant-loader-content${compact ? " kwant-loader-content-compact" : ""}`}>
        <span className="kwant-loader-label" aria-hidden="true">
          {!screen && Icon ? <Icon className="h-3.5 w-3.5" /> : null}
          {screen ? "Loading…" : title}
        </span>
        <span className="kwant-loader-spinner" aria-hidden="true" />
        {detail ? <span className={screen ? "sr-only" : "max-w-sm text-[10px] leading-4 text-muted"}>{detail}</span> : null}
      </div>
    </div>
  );
}
