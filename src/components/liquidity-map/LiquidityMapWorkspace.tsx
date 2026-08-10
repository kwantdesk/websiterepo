"use client";

export default function LiquidityMapWorkspace() {
  return (
    <div className="h-full min-h-0 w-full overflow-hidden bg-chart-background">
      <iframe
        className="block h-full w-full border-0 bg-chart-background"
        src="/heatmap-app/index.html"
        title="Kwant Desk liquidity heatmap"
      />
    </div>
  );
}
