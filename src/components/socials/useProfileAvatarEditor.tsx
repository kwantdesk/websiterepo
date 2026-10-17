"use client";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction, type PointerEvent as ReactPointerEvent } from "react";
import { Camera, Upload, Check, Plus, X } from "lucide-react";
import AvatarPaletteEditor, { type AvatarPaletteEditorHandle } from "./AvatarPaletteEditor";
import { SOCIAL_AVATAR_PRESETS } from "@/lib/socialAvatarPresets";
import { AVATAR_CROP_SIZE, AVATAR_OUTPUT_SIZE, MAX_AVATAR_SOURCE_BYTES, avatarCropScale, avatarSourceRect, clampAvatarOffset, type AvatarCropDraft } from "@/lib/avatarCrop";
import { encodeCanvasImage } from "@/lib/clientImageProcessing";
import type { SocialProfilePayload } from "@/lib/socials";

// Shared local-only editor; the calling screen explicitly publishes the prepared avatar.
export function useProfileAvatarEditor({ profileDraft, setProfileDraft, setNotice, disabled = false }: {
 profileDraft: SocialProfilePayload;
 setProfileDraft: Dispatch<SetStateAction<SocialProfilePayload>>;
 setNotice: (notice: string) => void;
 disabled?: boolean;
}) {
 const [avatarCrop, setAvatarCrop] = useState<AvatarCropDraft | null>(null);
 const [avatarCropSaving, setAvatarCropSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarCropSourceRef = useRef<string | null>(null);
  const avatarLoadSequenceRef = useRef(0);
  const avatarCropDialogRef = useRef<HTMLDivElement>(null);
  const avatarPaletteEditorRef = useRef<AvatarPaletteEditorHandle>(null);
  const selectedPalettePreset = SOCIAL_AVATAR_PRESETS.find(preset => preset.id === profileDraft.avatarAppearance?.presetId)
    ?? SOCIAL_AVATAR_PRESETS.find(preset => preset.url === profileDraft.avatarUrl);
  const avatarDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const closeAvatarCrop = useCallback(() => {
    avatarLoadSequenceRef.current += 1;
    if (avatarCropSourceRef.current) {
      URL.revokeObjectURL(avatarCropSourceRef.current);
      avatarCropSourceRef.current = null;
    }
    avatarDragRef.current = null;
    setAvatarCrop(null);
    setAvatarCropSaving(false);
  }, []);

  useEffect(() => () => {
    avatarLoadSequenceRef.current += 1;
    if (avatarCropSourceRef.current) URL.revokeObjectURL(avatarCropSourceRef.current);
    avatarCropSourceRef.current = null;
  }, []);

  const avatarCropSource = avatarCrop?.sourceUrl;
  useEffect(() => {
    if (!avatarCropSource) return;
    const previous = document.activeElement as HTMLElement | null;
    avatarCropDialogRef.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [avatarCropSource]);

  const selectPresetAvatar = (url: string, name: string) => {
    closeAvatarCrop();
    setProfileDraft(current => current.avatarAppearance?.presetId === SOCIAL_AVATAR_PRESETS.find(preset => preset.url === url)?.id ? current : ({ ...current, avatarUrl: url, avatarAppearance: undefined }));
    setNotice(`${name} selected. Save your profile to publish it.`);
  };

  const handleAvatar = (file: File | null) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      setNotice("Choose a PNG, JPG, WEBP, or GIF profile image.");
      return;
    }
    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      setNotice("Choose a profile photo smaller than 12 MB.");
      return;
    }
    const sourceUrl = URL.createObjectURL(file);
    const sequence = ++avatarLoadSequenceRef.current;
    const image = new window.Image();
    image.onload = () => {
      if (sequence !== avatarLoadSequenceRef.current) { URL.revokeObjectURL(sourceUrl); return; }
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) {
        URL.revokeObjectURL(sourceUrl);
        setNotice("Choose a readable profile photo no larger than 40 megapixels.");
        return;
      }
      if (avatarCropSourceRef.current) URL.revokeObjectURL(avatarCropSourceRef.current);
      avatarCropSourceRef.current = sourceUrl;
      setAvatarCrop({
        sourceUrl,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      });
      setNotice("");
    };
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      if (sequence !== avatarLoadSequenceRef.current) return;
      setNotice("That profile photo could not be read.");
    };
    image.src = sourceUrl;
  };

  const updateAvatarZoom = (zoom: number) => {
    setAvatarCrop((current) => {
      if (!current) return current;
      const nextZoom = Math.max(1, Math.min(3, zoom));
      const clamped = clampAvatarOffset(current, current.offsetX, current.offsetY, nextZoom);
      return { ...current, zoom: nextZoom, ...clamped };
    });
  };

  const beginAvatarDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!avatarCrop || avatarCropSaving) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    avatarDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: avatarCrop.offsetX,
      originY: avatarCrop.offsetY,
    };
  };

  const moveAvatarDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (avatarCropSaving) return;
    const drag = avatarDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setAvatarCrop((current) => {
      if (!current) return current;
      const next = clampAvatarOffset(
        current,
        drag.originX + event.clientX - drag.startX,
        drag.originY + event.clientY - drag.startY,
      );
      return { ...current, ...next };
    });
  };

  const endAvatarDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (avatarDragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    avatarDragRef.current = null;
  };

  const saveCroppedAvatar = async () => {
    const crop = avatarCrop;
    if (!crop || avatarCropSaving) return;
    const sequence = avatarLoadSequenceRef.current;
    setAvatarCropSaving(true);
    try {
      const image = new window.Image();
      image.src = crop.sourceUrl;
      await image.decode();

      const source = avatarSourceRect(crop);
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_OUTPUT_SIZE;
      canvas.height = AVATAR_OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = "#090909";
      context.fillRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
      context.drawImage(
        image,
        source.x,
        source.y,
        source.size,
        source.size,
        0,
        0,
        AVATAR_OUTPUT_SIZE,
        AVATAR_OUTPUT_SIZE,
      );
      const prepared = await encodeCanvasImage(canvas, {
        maxBytes: 350_000,
        initialQuality: 0.94,
        minimumQuality: 0.78,
      });
      if (sequence !== avatarLoadSequenceRef.current) return;
      setProfileDraft((current) => ({ ...current, avatarUrl: prepared.dataUrl, avatarAppearance: undefined }));
      closeAvatarCrop();
      setNotice("Profile photo prepared at 500 × 500. Save your profile to publish it.");
    } catch {
      if (sequence !== avatarLoadSequenceRef.current) return;
      setAvatarCropSaving(false);
      setNotice("That photo could not be cropped. Try another image.");
    }
  };


 return { avatarLoadSequenceRef, avatarPaletteEditorRef, closeAvatarCrop,
 editor: (<div>                  <div className="flex items-start gap-3">
                    <button type="button" disabled={disabled} onClick={() => avatarInputRef.current?.click()} className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/25 bg-primary/10 text-[16px] font-semibold text-primary">
                      {profileDraft.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profileDraft.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : profileDraft.displayName.slice(0, 2).toUpperCase()}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/65 opacity-0 transition-opacity group-hover:opacity-100"><Camera className="h-4 w-4 text-white" /></span>
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(event) => { handleAvatar(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} />
                    <div className="min-w-0"><h2 className="truncate text-[18px] font-semibold">{profileDraft.displayName}</h2><div className="mt-1 text-[9px] text-primary">@{profileDraft.handle}</div><button type="button" disabled={disabled} onClick={() => avatarInputRef.current?.click()} className="mt-2 flex items-center gap-1.5 text-[9px] font-semibold text-muted hover:text-primary"><Upload className="h-3 w-3" />Upload your own</button><div className="mt-1 text-[8px] text-muted">500 × 500 · crop with a circular preview</div><div className="mt-2 flex flex-wrap gap-1">{profileDraft.markets.map((market) => <span key={market} className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[7px] font-semibold text-primary">{market}</span>)}</div></div>
                  </div>
                  <div className="mt-5 border-t border-border pt-4">
                    <h3 className="text-[10px] font-semibold text-foreground">Choose an avatar</h3>
                    <p className="mt-1 text-[8px] leading-4 text-muted">Choose an avatar, or upload your own. Save your profile to publish.</p>
                    <div className="mt-3 grid grid-cols-5 gap-2 max-w-sm" aria-label="Profile avatar choices">
                      {SOCIAL_AVATAR_PRESETS.map((avatar) => (
                        <button key={avatar.id} type="button" disabled={disabled} aria-label={`Choose ${avatar.name} avatar`} title={avatar.name} aria-pressed={selectedPalettePreset?.id === avatar.id} onClick={() => selectPresetAvatar(avatar.url, avatar.name)} className={`relative aspect-square overflow-visible rounded-full border-2 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selectedPalettePreset?.id === avatar.id ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/50"}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={avatar.path} alt="" loading="lazy" decoding="async" width={500} height={500} className="h-full w-full rounded-full object-cover" />
                          {selectedPalettePreset?.id === avatar.id ? <span aria-hidden="true" data-avatar-selected-badge className="pointer-events-none absolute bottom-0 right-0 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-on-primary ring-2 ring-panel"><Check className="h-3 w-3" /></span> : null}
                        </button>
                      ))}
                    </div>
                    {selectedPalettePreset ? <AvatarPaletteEditor key={selectedPalettePreset.id} ref={avatarPaletteEditorRef} preset={selectedPalettePreset} appearance={profileDraft.avatarAppearance} avatarUrl={profileDraft.avatarUrl ?? selectedPalettePreset.url} disabled={disabled} /> : null}
                  </div>
</div>),
 cropDialog: (avatarCrop ? (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md"
          onKeyDown={(event) => { if (event.key === "Escape" && !avatarCropSaving) { event.stopPropagation(); closeAvatarCrop(); } }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !avatarCropSaving) closeAvatarCrop();
          }}
        >
          <div ref={avatarCropDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Crop profile photo" className="my-auto max-h-[95dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-panel shadow-2xl shadow-black/70" onKeyDown={event => {
            if (event.key !== "Tab") return;
            const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]'));
            const first = controls[0], last = controls.at(-1);
            if (!first || !last) { event.preventDefault(); return; }
            if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          }}>
            <div className="flex items-start gap-3 border-b border-border p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Camera className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-[14px] font-semibold text-foreground">Crop profile photo</h2>
                <p className="mt-1 text-[9px] leading-4 text-muted">Drag and zoom to frame your photo. Saved at 500 × 500; the circle shows what appears on your profile.</p>
              </div>
              <button
                type="button"
                onClick={closeAvatarCrop}
                disabled={avatarCropSaving}
                aria-label="Close profile photo editor"
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col items-center px-5 py-6">
              <div
                className="relative shrink-0 touch-none select-none overflow-hidden ring-1 ring-primary/35 bg-black cursor-grab active:cursor-grabbing"
                style={{ width: AVATAR_CROP_SIZE, height: AVATAR_CROP_SIZE }}
                tabIndex={0}
                role="group"
                aria-label="Move profile photo with arrow keys or drag"
                onKeyDown={(event) => {
                  if (avatarCropSaving) return;
                  const step = event.shiftKey ? 16 : 4;
                  const x = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
                  const y = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
                  if (x || y) { event.preventDefault(); setAvatarCrop(current => current ? { ...current, ...clampAvatarOffset(current, current.offsetX + x, current.offsetY + y) } : current); }
                }}
                onPointerDown={beginAvatarDrag}
                onPointerMove={moveAvatarDrag}
                onPointerUp={endAvatarDrag}
                onPointerCancel={endAvatarDrag}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarCrop.sourceUrl}
                  alt="Profile photo crop preview"
                  draggable={false}
                  className="pointer-events-none absolute max-w-none select-none"
                  style={{
                    width: avatarCrop.naturalWidth * avatarCropScale(avatarCrop),
                    height: avatarCrop.naturalHeight * avatarCropScale(avatarCrop),
                    left: `calc(50% + ${avatarCrop.offsetX}px)`,
                    top: `calc(50% + ${avatarCrop.offsetY}px)`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
                <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/50 shadow-[0_0_0_100px_rgba(0,0,0,0.65)]" />
                <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/[0.08]" />
                <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-white/[0.08]" />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="relative h-16 w-16 overflow-hidden rounded-full ring-1 ring-primary/35 bg-black" aria-label="Actual circular profile preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarCrop.sourceUrl} alt="Circular profile preview" draggable={false} className="absolute max-w-none" style={{ width: avatarCrop.naturalWidth * avatarCropScale(avatarCrop) * 64 / AVATAR_CROP_SIZE, height: avatarCrop.naturalHeight * avatarCropScale(avatarCrop) * 64 / AVATAR_CROP_SIZE, left: `calc(50% + ${avatarCrop.offsetX * 64 / AVATAR_CROP_SIZE}px)`, top: `calc(50% + ${avatarCrop.offsetY * 64 / AVATAR_CROP_SIZE}px)`, transform: "translate(-50%, -50%)" }} />
                </div>
                <span className="text-[9px] text-muted">Your profile preview</span>
              </div>
              <div className="mt-4 flex w-full max-w-sm items-center gap-3">
                <span className="text-[16px] leading-none text-muted">−</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={avatarCrop.zoom}
                  onChange={(event) => updateAvatarZoom(Number(event.target.value))}
                  aria-label="Resize profile photo"
                  disabled={avatarCropSaving}
                  className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[var(--primary)]"
                />
                <Plus className="h-4 w-4 text-muted" />
              </div>
              <div className="mt-2 flex w-full max-w-sm items-center justify-between text-[7px] text-muted">
                <span>Resize</span>
                <button
                  type="button"
                  onClick={() => setAvatarCrop((current) => current ? { ...current, zoom: 1, offsetX: 0, offsetY: 0 } : current)}
                  disabled={avatarCropSaving}
                  className="font-semibold text-muted transition-colors hover:text-primary"
                >
                  Reset position
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border bg-background/20 px-5 py-4">
              <button
                type="button"
                onClick={closeAvatarCrop}
                disabled={avatarCropSaving}
                className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted hover:text-foreground disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveCroppedAvatar()}
                disabled={avatarCropSaving}
                className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-on-primary disabled:opacity-60"
              >
                {avatarCropSaving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background/30 border-t-background" /> : <Check className="h-3.5 w-3.5" />}
                {avatarCropSaving ? "Preparing photo…" : "Use this photo"}
              </button>
            </div>
          </div>
        </div>
      ) : null),
 };
}
