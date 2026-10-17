"use client";

import { useEffect, useRef, useState } from "react";
import { buildDefaultProfile, normalizeSocialProfile, type SocialObject, type SocialProfilePayload } from "@/lib/socials";
import { cacheProfileIdentity } from "@/lib/profileIdentityCache";
import { useProfileAvatarEditor } from "./useProfileAvatarEditor";

export default function AccountAvatarSettings({ userId }: { userId: string }) {
  const [profileDraft, setProfileDraft] = useState<SocialProfilePayload>(() => buildDefaultProfile("Kwant Trader"));
  const [state, setState] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const lifecycle = useRef(0);
  const savingRef = useRef(false);
  const { editor, cropDialog, avatarPaletteEditorRef, avatarLoadSequenceRef, closeAvatarCrop } = useProfileAvatarEditor({
    profileDraft, setProfileDraft, setNotice, disabled: state !== "ready",
  });

  useEffect(() => {
    const generation = ++lifecycle.current;
    setState("loading");
    void (async () => {
      try {
        const response = await fetch("/api/socials?mine=1&types=profile", { cache: "no-store" });
        const result = await response.json() as { cloud?: boolean; viewerId?: string; objects?: SocialObject[]; error?: string };
        if (!response.ok || !result.cloud || result.viewerId !== userId) throw new Error(result.error || "Your account picture could not be loaded.");
        const object = result.objects?.find(item => item.userId === userId && item.objectType === "profile" && item.id === "profile");
        if (!object) throw new Error("Save your account identity first, then reopen the picture editor.");
        if (generation !== lifecycle.current) return;
        setProfileDraft(normalizeSocialProfile(object.payload, object.authorLabel));
        setState("ready"); setNotice("");
      } catch (reason) {
        if (generation !== lifecycle.current) return;
        setState("error"); setNotice(reason instanceof Error ? reason.message : "Your account picture could not be loaded.");
      }
    })();
    return () => { lifecycle.current += 1; };
  }, [userId, revision]);

  async function savePicture() {
    if (savingRef.current || state !== "ready") return;
    savingRef.current = true;
    setState("saving"); setNotice("");
    const generation = lifecycle.current, sequence = avatarLoadSequenceRef.current;
    try {
      const prepared = await avatarPaletteEditorRef.current?.prepare();
      if (generation !== lifecycle.current || sequence !== avatarLoadSequenceRef.current) return;
      const response = await fetch("/api/friends", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "avatar", avatarUrl: prepared?.avatarUrl ?? profileDraft.avatarUrl,
          avatarAppearance: prepared ? prepared.avatarAppearance : profileDraft.avatarAppearance }),
      });
      const result = await response.json() as { object?: SocialObject; error?: string };
      if (!response.ok || !result.object || result.object.userId !== userId) throw new Error(result.error || "Your profile picture could not be saved.");
      if (generation !== lifecycle.current) return;
      const profile = normalizeSocialProfile(result.object.payload, result.object.authorLabel);
      setProfileDraft(profile);
      const identity = { avatarUrl: profile.avatarUrl ?? "", displayName: profile.displayName, handle: profile.handle };
      cacheProfileIdentity(userId, identity, true);
      window.dispatchEvent(new CustomEvent("kwantdesk:profile-updated", { detail: { ...identity, userId, profileObject: result.object } }));
      setNotice("Profile picture saved across your account, including Socials.");
    } catch (reason) {
      if (generation === lifecycle.current) setNotice(reason instanceof Error ? reason.message : "Your profile picture could not be saved.");
    } finally {
      savingRef.current = false;
      if (generation === lifecycle.current) setState("ready");
    }
  }

  return <div>
    <p className="mb-4 text-[12px] text-muted">One profile picture across Settings and Socials. Choose an avatar, customise its colours, or upload and crop your own.</p>
    {state === "loading" ? <p role="status" className="text-[12px] text-muted">Loading your profile picture…</p> : state === "error" ?
      <button type="button" onClick={() => setRevision(value => value + 1)} className="rounded-xl border border-border px-4 py-2 text-[12px]">Retry loading picture</button> :
      <div className="max-w-sm">{editor}<div className="mt-4 flex gap-2">
        <button type="button" disabled={state === "saving"} onClick={() => void savePicture()} className="rounded-xl bg-primary px-5 py-2.5 text-[12px] font-semibold text-on-primary disabled:opacity-40">{state === "saving" ? "Saving picture…" : "Save picture"}</button>
        <button type="button" disabled={state === "saving"} onClick={() => { closeAvatarCrop(); setRevision(value => value + 1); }} className="rounded-xl border border-border px-4 py-2 text-[12px] disabled:opacity-40">Discard changes</button>
      </div></div>}
    {notice ? <p role="status" className="mt-3 text-[12px] text-muted">{notice}</p> : null}
    {cropDialog}
  </div>;
}
