# Permanent Journal account deletion

## User prompt

> DELETING ACCOUNTS FROM THE JOURNAL ISNT WORKING, IF I DELETE IT, THE ACCOUNT SHOULD COMLETELY BE WIPED.....

## Diagnosis

The button optimistically removed the Journal from React state, but two paths
could restore it. A demo/paper Journal may exist only in IndexedDB until it has
synced a closed trade, so the API returned 404 and the client rolled the delete
back. Separately, startup merged stale IndexedDB and memory records into the
cloud response and then synced those local records back to the server. The
automatic paper-journal writer could also recreate the account by name.

Cloud deletion cascaded database trades and imports and explicitly removed
evidence and analysis, but it did not remove Socials posts linked to the
deleted Journal's trades even though deleting one trade did.

## Fix

- Made account deletion idempotent when the cloud row is already absent or the
  Journal exists locally only.
- Added a durable per-user browser tombstone for explicitly deleted Journal
  accounts and filter stale local, memory and cloud merge inputs through it.
- Purge the complete account state directly to IndexedDB after the server
  confirms deletion rather than waiting for the debounced saver.
- Prevent the automatic paper-journal writer from recreating a tombstoned
  account or restoring its old trades.
- Clear the tombstone only when the user explicitly creates or imports the
  account again.
- Remove linked Socials trade posts and their activity before deleting the
  cloud Journal account; database foreign keys then cascade trades/imports,
  while evidence, analysis and archive state are deleted explicitly.

## Outcome

Delete now means permanent removal rather than a temporary UI hide. The
target Journal and all data owned by it are removed while every other Journal
is preserved, and refresh/navigation/paper sync cannot resurrect it.
