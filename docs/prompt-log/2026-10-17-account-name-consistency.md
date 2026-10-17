# Display-name consistency throughout the website

Owner changed their profile name but saw the old identity elsewhere, including
Gameplan. Root causes: the profile-updated shell handler updated only avatar;
normal Settings did not update the identity cache when saving a name; older
Socials objects rendered their creation-time author_label; several fallbacks
preferred the @handle over the display name. Name and handle remain separate.

Successful Settings/Socials/avatar saves now update a shared account-scoped
snapshot. The workspace shell consumes all identity fields. Settings, Socials
and Home subscribe, including same-account cross-tab BroadcastChannel delivery.
No polling/provider request is added; optional transport failures do not fail
saved profiles. Unchanged snapshots retain identity, and newer saves invalidate
stale in-flight startup reads. Listeners/channels close on unmount/account change.

Socials bootstrap no longer resets whenever its display-label prop changes.
Cached identity applies when hidden sections resume. Visible author labels for
posts, comments, Gameplans, receipts and memberships are projected by user ID
from current profiles. The raw locked objects/payloads, hash, time, score and user
text are not rewritten. The Socials GET adapter also fills author names for
filtered Gameplan/history requests with bounded, batched, RLS-constrained profile
lookups, not a provider/database request per item. Home loads its own canonical
profile instead of relying solely on old authentication metadata. Identity-based
storage keys and broker account labels are unchanged.

The existing identity/presence upsert also reset profile visibility to community
and wrote its old authentication label. It now retains the existing row scope
and uses the saved display name. Changing a name must not publish a private bio.
Filtered author lookups select only user ID and display name, not avatar blobs.

Tests cover actual workspace profile-save callback, avatar preservation,
account isolation, equal/stale cache snapshots, cross-tab delivery/no echo,
blocked transport, pure locked-record projections, batched Gameplan author
lookups, privacy retention and integration wiring. All 38 combined tests pass.
Scoped lint has no errors; pre-existing chart-shell hook/img warnings remain.
Full TypeScript/isolated production build are release checks. No authenticated
browser or multi-device live roundtrip has been independently verified.

This change does not close existing rolling-month history gaps, permanent VPS
restoration, live chart/indicator memory soaks or multi-user capacity/cost checks
in IMPORTANT-NOTES.md. It adds no market-data fan-out or continuous Vercel load.
