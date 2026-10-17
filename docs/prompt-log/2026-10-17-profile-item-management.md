# Profile item actions and audiences

Owner requested Gameplan and post edit/delete/archive controls directly on their
profile, plus remove/unlike/undo-repost/unsave actions across each collection and
Public, Friends only and Only me/private choices.

One context-aware Options menu is wired into all five profile sections. Actions
are owner-only; liked/saved operations target the viewer's own reaction row, not
the original author's item. Delete requires confirmation. Gameplan editing is a
separate profile note, not rewriting a timestamped trading thesis; trade-post
caption changes preserve trade data. Other owned posts reuse the full composer.
Cloud save failures retain the editor rather than reporting a false saved result.

Archiving records their prior audience and makes them private. Archived items
are excluded from normal profile/feed views and have a per-section Archived view
for restore. Changing an archived item's audience changes the restore audience
without exposing the archived row. Unlike/Unsave/Delete remove the owned Socials
entry, not the original Gameplan source or Journal.

Authenticated PATCH /api/socials selects and mutates only the actor's owned row.
Visibility writes use existing database scope/RLS. Likes/reposts/saves also have
collection-wide audiences/defaults, including Friends; updates use one scoped
bulk query rather than a request per collection entry. Archived entries remain
private. Partial collection-default failure is explicit and retryable. The
database's existing mutual-friend definition is retained, not broadened to all
followers. No market-data requests, infrastructure purchase or feed changes.

Database dependency: locked precord rows currently reject every UPDATE. The
provided migration replaces that trigger with a comparison allowing only scope,
updated_at and three presentation metadata fields; all other fields stay locked.
Owner explicitly chose to run the SQL themselves. The migration has NOT been
confirmed applied. Archive/privacy/profile-note actions on Gameplans remain
blocked with an honest error until then. Deleting an owned Socials copy and
post/reaction actions do not require that trigger change.

Verification: 27 focused tests pass, including real PATCH-handler execution
against an in-memory query harness, ownership/unauthenticated denial, source
protection, immutable field preservation, archive roundtrip, Friends collection
defaults, failures and server-rendered context-specific menu content. Migration
checks are source assertions, NOT a live PostgreSQL execution. Authenticated
browser/end-to-end friend/stranger testing remains unverified. Scoped lint,
existing Socials visibility/reaction tests, TypeScript and isolated build are
checked before release.

Standing open work remains in IMPORTANT-NOTES.md: full rolling-month data and
missing execution archives, permanent VPS recovery, live chart/indicator memory
soaks and multi-user launch/cost validation. None is closed by this profile task.
