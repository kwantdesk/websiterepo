"use client";

import { useMemo, useRef, useState } from "react";
import { CHART_EMOJI_CATALOG, CHART_EMOJI_CATEGORIES, chartEmojiIdentity, chartEmojiPage, filterChartEmojis } from "@/lib/chartEmojiCatalog";

const emojiFont = { fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' };

export default function ChartEmojiPicker({ emoji, quickEmojis, onSelect }: { emoji: string; quickEmojis: readonly string[]; onSelect: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState(-1);
  const [includeSkinTones, setIncludeSkinTones] = useState(true);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const matches = useMemo(() => filterChartEmojis(query, group, includeSkinTones), [query, group, includeSkinTones]);
  const visible = chartEmojiPage(matches, page);
  const resetScroll = () => { if (scrollRef.current) scrollRef.current.scrollTop = 0; };
  const resetPage = () => { setPage(0); resetScroll(); };
  const button = (value: string, name: string) => (
    <button key={value} type="button" title={name} aria-label={`Place ${name} on chart`} aria-pressed={chartEmojiIdentity(value) === chartEmojiIdentity(emoji)}
      onClick={() => onSelect(value)} style={emojiFont}
      className={`flex h-8 min-w-0 items-center justify-center rounded text-xl leading-none focus-visible:outline-2 focus-visible:outline-primary ${chartEmojiIdentity(value) === chartEmojiIdentity(emoji) ? "bg-primary/15 ring-1 ring-primary/50" : "hover:bg-surface"}`}>
      {value}
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-1 text-foreground" onKeyDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
      <div className="flex shrink-0 items-center justify-between text-[11px]">
        <span>Emojis <span className="text-muted">· {CHART_EMOJI_CATALOG.length.toLocaleString("en-US")}</span></span>
        <span style={emojiFont} className="text-xl" aria-label="Selected emoji">{emoji}</span>
      </div>
      <input type="search" aria-label="Search chart emojis" placeholder="Search emojis: magnet, rocket, bull…" value={query}
        onChange={(event) => { setQuery(event.target.value); resetPage(); }}
        className="h-8 w-full shrink-0 rounded border border-border bg-surface px-2 text-xs text-foreground outline-none focus:border-primary" />
      <select aria-label="Emoji category" value={group} onChange={(event) => { setGroup(Number(event.target.value)); resetPage(); }}
        className="h-8 w-full shrink-0 rounded border border-border bg-surface px-2 text-xs text-foreground">
        <option value={-1}>All categories</option>
        {CHART_EMOJI_CATEGORIES.map((name, index) => <option key={name} value={index}>{name}</option>)}
      </select>
      <label className="flex shrink-0 items-center gap-2 text-[11px] text-muted">
        <input type="checkbox" checked={includeSkinTones} onChange={(event) => { setIncludeSkinTones(event.target.checked); resetPage(); }} className="accent-primary" />
        Include skin-tone variations
      </label>
      {!query && group === -1 ? <div className="grid shrink-0 grid-cols-8 gap-1 border-b border-border pb-2" aria-label="Chart quick picks">
        {quickEmojis.map((value) => button(value, CHART_EMOJI_CATALOG.find((entry) => chartEmojiIdentity(entry.emoji) === chartEmojiIdentity(value))?.name ?? value))}
      </div> : null}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ scrollbarWidth: "thin" }} aria-label="Chart emojis">
        <div className="grid grid-cols-8 gap-1 p-1">
          {visible.entries.map((entry) => button(entry.emoji, entry.name))}
        </div>
        {!matches.length ? <p role="status" className="p-4 text-center text-xs text-muted">No matches. Try another name or category.</p> : null}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border pt-2 text-[11px]">
        <button type="button" disabled={visible.page === 0} onClick={() => { setPage(visible.page - 1); resetScroll(); }} className="rounded border border-border px-2 py-1 disabled:opacity-40 hover:enabled:bg-surface">Previous</button>
        <span aria-live="polite" className="text-muted">{visible.page + 1} / {visible.pages} · {matches.length} emojis</span>
        <button type="button" disabled={visible.page + 1 === visible.pages} onClick={() => { setPage(visible.page + 1); resetScroll(); }} className="rounded border border-border px-2 py-1 disabled:opacity-40 hover:enabled:bg-surface">Next</button>
      </div>
      <p className="shrink-0 text-[10px] leading-tight text-muted">Newer emojis depend on your device’s emoji font.</p>
    </div>
  );
}
