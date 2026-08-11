const SINGLE_EMOJI_PATTERN = /^(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?)*)$/u;

export function isSingleEmojiMessage(value: string) {
  return SINGLE_EMOJI_PATTERN.test(value.trim());
}

