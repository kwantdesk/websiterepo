const timelineKey = Symbol.for("kwantdesk.workspaceLoadTimeline");
const handoffWindowMs = 250;

export function startWorkspaceLoading(loader) {
  let owner = window;
  let frame = null;
  try {
    frame = window.frameElement;
    if (frame) owner = window.parent;
  } catch {
    // Cross-origin embeds keep their own timeline.
  }

  const pathname = owner.location.pathname;
  const now = owner.performance.now();
  let timeline = owner[timelineKey];
  if (timeline) {
    for (const entry of timeline.loaders) {
      if (!entry.loader.isConnected || (entry.frame && !entry.frame.isConnected)) {
        timeline.loaders.delete(entry);
      }
    }
  }
  if (!timeline || timeline.pathname !== pathname
    || (timeline.loaders.size === 0 && now - timeline.ended > handoffWindowMs)) {
    timeline = { pathname, started: now, loaders: new Set(), ended: now };
    owner[timelineKey] = timeline;
  }

  const entry = { loader, frame };
  timeline.loaders.add(entry);
  loader.style.setProperty("--kwant-loader-delay", `-${now - timeline.started}ms`);
  return () => {
    if (timeline.loaders.delete(entry) && timeline.loaders.size === 0) {
      timeline.ended = owner.performance.now();
    }
  };
}
