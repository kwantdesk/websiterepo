"use client";

import { createContext, useContext, useMemo, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";

const IndicatorStatusContext = createContext<{
  target: HTMLDivElement | null;
  setTarget: (target: HTMLDivElement | null) => void;
} | null>(null);

export function ChartIndicatorStatusProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const value = useMemo(() => ({ target, setTarget }), [target]);
  return <IndicatorStatusContext.Provider value={value}>{children}</IndicatorStatusContext.Provider>;
}

/** Status messages retain their original condition/content, but one per-chart
 * host owns their geometry instead of fixed offsets in individual studies. */
export function ChartIndicatorStatusBadge({ style, ...props }: HTMLAttributes<HTMLDivElement>) {
  const context = useContext(IndicatorStatusContext);
  if (!context?.target) return null;
  return createPortal(<div {...props} data-chart-indicator-status style={{
    ...style, position: "relative", inset: "auto", top: "auto", right: "auto", bottom: "auto", left: "auto",
    minWidth: 0, maxWidth: "100%", height: "auto", flexWrap: "wrap", overflowWrap: "anywhere", margin: 0,
  }} />, context.target);
}

export type ChartCornerBadge = {
  id: string;
  position: string;
  content: ReactNode;
};

const RIGHT_CORNER_GAP = 10;
const positions = ["top-left", "top-middle", "top-right", "bottom-left", "bottom-middle", "bottom-right"] as const;

/** One layout owner for chart badges, above/below docked study panes.
 * Flex layout measures real badge heights, including user-selected CSS zoom.
 * The timer is supplied last so every other bottom-right item stacks above it.
 */
export default function ChartCornerBadges({ badges, bottomInset, topInset, leftInset, priceScaleWidth, rightReservedWidth = 0 }: {
  badges: ChartCornerBadge[];
  bottomInset: number;
  topInset: number;
  leftInset: number;
  priceScaleWidth: number;
  rightReservedWidth?: number;
}) {
  const statusContext = useContext(IndicatorStatusContext);
  return positions.map(position => {
    const entries = badges.filter(badge => (positions.includes(badge.position as typeof positions[number]) ? badge.position : "top-right") === position && badge.content != null);
    if (!entries.length && !(position === "top-right" && statusContext)) return null;
    const bottom = position.startsWith("bottom");
    const right = position.endsWith("right");
    const middle = position.endsWith("middle");
    const statusCorner = position === "top-right";
    const style: CSSProperties = {
      ...(bottom ? { bottom: bottomInset + (right ? RIGHT_CORNER_GAP : 8) } : { top: topInset + 12 }),
      ...(right ? { right: statusCorner ? priceScaleWidth + rightReservedWidth + RIGHT_CORNER_GAP : 0 } : middle ? { left: "50%", transform: "translateX(-50%)" } : { left: leftInset + 12 }),
      alignItems: right ? "flex-end" : middle ? "center" : "flex-start",
      maxWidth: statusCorner ? `min(430px, max(0px, calc(100% - ${leftInset + priceScaleWidth + rightReservedWidth + 22}px)))` : `calc(100% - ${leftInset}px)`,
      ...(statusCorner ? { maxHeight: `max(0px, calc(100% - ${topInset + bottomInset + 24}px))`, overflow: "hidden" } : {}),
    };
    return <div key={position} data-chart-corner={position} className="pointer-events-none absolute z-[32] flex flex-col gap-2" style={style}>
      {entries.map(badge => <div key={badge.id} data-chart-corner-badge={badge.id} className="empty:hidden" style={{ marginRight: right && !statusCorner ? priceScaleWidth + RIGHT_CORNER_GAP : 0 }}>
        {badge.content}
      </div>)}
      {statusCorner && statusContext ? <div ref={statusContext.setTarget} className="contents" data-chart-indicator-status-host /> : null}
    </div>;
  });
}
