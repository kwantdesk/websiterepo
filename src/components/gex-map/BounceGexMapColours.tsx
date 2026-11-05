"use client";

import { useEffect, useState } from "react";
import {
  GEX_MAP_PALETTE_CHANGE_EVENT, GEX_MAP_SHARED_PALETTE_PRESETS,
  gexMapPaletteFromPreset, gexMapPalettesEqual, gexMapSignedLegendGradient,
  loadGexMapPalette, saveGexMapPalette, type GexMapPalette,
} from "@/lib/gexMapPalette";

/** The same saved palette used by GEX Map and its Bounce projections. */
export default function BounceGexMapColours() {
  const [palette, setPalette] = useState<GexMapPalette>(() => loadGexMapPalette());
  useEffect(() => {
    const update = () => setPalette(loadGexMapPalette());
    window.addEventListener(GEX_MAP_PALETTE_CHANGE_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(GEX_MAP_PALETTE_CHANGE_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return (
    <section className="space-y-3 rounded-xl border border-border bg-background p-3">
      <div>
        <h3 className="text-xs font-semibold text-foreground">Colour combinations</h3>
        <p className="mt-1 text-[11px] leading-5 text-muted">Choose a palette to apply and save it for Bounce Levels and GEX Map.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Bounce Levels colour combinations">
        {GEX_MAP_SHARED_PALETTE_PRESETS.map((preset) => {
          const next = gexMapPaletteFromPreset(preset);
          const active = gexMapPalettesEqual(palette, next);
          return (
            <button key={preset.id} type="button" aria-label={`${preset.label} palette`} aria-pressed={active}
              onClick={() => saveGexMapPalette(next)}
              className={`flex min-h-10 items-center justify-center rounded-lg border p-1 ${active ? "border-primary ring-1 ring-primary" : "border-border"}`}
              style={{ background: gexMapSignedLegendGradient(next.scaleStops!) }}>
              <span className="rounded bg-black/80 px-2 py-1 text-[10px] font-semibold text-white">{preset.label}</span>
            </button>
          );
        })}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
        <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={palette.useThemeColors}
          onChange={(event) => saveGexMapPalette({ ...palette, useThemeColors: event.target.checked })} />
        Use theme colours
      </label>
    </section>
  );
}
