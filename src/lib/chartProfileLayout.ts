
export type ProfileBody = {
  owner: string;
  anchor: number;
  leftWidth: number;
  rightWidth: number;
  edge?: "left" | "right";
};

type Placement = { anchor: number; scale: number };
type Source = (left: number, right: number) => ReadonlyMap<object, ProfileBody>;

const gap = 6;

export function separateProfileBodies(
  bodies: ReadonlyMap<object, ProfileBody>,
  left: number,
  right: number,
): Map<object, Placement> {
  const visible = [...bodies].flatMap(([model, body]) => {
    const start = Math.max(left, body.anchor - body.leftWidth);
    const end = Math.min(right, body.anchor + body.rightWidth);
    return end > start ? [{ model, body, start, end }] : [];
  }).sort((a, b) => a.start - b.start);

  const placements = new Map<object, Placement>();
  let previousEnd = left - gap;
  for (let first = 0; first < visible.length;) {
    let next = first + 1;
    let end = visible[first].end;
    while (next < visible.length && visible[next].start < end + gap) {
      end = Math.max(end, visible[next].end);
      next += 1;
    }
    const start = visible[first].start;
    const group = visible.slice(first, next);
    first = next;
    if (new Set(group.map(({ body }) => body.owner)).size < 2) {
      previousEnd = end;
      continue;
    }

    const edgeOrder = { left: -1, right: 1 };
    group.sort((a, b) =>
      (a.body.edge ? edgeOrder[a.body.edge] : 0) - (b.body.edge ? edgeOrder[b.body.edge] : 0)
      || a.body.anchor - b.body.anchor,
    );
    const totalWidth = group.reduce((sum, { body }) => sum + body.leftWidth + body.rightWidth, 0);
    const desiredWidth = totalWidth + (group.length - 1) * gap;
    // Keep at least half the natural width when the immediate surroundings
    // have room, while keeping the group close to its original time anchors.
    const minStart = Math.max(left, previousEnd + gap);
    const maxEnd = Math.min(right, (visible[next]?.start ?? right + gap) - gap);
    const available = Math.min(maxEnd - minStart, Math.max(end - start, desiredWidth / 2));
    const spacing = Math.min(gap, available / (group.length * 4));
    const scale = Math.min(1, (available - (group.length - 1) * spacing) / totalWidth);
    const firstEdge = group[0].body.edge;
    const lastEdge = group.at(-1)?.body.edge;
    const preferredStart = firstEdge === "left" ? start : lastEdge === "right" ? end - available
      : (start + end - available) / 2;
    let cursor = Math.max(minStart, Math.min(maxEnd - available, preferredStart));
    for (const { model, body } of group) {
      const anchor = cursor + body.leftWidth * scale;
      placements.set(model, { anchor, scale });
      cursor += (body.leftWidth + body.rightWidth) * scale + spacing;
    }
    previousEnd = Math.max(end, cursor - spacing);
  }
  return placements;
}

/** One layout per price pane, shared by the volume and TPO canvas renderers. */
export class ChartProfileLayout {
  private readonly sources: Source[] = [];
  private cached?: { key: string; placements: Map<object, Placement> };

  addSource(source: Source) {
    this.sources.push(source);
    this.invalidate();
  }

  invalidate() {
    this.cached = undefined;
  }

  positions(left: number, right: number, from: number | undefined, to: number | undefined) {
    const key = [left, right, from, to].join(":");
    if (this.cached?.key === key) return this.cached.placements;
    const bodies = new Map<object, ProfileBody>();
    for (const source of this.sources) {
      for (const [model, body] of source(left, right)) bodies.set(model, body);
    }
    const placements = separateProfileBodies(bodies, left, right);
    this.cached = { key, placements };
    return placements;
  }
}
