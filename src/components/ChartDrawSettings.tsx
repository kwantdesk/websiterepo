"use client";

import { useEffect, useRef, useState } from "react";
import ChartColorField from "@/components/ChartColorField";
import KwantSelect from "@/components/ui/KwantSelect";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  DRAW_TOOL_SPECS,
  HORIZONTAL_EXTENSION_TOOLS,
  resolveDrawColor,
  type DrawHorizontalExtension,
  type DrawLineStyle,
  type Drawing,
} from "@/lib/chartDrawTools";
import { deleteDrawTemplate, loadDrawTemplates, saveDrawTemplate, type DrawTemplateStore } from "@/lib/chartDrawTemplates";

// Tabbed settings dialog for a charting drawing — Style, Text, Coordinates and
// Visibility — with save/load style templates per tool type. Clean-room UI; the
// fields are the standard appearance controls every charting tool exposes.
const SHAPE_TOOLS = ["rectangle", "rotatedRectangle", "ellipse", "circle", "triangleShape", "gannBox", "datePriceRange", "longPosition", "shortPosition"];
const TEXT_TOOLS = ["text", "note", "callout", "signpost", "priceLabel", "flagMark"];
const PROFILE_TOOLS = ["fixedRangeVolumeProfile", "anchoredVolumeProfile"];
const POSITION_TOOLS = ["longPosition", "shortPosition"];

type Props = {
  drawing: Drawing | null;
  onChange: (drawing: Drawing) => void;
  onClose: () => void;
  /** Theme bullish candle, so the swatch shows what is actually painted. */
  themeColor?: string;
  /** Theme bearish candle, for the position tool's risk zone swatch. */
  themeBearColor?: string;
};

export default function ChartDrawSettings({
  drawing, onChange, onClose, themeColor, themeBearColor,
}: Props) {
  const [tab, setTab] = useState<"style" | "text" | "coordinates" | "visibility">("style");
  const [templates, setTemplates] = useState<DrawTemplateStore>({});
  const [templateName, setTemplateName] = useState("");
  const openedIdRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Reset the tab and reload templates ONLY when a different drawing is opened
  // — not on every edit/chart re-render (which was resetting the active tab and
  // making tab switching and adjustments feel broken).
  const drawingId = drawing?.id ?? null;
  useEffect(() => {
    if (!drawingId) { openedIdRef.current = null; return; }
    if (openedIdRef.current === drawingId) return;
    openedIdRef.current = drawingId;
    setTab("style");
    setTemplates(loadDrawTemplates());
  }, [drawingId]);

  useEffect(() => {
    if (!drawingId) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onCloseRef.current(); };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [drawingId]);

  if (!drawing || typeof document === "undefined") return null;
  const spec = DRAW_TOOL_SPECS[drawing.tool];
  const isShape = SHAPE_TOOLS.includes(drawing.tool);
  const isText = TEXT_TOOLS.includes(drawing.tool);
  const isEmoji = drawing.tool === "emoji";
  const isProfile = PROFILE_TOOLS.includes(drawing.tool);
  const isAnchoredVwap = drawing.tool === "anchoredVwap";
  const isPosition = POSITION_TOOLS.includes(drawing.tool);
  const supportsHorizontalExtension = HORIZONTAL_EXTENSION_TOOLS.has(drawing.tool);
  const toolTemplates = templates[drawing.tool] ?? {};

  const patchStyle = (next: Partial<Drawing["style"]>) => onChange({ ...drawing, style: { ...drawing.style, ...next } });
  const patchPoint = (index: number, price: number) =>
    onChange({ ...drawing, points: drawing.points.map((p, i) => (i === index ? { ...p, price } : p)) });

  const tabs: { key: typeof tab; label: string; show: boolean }[] = [
    { key: "style", label: "Style", show: true },
    { key: "text", label: isEmoji ? "Emoji" : "Text", show: isText || isEmoji },
    { key: "coordinates", label: "Coordinates", show: true },
    { key: "visibility", label: "Visibility", show: true },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[290] flex items-start justify-center bg-black/30 px-4 pt-[12vh]" onPointerDown={onClose}>
      <section className="w-full max-w-[420px] overflow-hidden rounded-xl border border-border bg-panel shadow-[0_24px_90px_rgba(0,0,0,0.6)]" onPointerDown={(event) => event.stopPropagation()}>
        <header className="flex h-11 items-center gap-3 border-b border-border px-4">
          <div className="text-[12px] font-semibold text-foreground">{spec.label}</div>
          <button type="button" onClick={onClose} className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-foreground" aria-label="Close">
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="flex border-b border-border px-2">
          {tabs.filter((t) => t.show).map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`h-9 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${tab === t.key ? "text-primary shadow-[inset_0_-2px_0_var(--primary)]" : "text-muted hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto p-4">
          {tab === "style" ? (
            <>
              {isEmoji ? (
                <Row label={`Size · ${Math.round(drawing.style.fontSize ?? 36)}px`}>
                  <input type="range" min={16} max={160} step={1} value={drawing.style.fontSize ?? 36} onChange={(event) => patchStyle({ fontSize: Number(event.target.value) })} className="w-48 accent-primary" />
                </Row>
              ) : (
                <>
                  <Row label="Colour"><ChartColorField ariaLabel="Drawing colour" value={resolveDrawColor(drawing.style, themeColor)} onChange={(hex) => patchStyle({ color: hex, useThemeColor: false })} /></Row>
                  <Row label="Line width"><Select value={String(drawing.style.width)} onChange={(v) => patchStyle({ width: Number(v) })} options={[["0.5", "0.5px"], ["1", "1px"], ["2", "2px"], ["3", "3px"], ["4", "4px"]]} /></Row>
                  <Row label="Line style"><Select value={drawing.style.lineStyle} onChange={(v) => patchStyle({ lineStyle: v as DrawLineStyle })} options={[["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"]]} /></Row>
                </>
              )}
              {isShape ? (
                <Row label="Fill opacity">
                  <input type="range" min={0} max={0.6} step={0.02} value={drawing.style.fillOpacity} onChange={(e) => patchStyle({ fillOpacity: Number(e.target.value) })} className="w-40 accent-primary" />
                </Row>
              ) : null}
              {supportsHorizontalExtension ? (
                <Row label="Extend">
                  <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-border bg-background" role="group" aria-label="Horizontal extension">
                    {([
                      ["none", "None"],
                      ["left", "Left"],
                      ["right", "Right"],
                      ["both", "Both"],
                    ] as const).map(([value, label]) => {
                      const active = (drawing.style.horizontalExtension ?? "none") === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={active}
                          onClick={() => patchStyle({ horizontalExtension: value as DrawHorizontalExtension })}
                          className={`h-8 border-l border-border px-2 text-[10px] font-semibold first:border-l-0 ${active ? "bg-primary text-on-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </Row>
              ) : null}
              {!isEmoji ? <Row label="Show labels"><input type="checkbox" checked={drawing.style.showLabels} onChange={(e) => patchStyle({ showLabels: e.target.checked })} className="h-4 w-4 accent-primary" /></Row> : null}

              {isPosition ? (
                <div className="space-y-3 border-t border-border pt-3">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-muted">Profit and loss zones</div>
                  <Row label="Profit">
                    <ChartColorField
                      ariaLabel="Profit zone colour"
                      value={drawing.style.profitColor ?? themeColor ?? "#089981"}
                      onChange={(hex) => patchStyle({ profitColor: hex })}
                    />
                  </Row>
                  <Row label="Loss">
                    <ChartColorField
                      ariaLabel="Loss zone colour"
                      value={drawing.style.lossColor ?? themeBearColor ?? "#F23645"}
                      onChange={(hex) => patchStyle({ lossColor: hex })}
                    />
                  </Row>
                  {drawing.style.profitColor || drawing.style.lossColor ? (
                    <button
                      type="button"
                      onClick={() => patchStyle({ profitColor: undefined, lossColor: undefined })}
                      className="h-8 rounded-lg border border-border px-3 text-[11px] text-muted hover:text-foreground"
                    >
                      Follow theme
                    </button>
                  ) : null}
                </div>
              ) : null}

              {isProfile ? (
                <div className="space-y-3 border-t border-border pt-3">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-muted">Profile</div>
                  <Row label={`Rows · ${drawing.style.profileRows ?? 80}`}>
                    <input type="range" min={20} max={200} step={5} value={drawing.style.profileRows ?? 80} onChange={(e) => patchStyle({ profileRows: Number(e.target.value) })} className="w-40 accent-primary" />
                  </Row>
                  <Row label={`Price grouping · ${drawing.style.profileGroupTicks ?? 4} ticks`}>
                    <input type="range" min={1} max={40} step={1} value={drawing.style.profileGroupTicks ?? 4} onChange={(e) => patchStyle({ profileGroupTicks: Number(e.target.value) })} className="w-40 accent-primary" />
                  </Row>
                  <Row label={`Minimum trade · ${drawing.style.profileMinTradeVolume ?? 0}`}>
                    <input type="range" min={0} max={500} step={1} value={drawing.style.profileMinTradeVolume ?? 0} onChange={(e) => patchStyle({ profileMinTradeVolume: Number(e.target.value) })} className="w-40 accent-primary" />
                  </Row>
                  <Row label={`Maximum trade · ${drawing.style.profileMaxTradeVolume ?? 0}${(drawing.style.profileMaxTradeVolume ?? 0) === 0 ? " (off)" : ""}`}>
                    <input type="range" min={0} max={5000} step={10} value={drawing.style.profileMaxTradeVolume ?? 0} onChange={(e) => patchStyle({ profileMaxTradeVolume: Number(e.target.value) })} className="w-40 accent-primary" />
                  </Row>
                  <Row label={`Value area · ${drawing.style.valueAreaPercent ?? 68}%`}>
                    <input type="range" min={50} max={95} step={1} value={drawing.style.valueAreaPercent ?? 68} onChange={(e) => patchStyle({ valueAreaPercent: Number(e.target.value) })} className="w-40 accent-primary" />
                  </Row>
                  <Row label={`Profile width · ${drawing.style.profileWidthPercent ?? 32}%`}>
                    <input type="range" min={10} max={80} step={2} value={drawing.style.profileWidthPercent ?? 32} onChange={(e) => patchStyle({ profileWidthPercent: Number(e.target.value) })} className="w-40 accent-primary" />
                  </Row>
                  <Row label="Show POC line"><input type="checkbox" checked={drawing.style.showPoc !== false} onChange={(e) => patchStyle({ showPoc: e.target.checked })} className="h-4 w-4 accent-primary" /></Row>
                  <Row label="Show VAH / VAL lines"><input type="checkbox" checked={drawing.style.showValueAreaLines !== false} onChange={(e) => patchStyle({ showValueAreaLines: e.target.checked })} className="h-4 w-4 accent-primary" /></Row>
                  <Row label="POC line colour"><ChartColorField ariaLabel="Point of control line colour" value={drawing.style.pocColor ?? resolveDrawColor(drawing.style, themeColor)} onChange={(hex) => patchStyle({ pocColor: hex })} /></Row>
                  <Row label="VAH / VAL colour"><ChartColorField ariaLabel="Value area line colour" value={drawing.style.valueAreaColor ?? resolveDrawColor(drawing.style, themeColor)} onChange={(hex) => patchStyle({ valueAreaColor: hex })} /></Row>
                  <Row label={`POC line width · ${drawing.style.pocLineWidth ?? drawing.style.width}px`}><input type="range" min={0.5} max={4} step={0.5} value={drawing.style.pocLineWidth ?? drawing.style.width} onChange={(e) => patchStyle({ pocLineWidth: Number(e.target.value) })} className="w-40 accent-primary" /></Row>
                  <Row label={`VAH / VAL width · ${drawing.style.valueAreaLineWidth ?? drawing.style.width}px`}><input type="range" min={0.5} max={4} step={0.5} value={drawing.style.valueAreaLineWidth ?? drawing.style.width} onChange={(e) => patchStyle({ valueAreaLineWidth: Number(e.target.value) })} className="w-40 accent-primary" /></Row>
                  <Row label="Outside value area"><ChartColorField ariaLabel="Outside value area colour" value={drawing.style.outsideColor ?? "#787B86"} onChange={(hex) => patchStyle({ outsideColor: hex })} /></Row>
                </div>
              ) : null}

              {isAnchoredVwap ? (
                <div className="space-y-3 border-t border-border pt-3">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-muted">Anchored VWAP</div>
                  <Row label="Price source"><Select value={drawing.style.vwapSource ?? "hlc3"} onChange={(value) => patchStyle({ vwapSource: value as "hlc3" | "hl2" | "ohlc4" | "close" })} options={[["hlc3", "HLC3"], ["hl2", "HL2"], ["ohlc4", "OHLC4"], ["close", "Close"]]} /></Row>
                  {([1, 2, 3] as const).map((band) => {
                    const enabledKey = `vwapBand${band}Enabled` as const;
                    const valueKey = `vwapBand${band}` as const;
                    const enabled = drawing.style[enabledKey] ?? band <= 2;
                    const value = Number(drawing.style[valueKey] ?? band);
                    return <div key={band} className="space-y-2 rounded-lg border border-border bg-background/50 p-2.5">
                      <Row label={`Band ${band}`}><input type="checkbox" checked={enabled} onChange={(event) => patchStyle({ [enabledKey]: event.target.checked })} className="h-4 w-4 accent-primary" /></Row>
                      <Row label={`${value.toFixed(1)}σ`}><input type="range" min={0.1} max={5} step={0.1} value={value} disabled={!enabled} onChange={(event) => patchStyle({ [valueKey]: Number(event.target.value) })} className="w-40 accent-primary disabled:opacity-40" /></Row>
                    </div>;
                  })}
                  <Row label="Upper bands"><ChartColorField ariaLabel="Anchored VWAP upper band colour" value={drawing.style.vwapUpperColor ?? resolveDrawColor(drawing.style, themeColor)} onChange={(hex) => patchStyle({ vwapUpperColor: hex })} /></Row>
                  <Row label="Lower bands"><ChartColorField ariaLabel="Anchored VWAP lower band colour" value={drawing.style.vwapLowerColor ?? resolveDrawColor(drawing.style, themeColor)} onChange={(hex) => patchStyle({ vwapLowerColor: hex })} /></Row>
                  <Row label="Fill first envelope"><input type="checkbox" checked={drawing.style.vwapBandFill !== false} onChange={(event) => patchStyle({ vwapBandFill: event.target.checked })} className="h-4 w-4 accent-primary" /></Row>
                  <Row label={`Fill opacity · ${Math.round((drawing.style.vwapBandFillOpacity ?? 0.08) * 100)}%`}><input type="range" min={0} max={0.35} step={0.01} value={drawing.style.vwapBandFillOpacity ?? 0.08} onChange={(event) => patchStyle({ vwapBandFillOpacity: Number(event.target.value) })} className="w-40 accent-primary" /></Row>
                </div>
              ) : null}

              <div className="border-t border-border pt-3">
                <div className="mb-1.5 text-[10px] uppercase tracking-[0.1em] text-muted">Templates</div>
                {Object.keys(toolTemplates).length ? (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {Object.keys(toolTemplates).map((name) => (
                      <span key={name} className="flex items-center gap-1 rounded-md border border-border bg-surface/60 px-2 py-1 text-[10px]">
                        <button type="button" className="text-foreground hover:text-primary" onClick={() => onChange({ ...drawing, style: { ...toolTemplates[name] } })}>{name}</button>
                        <button type="button" className="text-muted hover:text-danger" aria-label={`Delete ${name}`} onClick={() => setTemplates(deleteDrawTemplate(drawing.tool, name))}>×</button>
                      </span>
                    ))}
                  </div>
                ) : <div className="mb-2 text-[10px] text-muted">No saved templates for {spec.label}.</div>}
                <div className="flex gap-2">
                  <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name" className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-[11px] outline-none focus:border-primary/40" />
                  <button type="button" disabled={!templateName.trim()} onClick={() => { setTemplates(saveDrawTemplate(drawing.tool, templateName.trim(), drawing.style)); setTemplateName(""); }} className={`h-8 rounded-lg px-3 text-[11px] font-semibold ${templateName.trim() ? "bg-primary text-on-primary" : "bg-surface text-muted"}`}>Save</button>
                </div>
              </div>
            </>
          ) : null}

          {tab === "text" ? (
            <>
              <label className="block">
                <span className="mb-1 block text-[11px] text-muted">{isEmoji ? "Emoji" : "Text"}</span>
                {isEmoji
                  ? <input value={drawing.text ?? ""} onChange={(event) => onChange({ ...drawing, text: event.target.value })} className="h-12 w-full rounded-lg border border-border bg-background px-3 text-center text-2xl outline-none focus:border-primary/40" />
                  : <textarea value={drawing.text ?? ""} onChange={(e) => onChange({ ...drawing, text: e.target.value })} rows={3} className="w-full rounded-lg border border-border bg-background p-2 text-[12px] outline-none focus:border-primary/40" />}
              </label>
              {isEmoji
                ? <Row label={`Size · ${Math.round(drawing.style.fontSize ?? 36)}px`}><input type="range" min={16} max={160} step={1} value={drawing.style.fontSize ?? 36} onChange={(event) => patchStyle({ fontSize: Number(event.target.value) })} className="w-48 accent-primary" /></Row>
                : <Row label="Font size"><Select value={String(drawing.style.fontSize)} onChange={(v) => patchStyle({ fontSize: Number(v) })} options={[["10", "10"], ["11", "11"], ["12", "12"], ["13", "13"], ["14", "14"], ["16", "16"], ["18", "18"], ["22", "22"]]} /></Row>}
            </>
          ) : null}

          {tab === "coordinates" ? (
            <div className="space-y-2">
              {drawing.points.map((point, index) => (
                <Row key={index} label={`Point ${index + 1} price`}>
                  <input type="number" value={point.price} step="any" onChange={(e) => patchPoint(index, Number(e.target.value))} className="h-8 w-32 rounded-lg border border-border bg-background px-2 font-mono text-[12px] outline-none focus:border-primary/40" />
                </Row>
              ))}
              <p className="text-[10px] leading-4 text-muted">Time anchors follow the bars you placed; drag the handles on the chart to move them.</p>
            </div>
          ) : null}

          {tab === "visibility" ? (
            <Row label="Visible on chart"><input type="checkbox" checked={drawing.style.visible} onChange={(e) => patchStyle({ visible: e.target.checked })} className="h-4 w-4 accent-primary" /></Row>
          ) : null}
        </div>

        <footer className="flex justify-end border-t border-border px-4 py-2.5">
          <button type="button" onClick={onClose} className="rounded-lg bg-primary px-4 py-2 text-[12px] font-semibold text-on-primary">Done</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex items-center justify-between gap-4"><span className="text-[12px] text-foreground">{label}</span>{children}</label>;
}

// One helper backs every dropdown in this dialog, so routing it through the
// shared menu converts the whole panel at once — line width, line style, fill,
// label position and the profile controls.
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <KwantSelect
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-32 rounded-lg border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-primary/40"
    >
      {options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
    </KwantSelect>
  );
}
