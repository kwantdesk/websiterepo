import { workspaceScopeStorageKey } from "./chartWorkspaceScope.ts";

type Values = Record<string, string>;
type Pane = Record<string, unknown> & { id: string };
type Tree = { type: "pane"; paneId: string } | { type: "split"; id: string; axis: "x" | "y"; ratio: number; first: Tree; second: Tree };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const parse = (value?: string): unknown => { try { return JSON.parse(value ?? "null"); } catch { return null; } };
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const panes = (value?: string): Pane[] | null => {
  const items = parse(value);
  return Array.isArray(items) && items.every(item => record(item) && typeof item.id === "string") ? items as Pane[] : null;
};
function mergePaneFields(base: Pane | undefined, local: Pane, remote: Pane): Pane {
  const result = { ...remote };
  for (const key of new Set([...Object.keys(base ?? {}), ...Object.keys(local)])) {
    if (equal(base?.[key], local[key])) continue;
    if (Object.hasOwn(local, key)) result[key] = local[key];
    else delete result[key];
  }
  return result;
}
function mergePanes(base: Pane[], local: Pane[], remote: Pane[]) {
  const before = new Map(base.map(pane => [pane.id, pane]));
  const edits = new Map(local.map(pane => [pane.id, pane]));
  const received = new Map(remote.map(pane => [pane.id, pane]));
  const merged = new Map<string, Pane>();
  for (const id of new Set([...received.keys(), ...edits.keys()])) {
    const b = before.get(id), l = edits.get(id), r = received.get(id);
    // Absence only means Close if this side previously knew the panel. A
    // newly duplicated peer panel must survive an older tab's timeframe edit.
    if (b && (!l || !r)) continue;
    if (l && r) merged.set(id, mergePaneFields(b, l, r));
    else if (l || r) merged.set(id, (l ?? r)!);
  }
  return [...merged.values()];
}
function pruneTree(value: unknown, valid: Set<string>, seen = new Set<string>(), depth = 0): Tree | null {
  if (!record(value) || depth > 128) return null;
  if (value.type === "pane" && typeof value.paneId === "string") {
    if (!valid.has(value.paneId) || seen.has(value.paneId)) return null;
    seen.add(value.paneId); return { type: "pane", paneId: value.paneId };
  }
  if (value.type !== "split") return null;
  const first = pruneTree(value.first, valid, seen, depth + 1);
  const second = pruneTree(value.second, valid, seen, depth + 1);
  if (!first || !second) return first ?? second;
  return { type: "split", id: typeof value.id === "string" ? value.id : "sync-split", axis: value.axis === "y" ? "y" : "x", ratio: typeof value.ratio === "number" && Number.isFinite(value.ratio) ? value.ratio : 50, first, second };
}
function treeIds(tree: Tree | null): string[] { return !tree ? [] : tree.type === "pane" ? [tree.paneId] : [...treeIds(tree.first), ...treeIds(tree.second)]; }

/** Merge each panel's edits, then keep the chosen layout consistent with its IDs. */
export function mergeWorkspacePanePreferences(base: Values, local: Values, remote: Values, selected: Values): Values {
  const result = { ...selected };
  for (const scope of ["charts", "gamma", "algo"] as const) {
    const key = (name: string) => workspaceScopeStorageKey(scope, `olisa-chart-workspace-${name}`);
    const b = panes(base[key("panes")]), l = panes(local[key("panes")]), r = panes(remote[key("panes")]);
    // Without an acknowledged baseline, a first sign-in is not evidence of
    // concurrent edits. Keep the existing hydration decision in that case.
    if (!b || !l || !r) continue;
    const merged = mergePanes(b, l, r);
    // Two devices can each close a different panel. Keep the sender's last
    // remaining panel rather than resetting the workspace to default charts.
    if (!merged.length && l.length) merged.push(l[0]);
    result[key("panes")] = JSON.stringify(merged);
    const valid = new Set(merged.map(pane => pane.id));
    for (const name of ["linked-panes", "crosshair-panes"] as const) {
      const before = parse(base[key(name)]), edits = parse(local[key(name)]), received = parse(remote[key(name)]);
      if (!Array.isArray(edits) || !Array.isArray(received)) continue;
      const original = new Set(Array.isArray(before) ? before : []), a = new Set(edits), z = new Set(received);
      result[key(name)] = JSON.stringify([...new Set([...received, ...edits])].filter(id => typeof id === "string" && valid.has(id) && (!original.has(id) || (a.has(id) && z.has(id)))));
    }
    const floating = parse(result[key("floating-windows")]);
    const detached = new Set(Array.isArray(floating) ? floating.flatMap(item => record(item) && typeof item.paneId === "string" ? [item.paneId] : []) : []);
    const docked = new Set([...valid].filter(id => !detached.has(id)));
    const left = pruneTree(parse(local[key("tree")]), docked), right = pruneTree(parse(remote[key("tree")]), docked);
    const originalVisible = new Set(treeIds(pruneTree(parse(base[key("tree")]), docked)));
    const localVisible = new Set(treeIds(left)), remoteVisible = new Set(treeIds(right));
    const wanted = new Set([...localVisible, ...remoteVisible].filter(id =>
      !originalVisible.has(id) || (localVisible.has(id) && remoteVisible.has(id))));
    const selectedTree = parse(result[key("tree")]);
    let tree = pruneTree(selectedTree, wanted);
    const visible = new Set(treeIds(tree));
    // Only visible peer additions are appended. Do not reveal panes deliberately
    // kept off-screen by Single or another smaller layout template.
    for (const id of new Set([...treeIds(left), ...treeIds(right)])) {
      if (visible.has(id) || !wanted.has(id)) continue;
      const next: Tree = { type: "pane", paneId: id };
      tree = tree ? { type: "split", id: `sync-split-${id}`, axis: "x", ratio: 50, first: tree, second: next } : next;
      visible.add(id);
    }
    if (tree) {
      result[key("tree")] = JSON.stringify(tree);
      if (!equal(tree, selectedTree) || treeIds(tree).length > 1 && result[key("layout")] === "single") result[key("layout")] = "custom";
    }
  }
  return result;
}
