const timelineKey = Symbol.for("kwantdesk.workspaceLoadTimeline");
const handoffWindowMs = 250;
const finishDurationMs = 180;

function sameBar(first, second) {
  const center = rect => [rect.left + rect.width / 2, rect.top + rect.height / 2];
  const [x1, y1] = center(first);
  const [x2, y2] = center(second);
  return Math.abs(x1 - x2) < 32 && Math.abs(y1 - y2) < 32;
}

function visibleBarRect(track, frame) {
  const rect = track.getBoundingClientRect();
  const offset = frame?.getBoundingClientRect();
  return {
    left: rect.left + (offset?.left ?? 0),
    top: rect.top + (offset?.top ?? 0),
    width: rect.width,
    height: rect.height,
  };
}

function finishLoading(loader, timeline, owner, frame) {
  const track = loader.querySelector(".kwant-loader-track");
  if (!track || !loader.isConnected || owner.location.pathname !== timeline.pathname) return;

  const rect = track.getBoundingClientRect();
  if (!rect.width || !rect.height || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const fill = track.firstElementChild;
  const trackStyle = window.getComputedStyle(track);
  const fillStyle = window.getComputedStyle(fill);
  const origin = fillStyle.transform;
  const completion = track.cloneNode(true);
  completion.setAttribute("aria-hidden", "true");
  Object.assign(completion.style, {
    position: "fixed",
    margin: "0",
    left: rect.left + "px",
    top: rect.top + "px",
    width: rect.width + "px",
    height: rect.height + "px",
    zIndex: "90",
    pointerEvents: "none",
    background: trackStyle.backgroundColor,
  });
  Object.assign(completion.firstElementChild.style, {
    animation: "none",
    background: fillStyle.backgroundColor,
    transform: origin,
  });

  const entry = {
    rect: visibleBarRect(track, frame),
    cancel() {
      completion.remove();
      timeline.finishes.delete(entry);
    },
  };
  timeline.finishes.add(entry);
  window.requestAnimationFrame(() => {
    // A replacement loader owns the same space during a loading-stage handoff.
    const replacement = Array.from(timeline.loaders).some(({ loader, frame }) => {
      const track = loader.querySelector(".kwant-loader-track");
      if (!loader.isConnected || !track) return false;
      const rect = visibleBarRect(track, frame);
      return rect.width && sameBar(entry.rect, rect);
    });
    if (replacement || !timeline.finishes.has(entry) || owner.location.pathname !== timeline.pathname
      || loader.isConnected && loader.getBoundingClientRect().width > 0) {
      entry.cancel();
      return;
    }
    document.body.append(completion);
    const advance = completion.firstElementChild.animate(
      [{ transform: origin }, { transform: "scaleX(1)" }],
      { duration: finishDurationMs, easing: "cubic-bezier(.55, 0, .75, 1)", fill: "forwards" },
    );
    advance.finished.then(() => window.requestAnimationFrame(() => entry.cancel()), entry.cancel);
  });
}

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
    timeline = { pathname, started: now, loaders: new Set(), finishes: new Set(), ended: now };
    owner[timelineKey] = timeline;
  }

  const entry = { loader, frame };
  timeline.loaders.add(entry);
  loader.style.setProperty("--kwant-loader-delay", `-${now - timeline.started}ms`);
  const track = loader.querySelector(".kwant-loader-track");
  const rect = track && visibleBarRect(track, frame);
  if (rect?.width) {
    for (const completion of timeline.finishes) {
      if (sameBar(completion.rect, rect)) completion.cancel();
    }
  }
  return (complete = true) => {
    if (!timeline.loaders.delete(entry)) return;
    if (timeline.loaders.size === 0) timeline.ended = owner.performance.now();
    if (complete) finishLoading(loader, timeline, owner, frame);
  };
}
