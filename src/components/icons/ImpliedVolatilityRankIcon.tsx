"use client";

import { forwardRef, type SVGProps } from "react";

/** Original KwantDesk IV Rank mark: a bounded 0–100 range with a live rank trace. */
const ImpliedVolatilityRankIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  function ImpliedVolatilityRankIcon({ className, ...props }, ref) {
    return (
      <svg
        ref={ref}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        {...props}
      >
        <path d="M4 4.5v15h16" opacity=".7" />
        <path d="M4 8h16M4 16h16" opacity=".35" strokeDasharray="2 2" />
        <path d="m6.5 15 3-4 3 2 4.5-6" />
        <circle cx="17" cy="7" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    );
  },
);

export default ImpliedVolatilityRankIcon;
