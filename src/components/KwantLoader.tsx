import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { startWorkspaceLoading } from "../../public/gex-data-app/workspace-load-timeline.js";

function resumeLoading(node: HTMLDivElement | null) {
  if (node) return startWorkspaceLoading(node);
}

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
      role="status"
      aria-live="polite"
      aria-label={title}
      aria-busy="true"
      ref={screen ? resumeLoading : undefined}
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
        <span className="kwant-loader-track" aria-hidden="true"><span className="kwant-loader-fill" /></span>
        {detail ? <span className={screen ? "sr-only" : "max-w-sm text-[10px] leading-4 text-muted"}>{detail}</span> : null}
      </div>
    </div>
  );
}
