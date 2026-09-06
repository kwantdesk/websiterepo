import emojiData from "emojibase-data/en/compact.json" with { type: "json" };

export const CHART_EMOJI_PAGE_SIZE = 120;
export const CHART_EMOJI_CATEGORIES = [
  "Smileys & emotion", "People & body", "Components", "Animals & nature",
  "Food & drink", "Travel & places", "Activities", "Objects", "Symbols", "Flags",
] as const;

type SourceEmoji = {
  unicode: string;
  label: string;
  group?: number;
  tags?: string[];
  skins?: SourceEmoji[];
};

export type ChartEmojiEntry = {
  emoji: string;
  name: string;
  group: number;
  variant: boolean;
  search: string;
};

// Existing drawings may omit optional emoji-presentation selectors.
export const chartEmojiIdentity = (value: string) => value.replace(/\uFE0F/g, "");

// Keep complete Unicode sequences, including ZWJ families, flags and mixed
// skin tones. Never generate combinations that Unicode does not define.
export const CHART_EMOJI_CATALOG: readonly ChartEmojiEntry[] = (emojiData as SourceEmoji[]).flatMap((base) =>
  [base, ...(base.skins ?? [])].map((entry, index) => ({
    emoji: entry.unicode,
    name: entry.label,
    group: entry.group ?? base.group ?? 2,
    variant: index > 0,
    search: chartEmojiIdentity(`${entry.unicode} ${entry.label} ${(base.tags ?? []).join(" ")}`).toLowerCase(),
  })),
);

export const CHART_QUICK_EMOJIS = ["🧲", "📍", "📈", "📉", "🎯", "🚀", "🔥", "💎", "🐂", "🐻", "⬆️", "⬇️", "➡️", "⬅️", "🟢", "🔴"];

export function filterChartEmojis(query: string, group = -1, includeSkinTones = true) {
  const terms = chartEmojiIdentity(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return CHART_EMOJI_CATALOG.filter((entry) =>
    (group < 0 || entry.group === group)
    && (includeSkinTones || !entry.variant)
    && terms.every((term) => entry.search.includes(term)),
  );
}

export function chartEmojiPage(entries: readonly ChartEmojiEntry[], requestedPage: number) {
  const pages = Math.max(1, Math.ceil(entries.length / CHART_EMOJI_PAGE_SIZE));
  const page = Math.max(0, Math.min(pages - 1, Math.floor(requestedPage) || 0));
  return { page, pages, entries: entries.slice(page * CHART_EMOJI_PAGE_SIZE, (page + 1) * CHART_EMOJI_PAGE_SIZE) };
}
