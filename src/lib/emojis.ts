export const DEFAULT_FREQUENT_EMOJIS = ["👍", "🔥", "😂", "❤️", "👀", "📈", "🎯", "✅"] as const;

export const CHAT_EMOJIS = [
  "👍", "🔥", "😂", "❤️", "👀", "📈", "📉", "🎯", "✅", "⚡",
  "🧠", "💎", "🚀", "🤝", "🙏", "😅", "🤔", "😮", "🥳", "🫡",
  "😀", "😃", "😄", "😁", "🤣", "😉", "😊", "😎", "🤩", "🥰",
  "😍", "😘", "😜", "🤪", "🧐", "😐", "🙄", "😬", "😔", "😭",
  "😤", "😡", "🤬", "😱", "🥵", "🥶", "💪", "👏", "🙌", "🤞",
  "👌", "👊", "✊", "🫶", "💯", "💥", "💫", "✨", "🌟", "💡",
  "🔔", "💰", "💸", "💵", "🏆", "🥇", "🏅", "👑", "🦅", "🦁",
  "🐻", "🐂", "🐍", "🦈", "🌙", "☀️", "⛅", "🌧️", "❄️", "🌊",
  "☕", "🍺", "🍕", "🎉", "🎁", "🎵", "🎮", "⚽", "🏀", "🏎️",
  "✈️", "🚨", "⚠️", "🚫", "❗", "❓", "💬", "📌", "🔒", "🔓",
] as const;

export type EmojiUsage = Record<string, number>;

export function rankedEmojis(usage: EmojiUsage, limit = 8) {
  const defaults = new Map<string, number>(
    DEFAULT_FREQUENT_EMOJIS.map((emoji, index) => [emoji, DEFAULT_FREQUENT_EMOJIS.length - index]),
  );
  return Array.from(new Set([...Object.keys(usage), ...DEFAULT_FREQUENT_EMOJIS]))
    .sort((left, right) => {
      const usageDifference = (usage[right] ?? 0) - (usage[left] ?? 0);
      if (usageDifference) return usageDifference;
      return (defaults.get(right) ?? 0) - (defaults.get(left) ?? 0);
    })
    .slice(0, limit);
}
