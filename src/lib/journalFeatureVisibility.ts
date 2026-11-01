import { isWorkspaceFeatureArchived } from "./archivedWorkspaceFeatures";
import { isZyonJournalAccountName } from "./journal";

export const ZYON_JOURNAL_VISIBLE = !isWorkspaceFeatureArchived("zyon");

/** A remembered archived tab must reopen the active journal, not an empty view. */
export function visibleJournalAccountFilter(account: string) {
  return !ZYON_JOURNAL_VISIBLE && isZyonJournalAccountName(account) ? "all" : account;
}
