# Quick calling-card activation on profiles

Owner requested unlocked cards on the profile itself, without navigating to the
Calling Cards page. Own profiles now have a compact Change calling card disclosure
below the profile actions. It shows starter cards and this account's earned cards
only, with artwork previews, Active state, saving feedback and inline failures.
Other people's profiles do not expose the picker. Responsive grid/scroll bounds
keep the collection within the profile; keyboard-native disclosure and buttons.

The profile and collection share equipCallingCard. Activation now waits for an
authenticated account save rather than optimistically marking an unsaved local
banner as active. Duplicate clicks are guarded and failure retains the previous
banner. The dedicated friends calling-card action checks the account's award row,
then changes only callingCardCode and updated_at, preserving identity, avatar,
unknown payload fields and row privacy. No migration, provider calls or polling.

Seven focused regressions cover starter/earned/locked cards, account ownership,
privacy and payload preservation, authentication/storage failures, actual picker
markup, actual client save timing/duplicate clicks/retry, and profile integration.
Combined identity/avatar/profile management regressions: 27 passing. Scoped lint
has zero errors (two pre-existing Socials img warnings); full TypeScript and the
isolated 80-page production build passed. Authenticated
browser/cross-device save roundtrip has not been independently verified.

Standing open items remain unchanged: rolling-month history gaps, permanent VPS
recovery, live chart memory/market-open soaks and concurrent-user capacity/cost
validation in IMPORTANT-NOTES.md. No gateway restart or new infrastructure.
