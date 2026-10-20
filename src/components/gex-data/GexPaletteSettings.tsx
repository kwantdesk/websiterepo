"use client";

import { useCallback, useRef, useState } from "react";
import { X } from "lucide-react";
import { GEX_MAP_PALETTE_PRESETS } from "@/lib/gexMapPalette";
import { resolveGexBoxRoles } from "@/lib/gexBoxTheme";

export default function GexPaletteSettings({ paletteId, onPreview, onSave, onClose, includeSiteTheme = false }: {
  paletteId: string;
  onPreview: (id: string) => void;
  onSave: (id: string) => void;
  onClose: () => void;
  includeSiteTheme?: boolean;
}) {
  // The palette as it was on open, so Discard is exact.
  const originalRef = useRef(paletteId);
  const [draft, setDraft] = useState(paletteId);
  const [confirming, setConfirming] = useState(false);
  const dirty = draft !== originalRef.current;

  const discard = useCallback(() => {
    onPreview(originalRef.current);
    onClose();
  }, [onClose, onPreview]);

  const attemptClose = useCallback(() => {
    if (!dirty) { onClose(); return; }
    setConfirming(true);
  }, [dirty, onClose]);

  return <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/35 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) attemptClose(); }}>
    <div className="flex h-[min(680px,86vh)] w-[min(760px,94vw)] flex-col border border-border bg-panel shadow-2xl">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[.18em]">Workspace style</h2>
          <p className="mt-0.5 text-[8px] text-muted">Click through the palettes — the workspace previews behind this — then Save</p>
        </div>
        <button onClick={attemptClose} aria-label="Close workspace style"><X className="h-4 w-4 text-muted" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {includeSiteTheme ? <button type="button" onClick={() => { setDraft("site"); onPreview("site"); }} aria-pressed={draft === "site"} className="border border-border bg-background p-2.5 text-left text-[10px] text-foreground">
            <b>Follow website theme</b><span className="mt-2 block text-[9px] text-muted">Use the current theme’s chart colours</span>
          </button> : null}
          {GEX_MAP_PALETTE_PRESETS.map((preset) => {
            const roles = resolveGexBoxRoles(preset.id);
            const selected = preset.id === draft;
            return <button
              key={preset.id}
              type="button"
              aria-pressed={selected}
              onClick={() => { setDraft(preset.id); onPreview(preset.id); }}
              className={`flex flex-col gap-2 border p-2.5 text-left transition-colors ${selected ? "border-primary/45 bg-primary/[.07]" : "border-border bg-background hover:border-primary/30"}`}
            >
              <span className="flex items-center justify-between">
                <b className="text-[9px] font-semibold uppercase tracking-[.12em] text-foreground">{preset.label}</b>
                {selected ? <span className="text-[7px] uppercase tracking-[.14em] text-primary">Active</span> : null}
              </span>
              <span className="flex h-4 overflow-hidden">
                {roles.scale.map((stop, index) => <i key={`${preset.id}-${index}`} className="h-full flex-1" style={{ backgroundColor: stop }} />)}
              </span>
              <span className="flex items-center gap-2 text-[7px] uppercase tracking-[.12em]">
                <span className="flex items-center gap-1" style={{ color: roles.call }}><i className="h-2 w-2" style={{ backgroundColor: roles.call }} />Call</span>
                <span className="flex items-center gap-1" style={{ color: roles.put }}><i className="h-2 w-2" style={{ backgroundColor: roles.put }} />Put</span>
                <span style={{ color: roles.strike }}>Strike</span>
                <span style={{ color: roles.header }}>Header</span>
              </span>
            </button>;
          })}
        </div>
      </div>
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-t border-border px-4">
        <span className="text-[8px] uppercase tracking-[.14em] text-muted">
          {dirty ? "Unsaved palette" : "Saved"}
        </span>
        <span className="flex items-center gap-2">
          <button
            onClick={discard}
            className="flex h-8 items-center border border-border px-3 text-[9px] font-semibold uppercase tracking-[.12em] text-muted hover:text-foreground"
          >
            Discard
          </button>
          <button
            onClick={() => { originalRef.current = draft; onSave(draft); }}
            disabled={!dirty}
            className={`flex h-8 items-center border px-4 text-[9px] font-semibold uppercase tracking-[.12em] ${dirty ? "border-primary/35 bg-primary/10 text-primary" : "border-border text-muted opacity-50"}`}
          >
            Save
          </button>
        </span>
      </div>
    </div>
    {/*
      * Leaving with a palette the trader has not kept. Asked rather than
      * assumed either way: silently saving makes a browse permanent, and
      * silently discarding throws away a deliberate choice.
      */}
    {confirming ? <div className="absolute inset-0 z-[180] flex items-center justify-center bg-black/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirming(false); }}>
      <div className="w-[min(360px,92vw)] border border-border bg-panel p-5 shadow-2xl">
        <h3 className="text-[10px] font-semibold uppercase tracking-[.16em] text-foreground">Save this palette?</h3>
        <p className="mt-2 text-[9px] leading-4 text-muted">
          The workspace is showing a palette you have not saved. Keep it, or put the previous one back.
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={() => setConfirming(false)} className="flex h-8 items-center border border-border px-3 text-[9px] uppercase tracking-[.12em] text-muted hover:text-foreground">Keep editing</button>
          <button onClick={discard} className="flex h-8 items-center border border-border px-3 text-[9px] uppercase tracking-[.12em] text-muted hover:text-foreground">Discard</button>
          <button onClick={() => { originalRef.current = draft; onSave(draft); }} className="flex h-8 items-center border border-primary/35 bg-primary/10 px-4 text-[9px] font-semibold uppercase tracking-[.12em] text-primary">Save</button>
        </div>
      </div>
    </div> : null}
  </div>;
}
