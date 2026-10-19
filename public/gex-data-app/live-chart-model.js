// Replacing a revised REST bucket must not double-count it or reset navigation.
export function liveChartWindow(state, oldLength, newLength) {
  const maximum = Math.max(0, newLength - 1);
  const full = state.start === 0 && state.end >= oldLength - 1;
  const follow = state.end >= oldLength - 1;
  const shift = follow && !full ? Math.max(0, newLength - oldLength) : 0;
  return {start: Math.max(0, Math.min(maximum, state.start + shift)),
    end: full ? maximum : Math.max(0, Math.min(maximum, state.end + shift))};
}

export function compatibleLiveTimeline(previous, next) {
  // A changed session, inserted/removed historical bucket or empty result needs
  // a full render. Ordinary bucket revisions and appended buckets do not.
  return previous.length > 1 && next.length >= previous.length &&
    previous.every((row, index) => row.time === next[index]?.time);
}
