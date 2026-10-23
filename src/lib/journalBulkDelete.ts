import { isZyonJournalAccountName } from "./journal.ts";

export type JournalDeleteTarget = { id: string; name: string };

/** Reuse the owned-account deletion endpoint; partial success is never rolled back. */
export async function deleteJournalSelection(
  targets: readonly JournalDeleteTarget[],
  remove: (target: JournalDeleteTarget) => Promise<void>,
  onDeleted: (target: JournalDeleteTarget) => void,
  isCurrent: () => boolean = () => true,
) {
  const deleted: JournalDeleteTarget[] = [];
  const failed: { target: JournalDeleteTarget; error: string }[] = [];
  const unique = new Set<string>();
  for (const target of targets) {
    if (!isCurrent()) break;
    const name = target.name.trim();
    if (!name || name === "all" || isZyonJournalAccountName(name)) continue;
    const key = target.id || name;
    if (unique.has(key)) continue;
    unique.add(key);
    try {
      await remove(target);
      onDeleted(target);
      deleted.push(target);
      if (!isCurrent()) break;
    } catch (error) {
      failed.push({ target, error: error instanceof Error ? error.message : "Journal could not be deleted." });
    }
  }
  return { deleted, failed };
}
