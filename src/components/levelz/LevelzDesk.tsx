"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeftRight, Columns2, Columns4, Copy, Grid2X2, GripVertical, Link2, Lock, LockOpen, Maximize2, Minimize2, Plus, Save, Square, Rows2, Trash2, X } from "lucide-react";
import { writeProtectedItem } from "@/lib/browserStorageQuota";
import { PREFERENCES_HYDRATED_EVENT } from "@/lib/userPreferences";
import { DEFAULT_LEVEL_PANELS, LEVELZ_WORKSPACES_KEY, moveLevelPanel, normalizeLevelDesk, normalizeLevelPresets, type LevelDesk, type LevelLayout, type LevelPanel, type LevelPreset } from "@/lib/levelzWorkspaceLayout";

type PanelActions = { controls: ReactNode; active: boolean; linked: boolean; activate: () => void; change: (patch: Partial<LevelPanel>) => void };
const button = "flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-[3px] border border-transparent px-2 text-[10px] font-semibold uppercase tracking-[0.075em] text-muted hover:bg-surface hover:text-foreground disabled:opacity-35";
const layouts = [
  { id: "single", label: "Single panel", icon: Square },
  { id: "split", label: "Two panels side by side", icon: Columns2 },
  { id: "stacked", label: "Two panels stacked", icon: Rows2 },
  { id: "quad", label: "Four-panel grid", icon: Grid2X2 },
  { id: "columns", label: "Panels side by side", icon: Columns4 },
] as const;

export default function LevelzDesk({ renderPanel, renderEducation }: {
  renderPanel: (panel: LevelPanel, index: number, actions: PanelActions) => ReactNode;
  renderEducation: (panel: LevelPanel, collapsed: boolean, toggle: () => void) => ReactNode;
}) {
  const [desk, setDesk] = useState<LevelDesk>(() => normalizeLevelDesk({ panels: DEFAULT_LEVEL_PANELS }));
  const [presets, setPresets] = useState<LevelPreset[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [maximized, setMaximized] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<string | null>(null);
  const resizeCleanup = useRef<(() => void) | null>(null);
  const serializedRef = useRef("");

  useEffect(() => {
    const restore = () => {
      let raw: Record<string, unknown> = {};
      try {
        const saved = window.localStorage.getItem(LEVELZ_WORKSPACES_KEY);
        if (saved) raw = JSON.parse(saved);
        else if (!window.localStorage.getItem("kwantdesk:levelz-legacy-migrated:v1")) {
          const legacy = JSON.parse(window.localStorage.getItem("kwantdesk:levelz-layout:v1") ?? "null");
          raw = { desk: { panels: Array.isArray(legacy) && legacy.length ? legacy : DEFAULT_LEVEL_PANELS,
            intelligenceCollapsed: window.localStorage.getItem("kwantdesk:levelz-intelligence-collapsed:v1") === "true" } };
          writeProtectedItem("kwantdesk:levelz-legacy-migrated:v1", "true");
        }
      } catch { /* Invalid saved input uses safe defaults, never provider data. */ }
      const restored = normalizeLevelDesk(raw.desk);
      const savedPresets = normalizeLevelPresets(raw.presets);
      const selected = savedPresets.some(p => p.id === raw.activePreset) ? String(raw.activePreset) : null;
      serializedRef.current = JSON.stringify({ version: 1, desk: restored, presets: savedPresets, activePreset: selected });
      setDesk(restored); setPresets(savedPresets); setActivePreset(selected); setMaximized(null); setReady(true);
    };
    restore();
    const onStorage = (event: StorageEvent) => { if (event.key === LEVELZ_WORKSPACES_KEY) restore(); };
    window.addEventListener(PREFERENCES_HYDRATED_EVENT, restore);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(PREFERENCES_HYDRATED_EVENT, restore); window.removeEventListener("storage", onStorage); resizeCleanup.current?.(); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const serialized = JSON.stringify({ version: 1, desk, presets, activePreset });
    if (serialized === serializedRef.current) return;
    if (writeProtectedItem(LEVELZ_WORKSPACES_KEY, serialized).ok) {
      serializedRef.current = serialized;
      window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
    } else setMessage("Workspace could not be saved: browser storage is full.");
  }, [activePreset, desk, presets, ready]);

  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(false); };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [menu]);

  const change = useCallback((id: string, patch: Partial<LevelPanel>) => {
    setDesk(current => ({ ...current, panels: current.panels.map(p => p.id === id ? { ...p, ...patch, id: p.id } : p) }));
  }, []);
  const add = (source?: LevelPanel) => {
    if (desk.locked || desk.panels.length >= 8) return;
    const panel = { ...(source ?? desk.panels[0]), id: `levelz-${crypto.randomUUID()}` };
    setDesk(current => ({ ...current, layout: "quad", panels: [...current.panels, panel], activePanelId: panel.id })); setMaximized(null);
  };
  const save = (quick: boolean) => {
    const existing = presets.find(p => p.id === activePreset);
    const title = (quick ? existing?.name : name)?.trim();
    if (!title) { setMessage("Enter a workspace name, then Save As."); return; }
    if (!quick && presets.some(p => p.name.toLowerCase() === title.toLowerCase())) { setMessage("That name already exists. Use Quick Save or choose another name."); return; }
    if (!quick && presets.length >= 50) { setMessage("Remove an old workspace before adding another."); return; }
    const id = quick && existing ? existing.id : `levelz-workspace-${crypto.randomUUID()}`;
    const preset = { id, name: title.slice(0, 80), desk: normalizeLevelDesk(desk), updatedAt: new Date().toISOString() };
    const next = quick && existing ? presets.map(p => p.id === id ? preset : p) : [...presets, preset];
    // Save synchronously so success never precedes a failed local write.
    const serialized = JSON.stringify({ version: 1, desk, presets: next, activePreset: id });
    if (!writeProtectedItem(LEVELZ_WORKSPACES_KEY, serialized).ok) { setMessage("Workspace could not be saved: browser storage is full."); return; }
    serializedRef.current = serialized; setPresets(next); setActivePreset(id); setName(""); setMessage(`Saved ${preset.name}`);
    window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
  };
  const visible = maximized ? desk.panels.filter(p => p.id === maximized) : desk.panels.slice(0, desk.layout === "single" ? 1 : desk.layout === "split" || desk.layout === "stacked" ? 2 : 8);
  const columns = visible.length < 2 || maximized || desk.layout === "single" || desk.layout === "stacked" ? "1fr" : desk.layout === "columns" ? `repeat(${visible.length}, minmax(0, 1fr))` : "minmax(0, var(--levelz-split)) minmax(0, 1fr)";
  const rows = maximized || desk.layout === "single" || desk.layout === "split" || desk.layout === "columns" ? 1 : desk.layout === "stacked" ? Math.min(2, visible.length) : Math.ceil(visible.length / 2);
  const active = desk.panels.find(p => p.id === desk.activePanelId) ?? desk.panels[0];
  const selected = presets.find(p => p.id === activePreset);
  const dirty = selected && JSON.stringify(selected.desk) !== JSON.stringify(desk);

  if (!ready) return <div className="flex h-full items-center justify-center text-[11px] text-muted">Restoring Levels workspace…</div>;
  return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
    <div className="relative z-40 flex min-h-[42px] shrink-0 flex-wrap items-center gap-1 border-b border-border bg-panel px-2 py-1.5">
      <span className="mr-2 text-[10px] font-semibold tracking-[0.1em] text-foreground">LEVELZ</span>
      {layouts.map(({ id, label, icon: Icon }) => <button key={id} type="button" title={label} aria-label={label} disabled={desk.locked} onClick={() => { setDesk(current => ({ ...current, layout: id as LevelLayout })); setMaximized(null); }} className={`${button} ${desk.layout === id ? "!border-primary/35 bg-primary/[0.08] !text-primary" : ""}`}><Icon className="h-4 w-4" /></button>)}
      <button type="button" className={button} disabled={desk.locked || desk.panels.length >= 8} onClick={() => add()} title="Add Levels panel"><Plus className="h-3.5 w-3.5" />Panel</button>
      <button type="button" className={button} onClick={() => setDesk(current => ({ ...current, locked: !current.locked }))} title={desk.locked ? "Unlock layout" : "Lock layout"} aria-label={desk.locked ? "Unlock layout" : "Lock layout"}>{desk.locked ? <Lock className="h-3.5 w-3.5 text-primary" /> : <LockOpen className="h-3.5 w-3.5" />}</button>
      <button type="button" className={`${button} ${desk.linked ? "!text-primary" : ""}`} aria-pressed={desk.linked} onClick={() => setDesk(current => ({ ...current, linked: !current.linked }))} title="Link chart viewports"><Link2 className="h-3.5 w-3.5" />Link</button>
      <div className="relative" ref={menuRef}>
        <button type="button" className={button} aria-expanded={menu} onClick={() => setMenu(current => !current)}><Save className="h-3.5 w-3.5" />Workspaces{dirty ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}</button>
        {menu ? <div className="absolute left-0 top-full z-50 mt-2 w-[300px] max-w-[85vw] rounded-xl border border-border bg-panel p-2 shadow-2xl">
          <div className="mb-2 flex gap-2"><button type="button" className={`${button} flex-1 !border-border`} disabled={!selected} onClick={() => save(true)}>Quick Save</button></div>
          <form className="mb-2 flex gap-1" onSubmit={event => { event.preventDefault(); save(false); }}><input aria-label="Workspace name" maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Workspace name" className="h-8 min-w-0 flex-1 rounded border border-border bg-background px-2 text-[11px]" /><button className={`${button} !border-border`} type="submit">Save As</button></form>
          <div className="max-h-64 overflow-y-auto">{presets.map(preset => <div key={preset.id} className="flex items-center rounded hover:bg-surface"><button type="button" className="min-w-0 flex-1 px-2 py-2 text-left text-[11px]" onClick={() => { setDesk(normalizeLevelDesk(preset.desk)); setActivePreset(preset.id); setMaximized(null); setMenu(false); setMessage(""); }}><span className="block truncate">{preset.name}</span><span className="text-[9px] text-muted">{preset.desk.panels.length} panels{activePreset === preset.id ? " · Active" : ""}</span></button><button type="button" className={button} aria-label={`Delete ${preset.name}`} onClick={() => { if (window.confirm(`Delete workspace "${preset.name}"?`)) { setPresets(current => current.filter(p => p.id !== preset.id)); if (activePreset === preset.id) setActivePreset(null); } }}><Trash2 className="h-3.5 w-3.5" /></button></div>)}{!presets.length ? <p className="p-2 text-[10px] text-muted">Save your panel arrangement and level selections here.</p> : null}</div>
          {message ? <p role="status" className="px-2 py-1 text-[10px] text-muted">{message}</p> : null}
        </div> : null}
      </div>
      <span className="ml-auto hidden text-[9px] text-muted md:block">{selected?.name ?? "Custom workspace"}{dirty ? " · Unsaved changes" : ""}</span>
    </div>
    <div className="flex min-h-0 flex-1 gap-1 p-1">
      <div ref={gridRef} className="relative grid min-h-0 min-w-0 flex-1 gap-1" style={{ "--levelz-split": `${desk.split}%`, gridTemplateColumns: columns, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` } as CSSProperties}>
        {visible.map((panel, index) => <div key={panel.id} className={`min-h-0 min-w-0 overflow-hidden ${dropTarget === panel.id ? "ring-2 ring-inset ring-primary" : ""}`} onDragOver={event => { if (!desk.locked && dragId.current) { event.preventDefault(); setDropTarget(panel.id); } }} onDrop={event => { event.preventDefault(); const sourceId = dragId.current; if (sourceId) setDesk(current => moveLevelPanel(current, sourceId, panel.id)); dragId.current = null; setDropTarget(null); }}>
          {renderPanel(panel, index, { active: desk.activePanelId === panel.id, linked: desk.linked, activate: () => setDesk(current => current.activePanelId === panel.id ? current : { ...current, activePanelId: panel.id }), change: patch => change(panel.id, patch), controls: <>
            <button type="button" draggable={!desk.locked} disabled={desk.locked} className={`${button} !px-1 cursor-grab`} title="Drag to swap panels; arrow keys move panel" aria-label={`Move panel ${index + 1}`} onDragStart={event => { dragId.current = panel.id; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", panel.id); }} onDragEnd={() => { dragId.current = null; setDropTarget(null); }} onKeyDown={event => { const offset = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : 0; const target = visible[index + offset]; if (offset && target) { event.preventDefault(); setDesk(current => moveLevelPanel(current, panel.id, target.id)); } }}><GripVertical className="h-3.5 w-3.5" /></button>
            <div className="ml-auto flex items-center">
              <button type="button" className={`${button} !px-1`} title={maximized ? "Restore panels" : "Maximize panel"} onClick={() => setMaximized(current => current === panel.id ? null : panel.id)}>{maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}</button>
              <button type="button" className={`${button} !px-1`} title="Duplicate panel" disabled={desk.locked || desk.panels.length >= 8} onClick={() => add(panel)}><Copy className="h-3.5 w-3.5" /></button>
              <button type="button" className={`${button} !px-1`} title="Close panel" disabled={desk.locked || desk.panels.length <= 1} onClick={() => { setDesk(current => normalizeLevelDesk({ ...current, panels: current.panels.filter(p => p.id !== panel.id) })); setMaximized(null); }}><X className="h-3.5 w-3.5" /></button>
            </div>
          </> })}
        </div>)}
        {!maximized && !desk.locked && (desk.layout === "quad" || desk.layout === "split") && visible.length > 1 ? <div role="separator" aria-label="Resize Levels columns" aria-orientation="vertical" aria-valuemin={20} aria-valuemax={80} aria-valuenow={Math.round(desk.split)} tabIndex={0} className="absolute inset-y-0 z-30 w-1 cursor-col-resize touch-none bg-border/50 hover:bg-primary/60" style={{ left: "var(--levelz-split)" }} onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setDesk(current => normalizeLevelDesk({ ...current, split: current.split + (event.key === "ArrowLeft" ? -2 : 2) })); } }} onPointerDown={event => {
          event.preventDefault(); resizeCleanup.current?.();
          const bounds = gridRef.current?.getBoundingClientRect(); if (!bounds) return;
          let split = desk.split;
          const move = (next: PointerEvent) => { split = Math.max(20, Math.min(80, (next.clientX - bounds.left) / bounds.width * 100)); gridRef.current?.style.setProperty("--levelz-split", `${split}%`); };
          const cleanup = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", finish); resizeCleanup.current = null; };
          const finish = () => { cleanup(); setDesk(current => ({ ...current, split })); };
          resizeCleanup.current = cleanup; window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish, { once: true }); window.addEventListener("pointercancel", finish, { once: true });
        }}><ArrowLeftRight className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 text-muted" /></div> : null}
      </div>
      <div className={`${desk.intelligenceCollapsed ? "w-[38px]" : "w-[300px] max-w-[35vw]"} flex min-h-0 shrink-0 flex-col [&>aside]:h-full [&>aside]:rounded-[3px]`}>
        {renderEducation(active, desk.intelligenceCollapsed, () => setDesk(current => ({ ...current, intelligenceCollapsed: !current.intelligenceCollapsed })))}
      </div>
    </div>
  </div>;
}
