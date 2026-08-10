import AppSidebar from "@/components/AppSidebar";

export const dynamic = "force-dynamic";

// Ported 1:1 from Kwantify's /heatmap page. The heatmap itself is the
// standalone canvas app in public/heatmap-app, mounted in an iframe exactly
// as it was there, so its rendering, controls, palettes and DOM ladder remain
// intact. Its original horizontal map controls sit below the site navigation,
// while the live feed remains the current Rithmic depth-by-order connection.
// It streams the live order book
// from /api/institutional-market-data/v1/heatmap/stream, which the Rithmic
// collector serves as depth-by-order.
//
// The site nav rides on top in AppSidebar's horizontal mode so the map toolbar
// has the full chart width without competing with a second vertical rail.
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
