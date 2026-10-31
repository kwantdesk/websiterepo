"use client";
import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from "react";
import {createPortal} from "react-dom";
import {ChevronDown,X} from "lucide-react";
import {GEX_MAP_DRAG_BAR_TRACK,GEX_MAP_PALETTE_PRESETS,GEX_MAP_STOP_COUNT,buildGexMapSignedScale,gexMapDragBarColor,gexMapSignedScale,gexMapPalettesEqual,type GexMapPalette} from "@/lib/gexMapPalette";
import {RECOMMENDED_GEX_MAP_STAR_SETTINGS,type GexMapStarSettings,type GexMapViewMode} from "@/lib/gexMapStar";
type GexMapDropdownOption<T extends string> = {
  value: T;
  label: string;
  detail?: string;
};
export function GexMapDropdown<T extends string>({
  ariaLabel,
  value,
  options,
  menuLabel,
  menuWidth,
  onChange,
}: {
  ariaLabel: string;
  value: T;
  options: GexMapDropdownOption<T>[];
  menuLabel: string;
  menuWidth: number;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)),
      top: rect.bottom + 7,
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const height = menuRef.current?.offsetHeight ?? 300;
      const next = {
        left: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)),
        top: rect.bottom + height + 15 <= window.innerHeight ? rect.bottom + 7 : Math.max(8, rect.top - height - 7),
      };
      setPosition((current) => current?.left === next.left && current.top === next.top ? current : next);
    };
    updatePosition();
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape, true);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape, true);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, menuWidth]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleMenu}
        className={`gex-map-dropdown group flex h-7 min-w-0 flex-1 items-center justify-between gap-1.5 rounded-[3px] border px-2 text-left transition-colors ${
          open
            ? "border-primary/40 bg-primary/[0.08] text-primary"
            : "border-border/70 bg-background/35 text-foreground hover:border-primary/30 hover:bg-surface"
        }`}
      >
        <span className="text-[10px] font-semibold uppercase leading-none tracking-[0.075em]">{selected?.label ?? value}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180 text-primary" : "group-hover:text-foreground"}`} />
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={ariaLabel}
            data-kwant-select-menu data-gex-map-dropdown-menu=""
            className="fixed z-[12000] overflow-hidden rounded-2xl border border-border bg-panel/95 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.58)] backdrop-blur-xl"
            style={{ left: position.left, top: position.top, width: menuWidth }}
          >
            <div className="flex items-center justify-between px-2.5 pb-1.5 pt-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-muted">
              <span>{menuLabel}</span>
              <span>{options.length}</span>
            </div>
            <div className="max-h-[300px] space-y-0.5 overflow-y-auto">
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      triggerRef.current?.focus();
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-surface"
                    }`}
                  >
                    <span className={`flex h-7 min-w-12 shrink-0 items-center justify-center rounded-lg px-2 font-mono text-[10px] font-semibold ${
                      active
                        ? "bg-primary text-on-primary shadow-[0_0_14px_color-mix(in_srgb,var(--color-primary)_22%,transparent)]"
                        : "border border-border bg-card text-foreground"
                    }`}>
                      {option.label}
                    </span>
                    {option.detail ? (
                      <span className="min-w-0 flex-1 truncate text-[9px] text-muted">{option.detail}</span>
                    ) : null}
                    {active ? <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" /> : null}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
export default function GexMapSettingsDialog({
  open,
  embedded = false,
  settings,
  palette,
  paletteDirty,
  viewMode,
  onViewModeChange,
  onChange,
  onPaletteChange,
  onPaletteSave,
  onClose,
}: {
  open: boolean;
  embedded?: boolean;
  settings: GexMapStarSettings;
  palette: GexMapPalette;
  paletteDirty: boolean;
  viewMode: GexMapViewMode;
  onViewModeChange: (next: GexMapViewMode) => void;
  onChange: (next: GexMapStarSettings) => void;
  onPaletteChange: (next: GexMapPalette) => void;
  onPaletteSave: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);
  const [editSlot, setEditSlot] = useState<{ side: "scale" | "star"; index: number }>({
    side: "scale",
    index: GEX_MAP_STOP_COUNT - 1,
  });
  if (!open || typeof document === "undefined") return null;

  const update = <K extends keyof GexMapStarSettings>(key: K, value: GexMapStarSettings[K]) => onChange({ ...settings, [key]: value });
  const paletteScale = gexMapSignedScale(palette);
  const applySlotColor = (hex: string) => {
    if (editSlot.side === "star") {
      onPaletteChange({ ...palette, useThemeColors: false, star: hex });
      return;
    }
    const ramp = [...paletteScale];
    ramp[editSlot.index] = hex;
    // Keep the legacy strong tones in sync so preview bars and preset
    // detection stay coherent with the edited scale.
    onPaletteChange({
      ...palette,
      useThemeColors: false,
      scaleStops: ramp,
    });
  };
  const handleDragBar = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    applySlotColor(gexMapDragBarColor((event.clientX - rect.left) / rect.width));
  };
  const selectedSlotColor = editSlot.side === "star" ? palette.star : paletteScale[editSlot.index];
  const scaleSlotLabel = (index: number) => (index < 5 ? `-${(5 - index) * 20}` : `+${(index - 4) * 20}`);
  const rowClass = "grid grid-cols-[minmax(0,1fr)_160px] items-center gap-4 border-b border-border/60 py-3";
  const content = (<section className={embedded ? "w-full rounded-xl border border-border bg-panel" : "max-h-[80vh] w-full max-w-[620px] overflow-y-auto border border-border bg-panel shadow-[0_24px_90px_rgba(0,0,0,0.65)]"} onPointerDown={(event) => event.stopPropagation()}>
        <header className="sticky top-0 z-10 flex h-11 items-center border-b border-border bg-panel px-4">
          <div>
            <div className="text-[11px] font-semibold text-foreground">{viewMode.toUpperCase()} VIEW SETTINGS</div>
            <div className="text-[8px] uppercase tracking-[0.12em] text-muted">Applied to every GEX Map panel</div>
          </div>
          <button type="button" onClick={onClose} className="ml-auto flex h-7 w-7 items-center justify-center border border-border text-muted hover:text-foreground" aria-label="Close Star view settings"><X className="h-3.5 w-3.5" /></button>
        </header>
        <div className="px-4 pb-4">
          <div className={rowClass}>
            <span><span className="block text-[10px] text-foreground">View</span><span className="text-[8px] text-muted">Full = every strike raw · Ninja = structural nodes · Star = only the Star node</span></span>
            <div className="flex h-7 items-center rounded-[3px] border border-border/70 bg-background/35 p-0.5" role="group" aria-label="GEX Map view">
              {([["full", "Full"], ["ninja", "Ninja"], ["star", "Star"]] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={viewMode === mode}
                  onClick={() => onViewModeChange(mode)}
                  className={`flex h-5 flex-1 items-center justify-center rounded-[2px] px-2 text-[9px] font-semibold uppercase leading-none tracking-[0.075em] ${viewMode === mode ? "bg-surface text-primary" : "text-muted hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={rowClass}>
            <span><span className="block text-[10px] text-foreground">Values</span><span className="text-[8px] text-muted">The numbers beside each strike — colours stay identical</span></span>
            <div className="flex h-7 items-center rounded-[3px] border border-border/70 bg-background/35 p-0.5" role="group" aria-label="GEX Map value mode">
              {([["signed", "Signed"], ["star-percent", "% of Star"]] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={(settings.valueMode ?? "signed") === mode}
                  onClick={() => update("valueMode", mode)}
                  className={`flex h-5 flex-1 items-center justify-center rounded-[2px] px-2 text-[9px] font-semibold uppercase leading-none tracking-[0.075em] ${(settings.valueMode ?? "signed") === mode ? "bg-surface text-primary" : "text-muted hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {viewMode !== "full" ? (
            <>
              <label className={rowClass}>
                <span><span className="block text-[10px] text-foreground">Dimmed-row intensity</span><span className="text-[8px] text-muted">{Math.round(settings.dimOpacity * 100)}%</span></span>
                <input type="range" min="0.02" max="0.3" step="0.01" value={settings.dimOpacity} onChange={(event) => update("dimOpacity", Number(event.target.value))} className="w-full accent-[var(--primary)]" />
              </label>
              {([
                ["showRawValues", "Show raw exposure values"],
                ["animateChanges", "Animate live changes"],
              ] as const).map(([key, label]) => (
                <label key={key} className={rowClass}>
                  <span className="text-[10px] text-foreground">{label}</span>
                  <input type="checkbox" checked={settings[key]} onChange={(event) => update(key, event.target.checked)} className="ml-auto h-4 w-4 accent-[var(--primary)]" />
                </label>
              ))}
            </>
          ) : null}
          {viewMode === "ninja" ? (
            <>
              <div className="pt-4 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">Ninja node selection</div>
              <label className={rowClass}>
                <span><span className="block text-[10px] text-foreground">Highlighted nodes</span><span className="text-[8px] text-muted">Unique structural strikes per panel</span></span>
                <input type="range" min="2" max="8" step="1" value={settings.highlightedNodes} onChange={(event) => update("highlightedNodes", Number(event.target.value))} className="w-full accent-[var(--primary)]" />
              </label>
              <label className={rowClass}>
                <span><span className="block text-[10px] text-foreground">Selection strategy</span><span className="text-[8px] text-muted">Changes the deterministic node ranking</span></span>
                <GexMapDropdown
                  ariaLabel="Structural node selection strategy"
                  value={settings.selectionStrategy}
                  options={[
                    { value: "structural", label: "Structural", detail: "Balanced structural ranking" },
                    { value: "magnitude", label: "Magnitude", detail: "Largest absolute exposure first" },
                    { value: "velocity", label: "Velocity", detail: "Fastest-changing nodes first" },
                  ]}
                  menuLabel="Selection strategy"
                  menuWidth={230}
                  onChange={(selectionStrategy) => update("selectionStrategy", selectionStrategy)}
                />
              </label>
              {([[
                "showRoleLabels", "Show role labels",
              ], [
                "showAirPocketLabels", "Show air-pocket labels",
              ]] as const).map(([key, label]) => (
                <label key={key} className={rowClass}>
                  <span className="text-[10px] text-foreground">{label}</span>
                  <input type="checkbox" checked={settings[key]} onChange={(event) => update(key, event.target.checked)} className="ml-auto h-4 w-4 accent-[var(--primary)]" />
                </label>
              ))}
              <div className={rowClass}>
                <span><span className="block text-[10px] text-foreground">Minimum map control</span><span className="text-[8px] text-muted">Auto adapts to strike density</span></span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => update("minimumControlPct", settings.minimumControlPct === null ? 0.5 : null)} className={`h-7 border px-2 text-[8px] ${settings.minimumControlPct === null ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"}`}>{settings.minimumControlPct === null ? "AUTO" : "MANUAL"}</button>
                  {settings.minimumControlPct !== null ? <input type="number" min="0" max="25" step="0.1" value={settings.minimumControlPct} onChange={(event) => update("minimumControlPct", Number(event.target.value))} className="h-7 min-w-0 flex-1 border border-border bg-surface px-2 text-[9px] text-foreground" /> : null}
                </div>
              </div>
              <div className="pt-4 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">Air-pocket calculation</div>
              <label className={rowClass}>
                <span className="text-[10px] text-foreground">Row control threshold</span>
                <input type="number" min="0" max="20" step="0.05" value={settings.airPocketRowThresholdPct} onChange={(event) => update("airPocketRowThresholdPct", Number(event.target.value))} className="h-8 border border-border bg-surface px-2 text-[9px] text-foreground" />
              </label>
              <label className={rowClass}>
                <span className="text-[10px] text-foreground">Combined pocket threshold</span>
                <input type="number" min="0" max="50" step="0.1" value={settings.airPocketCombinedThresholdPct} onChange={(event) => update("airPocketCombinedThresholdPct", Number(event.target.value))} className="h-8 border border-border bg-surface px-2 text-[9px] text-foreground" />
              </label>
              <label className={rowClass}>
                <span><span className="block text-[10px] text-foreground">Spot-proximity weighting</span><span className="text-[8px] text-muted">{Math.round(settings.proximityWeight * 100)}%</span></span>
                <input type="range" min="0" max="0.3" step="0.01" value={settings.proximityWeight} onChange={(event) => update("proximityWeight", Number(event.target.value))} className="w-full accent-[var(--primary)]" />
              </label>
            </>
          ) : null}
          <div className="pt-4 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">Colours</div>
          <div className="border-b border-border/60 py-3">
            <span><span className="block text-[10px] text-foreground">Gradient palettes</span><span className="text-[8px] text-muted">One click recolours the whole map</span></span>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {GEX_MAP_PALETTE_PRESETS.map((preset) => {
                const presetScale = preset.scale ?? buildGexMapSignedScale(preset.negative, preset.positive);
                const presetPalette: GexMapPalette = {
                  useThemeColors: false,
                  positive: preset.positive,
                  positiveSoft: preset.positiveSoft,
                  negative: preset.negative,
                  negativeSoft: preset.negativeSoft,
                  star: preset.star,
                  scaleStops: [...presetScale],
                };
                const active = gexMapPalettesEqual(palette, presetPalette);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.label}
                    aria-label={`${preset.label} palette`}
                    aria-pressed={active}
                    onClick={() => onPaletteChange(presetPalette)}
                    className={`relative h-7 w-9 overflow-hidden rounded-[4px] border transition-transform hover:scale-110 ${
                      active ? "border-primary shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_45%,transparent)]" : "border-border"
                    }`}
                    style={{ background: `linear-gradient(90deg, ${presetScale.join(", ")})` }}
                  >
                    <span
                      className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full border border-black/30"
                      style={{ background: preset.star }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <label className={rowClass}>
            <span><span className="block text-[10px] text-foreground">Use theme colours</span><span className="text-[8px] text-muted">Follow the overall KwantDesk theme</span></span>
            <input
              type="checkbox"
              checked={palette.useThemeColors}
              onChange={(event) => onPaletteChange({ ...palette, useThemeColors: event.target.checked })}
              className="ml-auto h-4 w-4 accent-[var(--primary)]"
            />
          </label>
          {!palette.useThemeColors ? (
            <div className="border-b border-border/60 py-3">
              <span className="block text-[10px] text-foreground">Signed-exposure scale · extreme negative → extreme positive</span>
              <span className="text-[8px] text-muted">One ten-colour gradient: slot one paints the biggest negative (darkest), the middle is average noise, slot ten the biggest positive (lightest). Tap a slot, then drag the bar — the map recolours live.</span>
              <div className="mt-2.5">
                <div className="grid grid-cols-10 gap-1">
                  {paletteScale.map((color, index) => {
                    const selected = editSlot.side === "scale" && editSlot.index === index;
                    return (
                      <button
                        key={index}
                        type="button"
                        title={`${scaleSlotLabel(index)}% signed-exposure slot`}
                        aria-label={`Signed exposure ${scaleSlotLabel(index)}% colour`}
                        aria-pressed={selected}
                        onClick={() => setEditSlot({ side: "scale", index })}
                        className={`relative h-7 rounded-[3px] border transition-transform hover:scale-110 ${
                          selected
                            ? "border-primary shadow-[0_0_8px_color-mix(in_srgb,var(--primary)_45%,transparent)]"
                            : "border-border/70"
                        }`}
                        style={{ background: color }}
                      >
                        <span
                          className="absolute inset-x-0 bottom-0 text-center font-mono text-[6px] leading-[9px]"
                          style={{ color: "#FFFFFF", textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}
                        >
                          {scaleSlotLabel(index)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-2.5">
                <span className="text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Star node</span>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Star node colour"
                    aria-pressed={editSlot.side === "star"}
                    onClick={() => setEditSlot({ side: "star", index: 0 })}
                    className={`h-7 w-10 rounded-[3px] border transition-transform hover:scale-110 ${
                      editSlot.side === "star"
                        ? "border-primary shadow-[0_0_8px_color-mix(in_srgb,var(--primary)_45%,transparent)]"
                        : "border-border/70"
                    }`}
                    style={{ background: palette.star }}
                  />
                  <span className="font-mono text-[8px] uppercase text-muted">{palette.star}</span>
                </div>
              </div>
              <div className="mt-3">
                <div
                  role="slider"
                  aria-label="Colour drag bar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="relative h-6 w-full cursor-ew-resize touch-none rounded-[4px] border border-border"
                  style={{ background: GEX_MAP_DRAG_BAR_TRACK }}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    handleDragBar(event);
                  }}
                  onPointerMove={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) handleDragBar(event);
                  }}
                />
                <div className="mt-1 flex items-center justify-between text-[8px] text-muted">
                  <span>Drag left–right to recolour the selected slot</span>
                  <span className="flex items-center gap-1.5 font-mono uppercase">
                    <span className="inline-block h-3 w-3 rounded-[2px] border border-border/70" style={{ background: selectedSlotColor }} />
                    {selectedSlotColor}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
          <button type="button" onClick={() => onChange({ ...RECOMMENDED_GEX_MAP_STAR_SETTINGS })} className="mt-4 h-8 border border-primary/40 px-3 text-[9px] font-semibold text-primary hover:bg-primary/10">RESET RECOMMENDED DEFAULTS</button>
        </div>
        <footer className="sticky bottom-0 z-10 flex h-12 items-center justify-between gap-3 border-t border-border bg-panel px-4">
          <span className="text-[8px] text-muted">
            {paletteDirty ? "Colour changes preview live — Save to keep them." : "Saved colours stay until you relink the theme."}
          </span>
          <button
            type="button"
            onClick={onPaletteSave}
            disabled={!paletteDirty}
            className={`h-8 border px-4 text-[9px] font-semibold transition ${
              paletteDirty
                ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                : "border-border text-muted"
            }`}
          >
            SAVE
          </button>
        </footer>
      </section>);
  if (embedded) return content;
  return createPortal(<div
      className="fixed inset-0 z-[270] flex items-start justify-center bg-black/20 px-4 pt-[10vh]"
      onPointerDown={(event) => {
        // Portaled dropdown menus live outside this overlay's DOM subtree;
        // choosing an option must not close the whole settings dialog.
        if ((event.target as HTMLElement).closest?.("[data-gex-map-dropdown-menu]")) return;
        onClose();
      }}
    >
      {content}
    </div>,document.body);
}
