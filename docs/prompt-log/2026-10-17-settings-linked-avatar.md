# Linked profile picture in normal Settings

Owner requested the Socials profile picture and all customisation controls be
available in normal Settings, linked to the same account profile.

Settings → Public profile now has the shared console-avatar picker, per-paint
colour editor, stock/reset/recent colours, upload and 500px circular crop preview.
Identity includes a Change profile picture shortcut. Shared UI/handlers are
extracted into useProfileAvatarEditor; no new artwork or image service is used.

The editor loads only the signed-in account's canonical Socials profile, checks
viewer ownership, and requires explicit Save picture. A narrow authenticated
friends avatar action reads the existing profile and updates only avatarUrl,
avatarAppearance and its modification time, preserving other payload fields and
database visibility. Uploading a photo clears old palette metadata. Storage/load
errors are explicit and do not report success. Preparation races and double
submissions are guarded. After success, the shared identity cache/event updates
the account avatar and already-mounted Socials profile for the same user.

Validation: 20 focused avatar tests pass, covering crop geometry/async races,
all 30 palettes/assets, latest-colour exports, account-only writes, preservation
of bio/presence/visibility/unknown fields, photo metadata clearing, errors,
double submits, stale preparation and linked identity/profile publication.
Scoped lint has zero errors and two pre-existing unrelated Socials img warnings.
Full TypeScript and isolated production build pass (80 generated pages).

Limits: authenticated UI and cross-device persistence have not been interactively
verified. This change makes no provider/gateway/feed or infrastructure changes.
Full rolling-month futures/options coverage, missing execution sessions, permanent
VPS recovery, live browser memory/indicator soaks and multi-user launch/cost
validation remain open in IMPORTANT-NOTES.md; this avatar change closes none.
