/**
 * Ordering the panes a layout button is about to lay out.
 *
 * A layout button changes the GEOMETRY of the desk and nothing else. It moves
 * the walls; it does not decide what is behind them.
 *
 * Two ways that went wrong. The active pane was hoisted to the front, so
 * picking a layout while focused on the right-hand chart moved that chart to
 * the left and shuffled the others past it — the charts looked swapped, or
 * thrown away. And any pane missing from the current tree had its content
 * blanked, so a chart set up earlier and then hidden behind a smaller layout
 * came back empty.
 *
 * Kept pure so the rule can be checked without mounting the workspace.
 */

export type OrderablePane<TContent> = { id: string; content: TContent };

export function orderPanesForLayout<TPane extends OrderablePane<TContent>, TContent>(
  /** Pane ids in the order they are on screen right now, left to right. */
  visibleOrder: readonly string[],
  /** Every pane the desk holds, including any not currently on screen. */
  panes: readonly TPane[],
  /** Panes created for this layout, which are the only ones allowed to start empty. */
  freshPaneIds: ReadonlySet<string>,
  /** What an untouched new slot holds. */
  emptyContent: TContent,
): TPane[] {
  const byId = new Map(panes.map((pane) => [pane.id, pane]));
  const seen = new Set<string>();
  const ordered: TPane[] = [];
  for (const paneId of visibleOrder) {
    const pane = byId.get(paneId);
    if (!pane || seen.has(paneId)) continue;
    seen.add(paneId);
    ordered.push(pane);
  }
  // Anything off screen keeps its stored order behind what is on screen.
  for (const pane of panes) {
    if (seen.has(pane.id)) continue;
    seen.add(pane.id);
    ordered.push(pane);
  }
  return ordered.map((pane) => (
    freshPaneIds.has(pane.id) ? { ...pane, content: emptyContent } : pane
  ));
}
