import type { Drawing } from './chartDrawTools';
import type { PrecisionObject } from '@/chart/precision-tools/types';

let clipboard: { kind: 'chart'; drawing: Drawing; pastes: number } | { kind: 'precision'; objects: PrecisionObject[]; pastes: number } | null = null;

/** A detached drawing snapshot; never a reference into the live workspace. */
export function copyChartDrawing(drawing: Drawing) {
  clipboard = { kind: 'chart', drawing: structuredClone(drawing), pastes: 0 };
}

export function hasChartDrawingClipboard() { return clipboard?.kind === 'chart'; }
export function clearChartDrawingClipboard() { clipboard = null; }

export function pasteChartDrawing(offset: (source: Drawing, ordinal: number) => number): Drawing | null {
  if (clipboard?.kind !== 'chart') return null;
  const source = structuredClone(clipboard.drawing);
  const ordinal = clipboard.pastes + 1;
  const delta = offset(source, ordinal);
  if (!Number.isFinite(delta)) return null;
  clipboard.pastes = ordinal;
  return {
    ...source,
    id: `drawing-paste-${crypto.randomUUID()}`,
    points: source.points.map(point => ({ ...point, time: point.time + delta })),
  };
}

export function copyPrecisionDrawings(objects: PrecisionObject[]) {
  if (objects.length) clipboard = { kind: 'precision', objects: structuredClone(objects), pastes: 0 };
}
export function hasPrecisionDrawingClipboard() { return clipboard?.kind === 'precision'; }
export function pastePrecisionDrawings(offset: (source: PrecisionObject, ordinal: number) => { time: number; logicalIndex: number } | null) {
  if (clipboard?.kind !== 'precision') return [];
  const delta = offset(clipboard.objects[0], clipboard.pastes + 1);
  if (!delta || !Number.isFinite(delta.time) || !Number.isFinite(delta.logicalIndex)) return [];
  clipboard.pastes++;
  return structuredClone(clipboard.objects).map(object => {
    const move = (anchor: PrecisionObject['anchors'][number]) => ({ ...anchor, time: anchor.time + delta.time, logicalIndex: anchor.logicalIndex + delta.logicalIndex });
    return { ...object, id: `precision-paste-${crypto.randomUUID()}`, anchors: object.anchors.map(move),
      ...(object.path ? { path: object.path.map(move) } : {}), createdAt: Date.now(), updatedAt: Date.now(),
      alert: object.alert ? { ...object.alert, id: `alert-${crypto.randomUUID()}`, lastTriggeredAt: null } : null };
  });
}

export function isDrawingClipboardTextTarget(target: EventTarget | null) {
  const element = target as Element | null;
  return Boolean(element?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'));
}
