import { saveGexMapPalette, type GexMapPalette } from "./gexMapPalette";
import { publishLinkedGexMapSettings, readLinkedGexMapSettings, type LinkedGexMapSettings } from "./gexMapLinkedSettings";

export type BounceGexMapDraft = {
  palette?: GexMapPalette;
  profile?: Partial<LinkedGexMapSettings>;
};

const drafts = new Map<object, BounceGexMapDraft>();
const listeners = new Set<() => void>();
let activeDraft: BounceGexMapDraft | null = null;

function notifyDraftChange() {
  activeDraft = [...drafts.values()].at(-1) ?? null;
  listeners.forEach((listener) => listener());
}

export function subscribeBounceGexMapPreview(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getBounceGexMapPreview() {
  return activeDraft;
}

export function getBounceGexMapDraft(owner: object) {
  return drafts.get(owner) ?? null;
}

export function setBounceGexMapDraft(owner: object, patch: BounceGexMapDraft) {
  const current = drafts.get(owner);
  const next = { ...current, ...patch };
  if (patch.profile) next.profile = { ...current?.profile, ...patch.profile };
  drafts.delete(owner);
  if (next.palette || next.profile) drafts.set(owner, next);
  notifyDraftChange();
}

export function clearBounceGexMapDraft(owner: object) {
  if (drafts.delete(owner)) notifyDraftChange();
}

export function commitBounceGexMapPreview(owner: object) {
  const draft = drafts.get(owner);
  if (draft?.palette) saveGexMapPalette(draft.palette);
  if (draft?.profile) publishLinkedGexMapSettings({ ...readLinkedGexMapSettings(), ...draft.profile });
  clearBounceGexMapDraft(owner);
}
