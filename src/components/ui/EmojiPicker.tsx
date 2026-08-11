"use client";

import { CHAT_EMOJIS } from "@/lib/emojis";

export default function EmojiPicker({
  frequentEmojis,
  onSelect,
  className = "",
}: {
  frequentEmojis: string[];
  onSelect: (emoji: string) => void;
  className?: string;
}) {
  return (
    <div className={`w-64 overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl ${className}`}>
      <div className="border-b border-border px-3 py-2">
        <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">Frequently used</div>
        <div className="mt-2 grid grid-cols-8 gap-1">
          {frequentEmojis.map((emoji) => <button key={emoji} type="button" onClick={() => onSelect(emoji)} className="flex h-7 items-center justify-center rounded-lg text-[16px] hover:bg-surface">{emoji}</button>)}
        </div>
      </div>
      <div className="px-3 pt-2 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">All emojis</div>
      <div className="grid max-h-60 grid-cols-6 gap-1 overflow-y-auto overscroll-contain p-2 [scrollbar-color:var(--primary)_transparent] [scrollbar-width:thin]">
        {CHAT_EMOJIS.map((emoji, index) => <button key={`${emoji}-${index}`} type="button" onClick={() => onSelect(emoji)} className="flex h-9 items-center justify-center rounded-lg text-[19px] transition-colors hover:bg-surface">{emoji}</button>)}
      </div>
    </div>
  );
}

