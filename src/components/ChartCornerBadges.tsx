"use client";

import type { CSSProperties, ReactNode } from "react";

export type ChartCornerBadge = {
  id: string;
  position: string;
  content: ReactNode;
  /** The candle timer belongs at the outer corner, beside the price axis. */
  flushToEdge?: boolean;
};

const positions = ["top-left", "top-middle", "top-right", "bottom-left", "bottom-middle", "bottom-right"] as const;

/** One layout owner for chart badges, above/below docked study panes.
 * Flex layout measures real badge heights, including user-selected CSS zoom.
 * The timer is supplied last so every other bottom-right item stacks above it.
 */
export default function ChartCornerBadges({ badges, bottomInset, topInset, leftInset, priceScaleWidth }: {
  badges: ChartCornerBadge[];
  bottomInset: number;
  topInset: number;
  leftInset: number;
  priceScaleWidth: number;
}) {
  return positions.map(position => {
    const entries = badges.filter(badge => (positions.includes(badge.position as typeof positions[number]) ? badge.position : "top-right") === position && badge.content != null);
    if (!entries.length) return null;
    const bottom = position.startsWith("bottom");
    const right = position.endsWith("right");
    const middle = position.endsWith("middle");
    const style: CSSProperties = {
      ...(bottom ? { bottom: bottomInset + (right ? 0 : 8) } : { top: topInset + 12 }),
      ...(right ? { right: 0 } : middle ? { left: "50%", transform: "translateX(-50%)" } : { left: leftInset + 12 }),
      alignItems: right ? "flex-end" : middle ? "center" : "flex-start",
      maxWidth: `calc(100% - ${leftInset}px)`,
    };
    return <div key={position} data-chart-corner={position} className="pointer-events-none absolute z-[32] flex flex-col gap-2" style={style}>
      {entries.map(badge => <div key={badge.id} data-chart-corner-badge={badge.id} className="empty:hidden" style={{ marginRight: right && !badge.flushToEdge ? priceScaleWidth + 10 : 0 }}>
        {badge.content}
      </div>)}
    </div>;
  });
}
