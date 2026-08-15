"use client";

import { ChevronLeft, ChevronRight, Download, Eye, EyeOff, FileUp, Layers3, Lock, Settings2, Trash2, Unlock, X } from "lucide-react";
import PrecisionIcon from "./PrecisionIcon";
import { getPrecisionTool, PRECISION_TOOL_GROUPS } from "./registry";
import type { PrecisionMode, PrecisionStoreSnapshot, PrecisionToolGroupId, PrecisionToolId } from "./types";

interface Props {
  snapshot: PrecisionStoreSnapshot;
  engaged: boolean;
  onMode: (mode: PrecisionMode) => void;
  onTool: (toolId: PrecisionToolId) => void;
  onGroup: (groupId: PrecisionToolGroupId | null) => void;
  onCollapse: () => void;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
  onObjects: () => void;
  onSettings: () => void;
  onImport: () => void;
  onExport: () => void;
  onClear: () => void;
  onDismiss: () => void;
}

const buttonBase = "grid h-9 w-9 place-items-center border border-transparent text-[#8090a6] transition-colors hover:border-[#354860] hover:bg-[#152131] hover:text-[#b8d6ff]";

export default function PrecisionRail({ snapshot, engaged, onMode, onTool, onGroup, onCollapse, onToggleHidden, onToggleLocked, onObjects, onSettings, onImport, onExport, onClear, onDismiss }: Props) {
  const { toolbar } = snapshot;
  if (toolbar.collapsed) {
    return (
      <div className="pointer-events-auto absolute left-[55px] top-[74px] z-[68] flex h-[220px] w-[14px] flex-col items-center border border-[#2d3d52] bg-[#0a1018]/98 shadow-[0_10px_32px_#0009]">
        <button type="button" onClick={onCollapse} className="mt-1 grid h-7 w-full place-items-center text-[#7aaeff]" title="Expand Precision Tools"><ChevronRight className="h-3 w-3" /></button>
        <span className="mt-3 [writing-mode:vertical-rl] font-mono text-[7px] font-semibold uppercase tracking-[0.22em] text-[#65758a]">Precision</span>
      </div>
    );
  }
  return (
    <div className="pointer-events-auto absolute left-[55px] top-[74px] z-[68] flex w-[46px] flex-col items-center border border-[#2d3d52] bg-[#090f17]/98 py-1 shadow-[0_16px_42px_#000a] backdrop-blur" data-precision-tools-rail>
      <div className="mb-1 flex h-6 w-full items-center justify-between border-b border-[#273547] px-1 text-[#6f8097]">
        <span className="font-mono text-[6px] font-bold tracking-[.15em]">PT</span>
        <button type="button" onClick={onDismiss} className="hover:text-[#b8d6ff]" title="Release chart input"><X className="h-2.5 w-2.5" /></button>
      </div>
      <div className="grid gap-[2px]">
        {(["select", "crosshair", "global-crosshair", "hand", "zoom-range"] as PrecisionMode[]).map((mode) => {
          const iconName = mode === "global-crosshair" ? "global" : mode === "zoom-range" ? "zoom" : mode;
          const active = engaged && toolbar.mode === mode;
          return <button key={mode} type="button" onClick={() => onMode(mode)} className={`${buttonBase} ${active ? "border-[#68a8ff]/70 bg-[#16263a] text-[#8fc1ff]" : ""}`} title={mode.replaceAll("-", " ")}><PrecisionIcon name={iconName as "select"} className="h-[17px] w-[17px]" /></button>;
        })}
        <button type="button" onClick={() => onMode("place")} className={`${buttonBase} ${engaged && toolbar.snapMode !== "off" ? "text-[#8fc1ff]" : ""}`} title={`Annotation snap: ${toolbar.snapMode}`}><PrecisionIcon name="snap" className="h-[17px] w-[17px]" /></button>
      </div>
      <div className="my-1 h-px w-8 bg-[#273547]" />
      <div className="grid gap-[2px]">
        {PRECISION_TOOL_GROUPS.filter((group) => toolbar.visibleGroups.includes(group.id)).map((group) => {
          const active = toolbar.activeGroup === group.id || group.toolIds.includes(toolbar.activeTool as PrecisionToolId);
          return (
            <div key={group.id} className="relative">
              <button type="button" onClick={() => onGroup(toolbar.activeGroup === group.id ? null : group.id)} className={`${buttonBase} ${active ? "border-[#68a8ff]/60 bg-[#132033] text-[#8fc1ff]" : ""}`} title={group.label}><PrecisionIcon name={group.id} className="h-[18px] w-[18px]" /></button>
              {toolbar.activeGroup === group.id ? (
                <div className="absolute left-[43px] top-0 z-[72] w-[236px] border border-[#34475e] bg-[#0a111b]/98 p-1.5 shadow-[0_18px_55px_#000c] backdrop-blur-xl">
                  <div className="mb-1 border-b border-[#273547] px-2 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[.15em] text-[#7f91a9]">{group.label}</div>
                  {group.toolIds.map((toolId) => { const tool = getPrecisionTool(toolId); return (
                    <button key={toolId} type="button" onClick={() => onTool(toolId)} className={`flex w-full items-center gap-2 border border-transparent px-2 py-2 text-left transition-colors hover:border-[#33475f] hover:bg-[#152131] ${toolbar.activeTool === toolId ? "bg-[#17253a] text-[#9ac8ff]" : "text-[#aab6c6]"}`}>
                      <span className="grid h-7 w-9 shrink-0 place-items-center border border-[#2e4157] bg-[#0d1723]"><PrecisionIcon name={toolId} className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1 font-mono text-[9px] font-semibold uppercase tracking-[.05em]">{tool.label}</span>
                      <span className="border border-[#344a64] px-1 py-0.5 font-mono text-[6px] text-[#7da9d9]">TC{toolbar.activeConfigSlots[toolId] ?? toolbar.activeConfigSlot}</span>
                      {tool.shortcut ? <kbd className="text-[7px] text-[#617188]">{tool.shortcut}</kbd> : null}
                    </button>
                  ); })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="my-1 h-px w-8 bg-[#273547]" />
      <div className="grid gap-[2px]">
        <button type="button" onClick={onToggleHidden} className={buttonBase} title={toolbar.hidden ? "Show Precision objects" : "Hide Precision objects"}>{toolbar.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
        <button type="button" onClick={onToggleLocked} className={buttonBase} title={toolbar.locked ? "Unlock Precision objects" : "Lock Precision objects"}>{toolbar.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}</button>
        <button type="button" onClick={onObjects} className={buttonBase} title="Precision object list"><Layers3 className="h-4 w-4" /></button>
        <button type="button" onClick={onImport} className={buttonBase} title="Import Precision objects"><FileUp className="h-4 w-4" /></button>
        <button type="button" onClick={onExport} className={buttonBase} title="Export Precision objects"><Download className="h-4 w-4" /></button>
        <button type="button" onClick={onSettings} className={buttonBase} title="Precision settings"><Settings2 className="h-4 w-4" /></button>
        <button type="button" onClick={onClear} className={`${buttonBase} hover:border-[#633143] hover:bg-[#2b121b] hover:text-[#ff708b]`} title="Clear Precision objects"><Trash2 className="h-4 w-4" /></button>
        <button type="button" onClick={onCollapse} className={buttonBase} title="Collapse Precision rail"><ChevronLeft className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
