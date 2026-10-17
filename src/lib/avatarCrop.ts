export const AVATAR_CROP_SIZE = 240;
export const AVATAR_OUTPUT_SIZE = 500;
export const MAX_AVATAR_SOURCE_BYTES = 12 * 1024 * 1024;
export type AvatarCropDraft = { sourceUrl: string; naturalWidth: number; naturalHeight: number; zoom: number; offsetX: number; offsetY: number };
export function avatarCropScale(draft: AvatarCropDraft, zoom = draft.zoom) {
  return Math.max(AVATAR_CROP_SIZE / draft.naturalWidth, AVATAR_CROP_SIZE / draft.naturalHeight) * zoom;
}
export function clampAvatarOffset(draft: AvatarCropDraft, offsetX: number, offsetY: number, zoom = draft.zoom) {
  const scale = avatarCropScale(draft, zoom);
  const maxX = Math.max(0, (draft.naturalWidth * scale - AVATAR_CROP_SIZE) / 2);
  const maxY = Math.max(0, (draft.naturalHeight * scale - AVATAR_CROP_SIZE) / 2);
  return { offsetX: Math.max(-maxX, Math.min(maxX, offsetX)), offsetY: Math.max(-maxY, Math.min(maxY, offsetY)) };
}
export function avatarSourceRect(draft: AvatarCropDraft) {
  const scale = avatarCropScale(draft);
  const { offsetX, offsetY } = clampAvatarOffset(draft, draft.offsetX, draft.offsetY);
  const size = AVATAR_CROP_SIZE / scale;
  return { x: draft.naturalWidth / 2 - (AVATAR_CROP_SIZE / 2 + offsetX) / scale,
    y: draft.naturalHeight / 2 - (AVATAR_CROP_SIZE / 2 + offsetY) / scale, size };
}
