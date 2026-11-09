"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TOOL_CONFIGURATION_OPTIONS, sanitizeToolConfiguration } from "../../../public/gex-data-app/tool-configuration.js";
import { X } from "lucide-react";
import { GEX_MAP_PALETTE_PRESETS } from "@/lib/gexMapPalette";
import { resolveGexBoxRoles } from "@/lib/gexBoxTheme";

export default function GexPaletteSettings({ paletteId, onPreview, onSave, onClose, includeSiteTheme = false, displaySettings, onDisplayPreview }: {
  paletteId: string;
  onPreview: (id: string) => void;
  onSave: (id: string, display?: Record<string, boolean>) => void;
  onClose: () => void;
  includeSiteTheme?: boolean;
  displaySettings?: Record<string, boolean>;
  onDisplayPreview?: (value: Record<string, boolean>) => void;
}) {
  // The palette as it was on open, so Discard is exact.
  const originalRef = useRef(paletteId);
  const [draft, setDraft] = useState(paletteId);
  const [confirming, setConfirming] = useState(false);
  const originalDisplay = useRef(sanitizeToolConfiguration(displaySettings));
  const [display, setDisplay] = useState(originalDisplay.current);
  const [tab, setTab] = useState(displaySettings ? "Display" : "Colours");
  const dirty = draft !== originalRef.current || !!displaySettings && JSON.stringify(display) !== JSON.stringify(originalDisplay.current);

  const discard = useCallback(() => {
    onPreview(originalRef.current);
    onDisplayPreview?.(originalDisplay.current);
    onClose();
  }, [onClose, onPreview, onDisplayPreview]);

  const attemptClose = useCallback(() => {
    if (!dirty) { onClose(); return; }
    setConfirming(true);
  }, [dirty, onClose]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopPropagation();
      if (confirming) setConfirming(false); else attemptClose();
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [attemptClose, confirming]);

  return <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/35 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) attemptClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={displaySettings ? "GEX Data settings" : "Workspace style"} className="flex h-[min(680px,86vh)] w-[min(760px,94vw)] flex-col overflow-hidden rounded-2xl border border-border bg-panel text-foreground shadow-2xl">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div>
          <h2 className="text-sm font-semibold">{displaySettings ? "GEX Data settings" : "Workspace style"}</h2>
          <p className="mt-0.5 text-[11px] text-muted">Preview changes on your workspace, then Save</p>
        </div>
        <button onClick={attemptClose} aria-label="Close workspace style"><X className="h-4 w-4 text-muted" /></button>
      </div>
      {displaySettings ? <div role="tablist" aria-label="Settings sections" className="flex shrink-0 gap-2 border-b border-border px-4 py-3">
        {["Display", "Colours"].map(name => <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)} className={`rounded-lg border px-4 py-2 text-xs ${tab === name ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted"}`}>{name}</button>)}
      </div> : null}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {displaySettings && tab === "Display" ? <div role="tabpanel" aria-label="Display settings" className="space-y-1">
          {TOOL_CONFIGURATION_OPTIONS.map(({key, label}) => <label key={key} className="flex min-h-12 cursor-pointer items-center justify-between gap-4 border-b border-border/50 py-2 text-sm">
            <span>{label}</span><input type="checkbox" role="switch" aria-label={label} checked={!display[key]} onChange={event => {
              const next = {...display, [key]: !event.target.checked}; setDisplay(next); onDisplayPreview?.(next);
            }} className="h-4 w-4 accent-primary" />
          </label>)}
        </div> : null}
        <div hidden={tab !== "Colours"}>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {includeSiteTheme ? <button type="button" onClick={() => { setDraft("site"); onPreview("site"); }} aria-pressed={draft === "site"} className="rounded-lg border border-border bg-background p-2.5 text-left text-[10px] text-foreground">
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
              className={`flex flex-col gap-2 rounded-lg border p-2.5 text-left transition-colors ${selected ? "border-primary/45 bg-primary/[.07]" : "border-border bg-background hover:border-primary/30"}`}
            >
              <span className="flex items-center justify-between">
                <b className="text-[9px] font-semibold uppercase tracking-[.12em] text-foreground">{preset.label}</b>
                {selected ? <span className="text-[9px] uppercase tracking-[.14em] text-primary">Active</span> : null}
              </span>
              <span className="flex h-4 overflow-hidden">
                {roles.scale.map((stop, index) => <i key={`${preset.id}-${index}`} className="h-full flex-1" style={{ backgroundColor: stop }} />)}
              </span>
              <span className="flex items-center gap-2 text-[9px] uppercase tracking-[.12em]">
                <span className="flex items-center gap-1" style={{ color: roles.call }}><i className="h-2 w-2" style={{ backgroundColor: roles.call }} />Call</span>
                <span className="flex items-center gap-1" style={{ color: roles.put }}><i className="h-2 w-2" style={{ backgroundColor: roles.put }} />Put</span>
                <span style={{ color: roles.strike }}>Strike</span>
                <span style={{ color: roles.header }}>Header</span>
              </span>
            </button>;
          })}
        </div>
        </div>
      </div>
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-t border-border px-4">
        <span className="text-[10px] uppercase tracking-[.14em] text-muted">
          {dirty ? "Unsaved changes" : "Saved"}
        </span>
        <span className="flex items-center gap-2">
          <button
            onClick={discard}
            className="flex h-8 items-center rounded-lg border border-border px-3 text-[9px] font-semibold uppercase tracking-[.12em] text-muted hover:text-foreground"
          >
            Discard
          </button>
          <button
            onClick={() => { originalRef.current = draft; onSave(draft, displaySettings ? display : undefined); }}
            disabled={!dirty}
            className={`flex h-8 items-center rounded-lg border px-4 text-[9px] font-semibold uppercase tracking-[.12em] ${dirty ? "border-primary/35 bg-primary/10 text-primary" : "border-border text-muted opacity-50"}`}
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
        <h3 className="text-[10px] font-semibold uppercase tracking-[.16em] text-foreground">Save these settings?</h3>
        <p className="mt-2 text-[9px] leading-4 text-muted">
          Keep these changes, or restore the saved settings.
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={() => setConfirming(false)} className="flex h-8 items-center rounded-lg border border-border px-3 text-[9px] uppercase tracking-[.12em] text-muted hover:text-foreground">Keep editing</button>
          <button onClick={discard} className="flex h-8 items-center rounded-lg border border-border px-3 text-[9px] uppercase tracking-[.12em] text-muted hover:text-foreground">Discard</button>
          <button onClick={() => { originalRef.current = draft; onSave(draft, displaySettings ? display : undefined); }} className="flex h-8 items-center rounded-lg border border-primary/35 bg-primary/10 px-4 text-[9px] font-semibold uppercase tracking-[.12em] text-primary">Save</button>
        </div>
      </div>
    </div> : null}
  </div>;
}
