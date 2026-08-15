"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Bell, Copy, Eye, EyeOff, Lock, Search, Settings2, Trash2, Unlock, X } from "lucide-react";
import PrecisionIcon from "./PrecisionIcon";
import { getPrecisionTool } from "./registry";
import type { PrecisionStoreSnapshot } from "./types";

interface Props {
  snapshot: PrecisionStoreSnapshot;
  onClose: () => void;
  onSelect: (id: string) => void;
  onVisibility: (id: string) => void;
  onLock: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onLayer: (id: string, direction: "forward" | "backward") => void;
  onRename: (id: string, name: string) => void;
  onSettings: (id: string) => void;
  onAllVisible: (visible: boolean) => void;
  onAllLocked: (locked: boolean) => void;
  onClear: () => void;
}

type SortMode = "newest" | "oldest" | "tool";

export default function PrecisionObjectList({ snapshot, onClose, onSelect, onVisibility, onLock, onDuplicate, onDelete, onLayer, onRename, onSettings, onAllVisible, onAllLocked, onClear }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [editingId, setEditingId] = useState<string | null>(null);
  const objects = useMemo(() => snapshot.objects.filter((object) => `${object.name} ${getPrecisionTool(object.toolId).label}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => sort === "tool" ? a.toolId.localeCompare(b.toolId) || b.createdAt - a.createdAt : sort === "oldest" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt), [query, snapshot.objects, sort]);

  return <aside className="pointer-events-auto absolute bottom-3 left-[108px] top-[74px] z-[70] w-[330px] border border-[#32445b] bg-[#090f17]/98 shadow-[0_20px_60px_#000d] backdrop-blur-xl">
    <header className="flex h-10 items-center justify-between border-b border-[#28374a] px-3"><div className="font-mono text-[9px] font-bold uppercase tracking-[.14em] text-[#aebcd0]">Precision objects · {snapshot.objects.length}</div><button type="button" onClick={onClose}><X className="h-4 w-4 text-[#74869e] hover:text-white" /></button></header>
    <div className="border-b border-[#28374a] p-2">
      <div className="flex h-8 items-center border border-[#2d4056] bg-[#0a111b] px-2"><Search className="mr-2 h-3.5 w-3.5 text-[#64758b]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Precision objects" className="min-w-0 flex-1 bg-transparent font-mono text-[8px] text-[#c0cbd9] outline-none"/><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="bg-[#0a111b] font-mono text-[7px] uppercase text-[#7f91a8] outline-none"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="tool">Tool</option></select></div>
      <div className="mt-2 grid grid-cols-5 gap-1">{[
        ["Show", () => onAllVisible(true)], ["Hide", () => onAllVisible(false)], ["Lock", () => onAllLocked(true)], ["Unlock", () => onAllLocked(false)], ["Clear", onClear],
      ].map(([label, action]) => <button key={String(label)} type="button" onClick={action as () => void} className="h-7 border border-[#2c3d51] bg-[#0c151f] font-mono text-[7px] uppercase text-[#7f91a8] hover:border-[#4c6889] hover:text-[#abd0ff]">{label as string}</button>)}</div>
    </div>
    <div className="h-[calc(100%-104px)] overflow-y-auto p-1.5">
      {!objects.length ? <div className="m-2 border border-dashed border-[#2b3a4e] px-3 py-8 text-center font-mono text-[9px] text-[#66778e]">No matching Precision objects</div> : objects.map((object) => (
        <div key={object.id} className={`mb-1 flex items-center gap-1 border px-2 py-2 ${snapshot.selectedIds.includes(object.id) ? "border-[#68a8ff]/70 bg-[#17253a]" : "border-[#253448] bg-[#0c141f]"}`}>
          <button type="button" onClick={() => onSelect(object.id)} onDoubleClick={() => setEditingId(object.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left"><PrecisionIcon name={object.toolId} className="h-4 w-4 shrink-0 text-[#7dafff]"/>{editingId === object.id ? <input autoFocus defaultValue={object.name} onClick={(event) => event.stopPropagation()} onBlur={(event) => { onRename(object.id, event.target.value.trim() || getPrecisionTool(object.toolId).label); setEditingId(null); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setEditingId(null); }} className="h-6 min-w-0 flex-1 border border-[#4b6687] bg-[#09111a] px-1 font-mono text-[8px] text-[#d4deea] outline-none"/> : <span className="min-w-0 truncate font-mono text-[9px] font-semibold uppercase text-[#b5c1d1]">{object.name || getPrecisionTool(object.toolId).label}</span>}<span className="border border-[#31465e] px-1 font-mono text-[6px] text-[#7794b4]">TC{object.configSlot}</span>{object.alert?.enabled ? <Bell className="h-3 w-3 shrink-0 text-[#f0be62]"/> : null}</button>
          <button type="button" onClick={() => onVisibility(object.id)} title="Visibility">{object.visibility.visible ? <Eye className="h-3.5 w-3.5 text-[#7789a0]"/> : <EyeOff className="h-3.5 w-3.5 text-[#7789a0]"/>}</button>
          <button type="button" onClick={() => onLock(object.id)} title="Lock">{object.visibility.locked ? <Lock className="h-3.5 w-3.5 text-[#e0b45b]"/> : <Unlock className="h-3.5 w-3.5 text-[#7789a0]"/>}</button>
          <button type="button" onClick={() => onLayer(object.id, "forward")} title="Bring forward"><ArrowUp className="h-3.5 w-3.5 text-[#7789a0]"/></button>
          <button type="button" onClick={() => onLayer(object.id, "backward")} title="Send backward"><ArrowDown className="h-3.5 w-3.5 text-[#7789a0]"/></button>
          <button type="button" onClick={() => onSettings(object.id)} title="Settings"><Settings2 className="h-3.5 w-3.5 text-[#7789a0]"/></button>
          <button type="button" onClick={() => onDuplicate(object.id)} title="Duplicate"><Copy className="h-3.5 w-3.5 text-[#7789a0]"/></button>
          <button type="button" onClick={() => onDelete(object.id)} title="Delete"><Trash2 className="h-3.5 w-3.5 text-[#ff647f]"/></button>
        </div>
      ))}
    </div>
  </aside>;
}
