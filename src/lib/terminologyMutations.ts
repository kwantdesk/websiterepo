/** Process only changed copy; a chart label update must not rescan its SVG. */
export function processTerminologyMutations(
  records: MutationRecord[],
  tree: (node: Node) => void,
  text: (node: Node) => void,
  attribute: (node: Node, name: string | null) => void,
) {
  const added = new Set<Node>();
  for (const record of records) for (const node of record.addedNodes) added.add(node);
  const covered = (node: Node | null) => {
    for (let parent = node; parent; parent = parent.parentNode) if (added.has(parent)) return true;
    return false;
  };
  // React often reports both an inserted container and its inserted children.
  // Visit the highest inserted ancestor once, preserving synchronous scrubbing.
  for (const node of added) if (!covered(node.parentNode)) tree(node);
  const seenText = new Set<Node>();
  const seenAttributes = new Map<Node, Set<string | null>>();
  for (const record of records) {
    if (covered(record.target)) continue;
    if (record.type === "characterData" && !seenText.has(record.target)) {
      seenText.add(record.target);
      text(record.target);
    }
    if (record.type === "attributes") {
      const names = seenAttributes.get(record.target) ?? new Set<string | null>();
      if (!names.has(record.attributeName)) attribute(record.target, record.attributeName);
      names.add(record.attributeName);
      seenAttributes.set(record.target, names);
    }
  }
}
