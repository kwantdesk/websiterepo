export function emojiRotation(value: unknown): number {
  const angle = Number(value);
  return Number.isFinite(angle) ? ((angle % 360) + 360) % 360 : 0;
}

/** The corner handle rotates with the glyph, in screen pixels. */
export function emojiTransformHandle(x: number, y: number, size: number, rotation: unknown) {
  const angle = emojiRotation(rotation) * Math.PI / 180;
  const half = size / 2;
  return { x: x + half * (Math.cos(angle) - Math.sin(angle)),
    y: y + half * (Math.sin(angle) + Math.cos(angle)) };
}

/** Relative polar gesture: orbit to rotate, move radially to resize. */
export function transformEmojiFromDrag(size: number, rotation: unknown,
  start: { x: number; y: number }, current: { x: number; y: number }) {
  const radius = Math.hypot(start.x, start.y);
  const nextRadius = Math.hypot(current.x, current.y);
  if (![size, radius, nextRadius].every(Number.isFinite) || radius < 0.001 || nextRadius < 0.001) {
    return { fontSize: size, emojiRotation: emojiRotation(rotation) };
  }
  const delta = (Math.atan2(current.y, current.x) - Math.atan2(start.y, start.x)) * 180 / Math.PI;
  return { fontSize: Math.round(Math.max(16, Math.min(160, size * nextRadius / radius))),
    emojiRotation: emojiRotation(emojiRotation(rotation) + delta) };
}
