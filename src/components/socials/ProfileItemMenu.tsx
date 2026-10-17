"use client";
import { useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import KwantSelect from "@/components/ui/KwantSelect";
import type { SocialObject } from "@/lib/socials";
import { PROFILE_AUDIENCES, type ProfileCollection, type ProfileItemAction, type ProfileAudience } from "@/lib/socialProfileManagement";

export type ManageProfileItem = (object: SocialObject, collection: ProfileCollection, action: ProfileItemAction, scope?: ProfileAudience, caption?: string) => Promise<void>;
export default function ProfileItemMenu({ object, managedObject, collection, archived, onManage, onEditPost }: {
  object: SocialObject; managedObject: SocialObject; collection: ProfileCollection; archived: boolean; onManage: ManageProfileItem; onEditPost: (post: SocialObject) => void;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const busyRef = useRef(false);
  const [editing, setEditing] = useState(false), [confirming, setConfirming] = useState(false);
  const [caption, setCaption] = useState(String(object.payload[object.objectType === "precord" ? "profileCaption" : "body"] ?? ""));
  const ownContent = collection === "posts" || collection === "gameplans" || collection === "reposts";
  const removeLabel = collection === "liked" ? "Unlike" : collection === "saved" ? "Unsave" : collection === "reposts" ? "Undo repost" : object.objectType === "precord" ? "Delete Socials record" : "Delete post";
  async function run(action: ProfileItemAction, scope?: ProfileAudience) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError("");
    try { await onManage(object, collection, action, scope, caption); setEditing(false); setConfirming(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "This action could not be saved."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <details className="relative z-30 mt-3 border-t border-border/60 pt-2" onClick={event => event.stopPropagation()}>
    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[8px] text-muted hover:text-foreground"><MoreHorizontal className="h-4 w-4" />Options</summary>
    <div className="mt-2 space-y-2 rounded-xl border border-border bg-surface p-3 text-[9px]">
      {ownContent && !archived ? <button type="button" disabled={busy} onClick={() => {
        if (object.objectType === "post" && object.payload.kind !== "TRADE" && !object.payload.isRepost) onEditPost(object);
        else setEditing(value => !value);
      }} className="block text-left hover:text-primary">{object.objectType === "precord" ? "Edit profile note" : "Edit post"}</button> : null}
      {editing ? <div><p className="mb-1 text-[8px] text-muted">{object.objectType === "precord" ? "This note does not change the locked trading plan or scores." : "Edit the caption without changing trade data."}</p><textarea aria-label="Profile item text" value={caption} onChange={event => setCaption(event.target.value)} maxLength={4000} rows={3} className="w-full rounded-lg border border-border bg-panel p-2" /><button type="button" disabled={busy} onClick={() => void run("edit")} className="mt-1 text-primary">Save changes</button></div> : null}
      <button type="button" disabled={busy} onClick={() => void run(archived ? "restore" : "archive")} className="block text-left hover:text-primary">{archived ? "Restore from archive" : "Archive"}</button>
      <label className="block"><span className="mb-1 block text-muted">{ownContent ? "Audience" : "Collection item audience"}</span><KwantSelect aria-label="Profile item audience" disabled={busy} value={archived ? String(managedObject.payload.profileArchiveScope ?? "private") : managedObject.scope} onChange={event => void run("visibility", event.target.value as ProfileAudience)} className="h-8 w-full rounded-lg border border-border bg-panel px-2 text-[9px]">{managedObject.scope === "desk" || managedObject.payload.profileArchiveScope === "desk" ? <option value="desk" disabled>Desk</option> : null}{PROFILE_AUDIENCES.map(audience => <option key={audience.value} value={audience.value}>{audience.label}</option>)}</KwantSelect></label>
      <button type="button" disabled={busy} onClick={() => setConfirming(true)} className="block text-left text-danger">{removeLabel}</button>
      {!ownContent ? <p className="text-[8px] leading-4 text-muted">These controls manage your collection entry, not the original author’s post.</p> : null}
      {confirming ? <div className="rounded-lg border border-danger/30 p-2"><p>{ownContent ? "Permanently delete this Socials item? Your original Gameplan and Journal are not deleted." : "Remove this item from your collection? The original author’s item is not deleted."}</p><div className="mt-2 flex gap-4"><button type="button" disabled={busy} onClick={() => void run("delete")} className="text-danger">Confirm {removeLabel.toLowerCase()}</button><button type="button" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button></div></div> : null}
      {busy ? <p role="status" className="text-muted">Saving…</p> : null}{error ? <p role="alert" className="text-danger">{error}</p> : null}
    </div>
  </details>;
}
