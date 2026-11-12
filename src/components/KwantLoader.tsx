import { Sparkles, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

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
  icon: Icon = Sparkles,
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
      className={`kwant-loader relative flex min-h-0 items-center justify-center overflow-hidden bg-background text-center ${
        page ? "h-full w-full grow self-stretch" : ""
      } ${className}`}
      style={style}
    >
      <div className="flex min-w-0 flex-col items-center px-3">
        <span className="kwant-loader-emblem" aria-hidden="true">
          <span className="kwant-loader-orbit" />
          {screen ? null : <Icon className="h-4 w-4" />}
        </span>
        {screen ? (detail ? <span className="sr-only">{detail}</span> : null) : (
          <>
            <div className={`${compact ? "mt-3 text-[10px]" : "mt-4 text-xs"} font-semibold text-foreground`}>{title}</div>
            {detail ? <div className="mt-1 max-w-sm text-[10px] leading-4 text-muted">{detail}</div> : null}
          </>
        )}
      </div>
    </div>
  );
}
