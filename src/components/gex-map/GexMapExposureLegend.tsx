import { gexMapHeatColorCss, gexMapSignedLegendGradient, type GexMapExposureRange } from "@/lib/gexMapPalette";
import { formatGexMapExposureLegend } from "@/lib/gexMapFormat";

export default function GexMapExposureLegend({ range, scale, hasData }: {
  range: GexMapExposureRange; scale: string[]; hasData: boolean;
}) {
  return (
    <div className="shrink-0 border-t border-border bg-panel px-3 py-2" data-gex-exposure-legend
      title="Colours scale independently from zero to the current negative and positive peaks.">
      <div className="relative h-1.5 rounded-full" style={{ background: gexMapSignedLegendGradient(scale) }}>
        <span aria-hidden className="absolute inset-y-0 left-1/2 w-px" style={{ backgroundColor: gexMapHeatColorCss(0.5, scale) }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[8px] text-muted">
        <span>{hasData ? formatGexMapExposureLegend(range.min) : "Negative"}</span>
        <span>0</span>
        <span>{hasData ? formatGexMapExposureLegend(range.max) : "Positive"}</span>
      </div>
    </div>
  );
}
