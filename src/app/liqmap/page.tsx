import AppSidebar from "@/components/AppSidebar";

export const dynamic = "force-dynamic";

// Ported 1:1 from Kwantify's /heatmap page. The heatmap itself is the
// standalone canvas app in public/heatmap-app, mounted in an iframe exactly
// as it was there, so its rendering, controls, palettes and DOM ladder are
// unchanged - including its own left tool rail. It streams the live order book
// from /api/institutional-market-data/v1/heatmap/stream, which the Rithmic
// collector serves as depth-by-order.
//
// The site nav rides on top in AppSidebar's horizontal mode rather than as the
// left rail: the heatmap app already owns the left edge for its tool rail, and
// stacking a second vertical strip beside it left two competing rails.
export default function LiqMapPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <AppSidebar activeItem="liqmap" orientation="horizontal" />

      <main className="min-h-0 flex-1 bg-chart-background">
        <iframe
          className="h-full w-full border-0"
          src="/heatmap-app/index.html"
          title="Kwant Desk liquidity heatmap"
        />
      </main>
    </div>
  );
}
