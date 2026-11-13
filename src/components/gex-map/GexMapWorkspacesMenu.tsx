"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Download, FileUp, LayoutGrid, Plus, Save, Trash2 } from "lucide-react";
import {
  deleteGexMapWorkspace, exportGexMapWorkspaces, GEX_MAP_WORKSPACES_KEY, importGexMapWorkspaces,
  normalizeGexMapWorkspaceSnapshot, readGexMapWorkspaces, saveGexMapWorkspace, type GexMapWorkspacePreset, type GexMapWorkspaceSnapshot,
} from "@/lib/gexMapWorkspaces";

const actionClass = "flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border px-2 text-[10px] font-semibold text-foreground hover:bg-surface disabled:opacity-40";

export default function GexMapWorkspacesMenu({ activeId, snapshot, onActivate, onSaved, onDelete }: {
  activeId: string | null;
  snapshot: GexMapWorkspaceSnapshot;
  onActivate: (preset: GexMapWorkspacePreset) => void;
  onSaved: (preset: GexMapWorkspacePreset) => void;
  onDelete: (id: string) => void;
}) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [presets, setPresets] = useState<GexMapWorkspacePreset[]>([]);
  const [name, setName] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const active = presets.find((preset) => preset.id === activeId);
  const signature = useMemo(() => JSON.stringify(normalizeGexMapWorkspaceSnapshot(snapshot)), [snapshot]);
  const [initialSignature] = useState(signature);
  const baseline = active ? JSON.stringify(active.snapshot) : initialSignature;
  const dirty = (!activeId || !!active) && signature !== baseline;
  const open = position !== null;

  function place() {
    const button = buttonRef.current?.getBoundingClientRect();
    if (!button) return;
    const width = Math.min(340, window.innerWidth - 16);
    setPosition({ top: button.bottom + 6, left: Math.max(8, Math.min(button.right - width, window.innerWidth - width - 8)) });
  }

  useEffect(() => {
    const sync = () => setPresets(readGexMapWorkspaces());
    const storage = (event: StorageEvent) => { if (!event.key || event.key === GEX_MAP_WORKSPACES_KEY) sync(); };
    sync();
    window.addEventListener("kwantdesk:preferences-hydrated", sync);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("kwantdesk:preferences-hydrated", sync);
      window.removeEventListener("storage", storage);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setPosition(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPosition(null);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  function save(value: string, id?: string) {
    try {
      const preset = saveGexMapWorkspace(value, snapshot, id);
      onSaved(preset);
      setPresets(readGexMapWorkspaces());
      setName(null);
      setStatus("Saved " + preset.name + ".");
    } catch (error) { setStatus((error as Error).message); }
  }

  function download(selected: GexMapWorkspacePreset[]) {
    const url = URL.createObjectURL(new Blob([exportGexMapWorkspaces(selected)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    const slug = selected.length === 1 ? selected[0].name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "workspaces";
    link.download = "kwantdesk-gex-map-" + (slug || "workspace") + ".json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setStatus("Exported " + (selected.length === 1 ? selected[0].name : "GEX Map workspaces") + ".");
  }

  async function importFile(file: File) {
    try {
      if (file.size > 1_000_000) throw new Error("This file is too large for a GEX Map workspace export.");
      const imported = importGexMapWorkspaces(await file.text());
      setPresets(readGexMapWorkspaces());
      if (imported.length === 1) onActivate(imported[0]);
      setStatus("Imported " + (imported.length === 1 ? imported[0].name : imported.length + " workspaces") + ".");
    } catch (error) { setStatus((error as Error).message); }
  }

  return <>
    <button ref={buttonRef} type="button" aria-expanded={open} aria-haspopup="dialog" aria-label="GEX Map workspaces" aria-description={dirty ? "Save this workspace" : undefined}
      onClick={() => { if (open) setPosition(null); else { setPresets(readGexMapWorkspaces()); setStatus(""); place(); } }}
      className="flex h-7 shrink-0 items-center gap-1.5 rounded-[var(--kwant-control-radius,8px)] border border-border/70 bg-background/35 px-2.5 text-[10px] font-semibold uppercase tracking-[0.075em] text-muted hover:bg-surface hover:text-foreground"
      title={active ? "Active GEX Map workspace · " + active.name : "Saved GEX Map workspaces"}>
      <LayoutGrid className="h-3.5 w-3.5" /> Workspaces
      {active ? <span className="max-w-24 truncate text-primary">{active.name}</span> : null}
      {dirty ? <span className="inline-flex text-[var(--warning)]" title="Save this workspace">
        <AlertTriangle aria-hidden="true" className="h-3 w-3" />
      </span> : null}
    </button>
    {position ? createPortal(
      <div ref={menuRef} role="dialog" aria-label="Saved GEX Map workspaces" style={{ ...position, maxHeight: Math.max(120, window.innerHeight - position.top - 8) }}
        className="fixed z-[2800] w-[min(340px,calc(100vw-16px))] overflow-y-auto rounded-2xl border border-border bg-panel p-2 shadow-2xl">
        <div className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">GEX Map workspaces</div>
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => active ? save(active.name, active.id) : setName("")}
            className="flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-primary text-[10px] font-semibold text-on-primary">
            <Save className="h-3.5 w-3.5" /> Quick Save
          </button>
          <button type="button" className={actionClass} onClick={() => { setName(""); setStatus(""); }}>
            <Plus className="h-3.5 w-3.5" /> Save As
          </button>
        </div>
        {name !== null ? <form className="mb-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); save(name); }}>
          <input autoFocus aria-label="Workspace name" placeholder="Workspace name" maxLength={80} value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs text-foreground" />
          <button type="submit" className={actionClass}>Save</button>
        </form> : null}
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {presets.map((preset) => <div key={preset.id}
            className={"flex items-center gap-1 rounded-xl " + (activeId === preset.id ? "bg-primary/10" : "hover:bg-surface")}>
            <button type="button" aria-current={activeId === preset.id ? "true" : undefined}
              onClick={() => { onActivate(preset); setPosition(null); buttonRef.current?.focus(); }}
              className="min-w-0 flex-1 truncate px-3 py-2 text-left text-xs text-foreground">{preset.name}</button>
            <button type="button" aria-label={"Export " + preset.name} className={actionClass} onClick={() => download([preset])}>
              <Download className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label={"Delete " + preset.name} className={actionClass} onClick={() => {
              if (!window.confirm('Delete workspace "' + preset.name + '"?')) return;
              try {
                deleteGexMapWorkspace(preset.id);
                onDelete(preset.id);
                setStatus("Deleted " + preset.name + ".");
              } catch (error) { setStatus((error as Error).message); }
              setPresets(readGexMapWorkspaces());
            }}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>)}
          {presets.length === 0 ? <p className="px-3 py-3 text-center text-[10px] text-muted">No saved GEX Map workspaces yet</p> : null}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-border pt-2">
          <button type="button" className={actionClass} onClick={() => fileRef.current?.click()}>
            <FileUp className="h-3.5 w-3.5" /> Import
          </button>
          <button type="button" className={actionClass} disabled={!presets.length} onClick={() => download(presets)}>
            <Download className="h-3.5 w-3.5" /> Export all
          </button>
          <input ref={fileRef} type="file" aria-label="Import GEX Map workspaces" accept=".json,application/json" hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.target.value = "";
            }} />
        </div>
        {status ? <p role="status" className="px-2 pt-2 text-[10px] text-foreground">{status}</p> : null}
      </div>, document.body) : null}
  </>;
}
