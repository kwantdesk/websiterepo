import { Sparkles, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

type KwantLoaderProps = {
  title: string;
  detail?: string;
  icon?: LucideIcon;
  className?: string;
  compact?: boolean;
  /**
   * This loader stands in for a whole page rather than one panel.
   *
   * A page-level loader was being returned in place of a workspace root that
   * carried its own height, so it fell back to the height of the words inside
   * it - a band across the top with the page showing through underneath, which
   * is what "cuts off halfway down" was. Filling the space is not something the
   * call site can be relied on to remember, so the loader claims it.
   */
  page?: boolean;
  style?: CSSProperties;
};

export default function KwantLoader({
  title,
  detail,
  icon: Icon = Sparkles,
  className = "",
  compact = false,
  page = false,
  style,
}: KwantLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={title}
      className={`kwant-loader relative flex min-h-0 items-center justify-center overflow-hidden bg-background text-center ${
        // `grow`/`self-stretch` fill a flex parent, `h-full` a sized one, and
        // the floor covers a parent that gives no height at all - which is the
        // case that produced the band.
        page ? "h-full w-full grow self-stretch min-h-[70vh]" : ""
      } ${className}`}
      style={style}
    >
      <span className="kwant-loader-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative z-[1]">
        <span
          className={`kwant-loader-emblem relative mx-auto flex items-center justify-center rounded-2xl border border-primary/25 bg-primary/[0.07] text-primary ${
            compact ? "h-10 w-10" : "h-12 w-12"
          }`}
          aria-hidden="true"
        >
          <span className="kwant-loader-halo absolute inset-[-22px] rounded-full" />
          <span className="kwant-loader-orbit absolute inset-[-6px] rounded-[20px] border border-transparent border-t-primary/65 border-r-accent/30" />
          <Icon className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} kwant-loader-icon relative z-[1]`} />
        </span>
        <div className={`${compact ? "mt-3 text-[9px]" : "mt-4 text-[12px]"} font-semibold text-foreground`}>
          {title}
        </div>
        {detail ? (
          <div className={`${compact ? "mt-1 max-w-52 text-[7px]" : "mt-1.5 max-w-sm text-[9px]"} mx-auto leading-4 text-muted`}>
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  );
}
