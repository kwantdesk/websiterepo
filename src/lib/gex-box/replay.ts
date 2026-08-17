export type TimestampedFrame = { timestamp: number };

export function normalizeReplayFrames<T extends TimestampedFrame>(frames: T[]) {
  const sorted = frames
    .filter((frame) => Number.isFinite(frame.timestamp) && frame.timestamp > 0)
    .sort((left, right) => left.timestamp - right.timestamp);
  const unique: T[] = [];
  for (const frame of sorted) {
    if (unique.at(-1)?.timestamp === frame.timestamp) unique[unique.length - 1] = frame;
    else unique.push(frame);
  }
  return unique;
}

/** Selects the last frame known at the replay clock. It never reads ahead. */
export function replayFrameAtOrBefore<T extends TimestampedFrame>(frames: T[], timestamp: number) {
  if (!frames.length) return null;
  let low = 0;
  let high = frames.length - 1;
  let match = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (frames[middle].timestamp <= timestamp) {
      match = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return match < 0 ? null : frames[match];
}

export function replayFramesAtOrBefore<T extends TimestampedFrame>(frames: T[], timestamp: number) {
  if (!frames.length) return [];
  let low = 0;
  let high = frames.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (frames[middle].timestamp <= timestamp) low = middle + 1;
    else high = middle;
  }
  return frames.slice(0, low);
}

export function replayTimestampAtProgress<T extends TimestampedFrame>(frames: T[], progress: number) {
  if (!frames.length) return null;
  const start = frames[0].timestamp;
  const end = frames.at(-1)?.timestamp ?? start;
  return start + Math.max(0, Math.min(1, progress)) * (end - start);
}
