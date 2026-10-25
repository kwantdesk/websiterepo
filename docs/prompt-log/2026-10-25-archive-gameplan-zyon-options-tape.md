# Archive Gameplan, Zyon and sidebar Options Tape

Request: archive Gameplan/Zyon from the top bar and Zyon/Options Tape from the right rail; keep them for later restoration.

One reversible registry, src/lib/archivedWorkspaceFeatures.ts, hides these entries from both primary-nav orientations, home shortcuts and the Add panel picker. Old Gameplan/Zyon routes resolve to Charts and replace the URL. Sidebar hydration/toggle/reopen and module prewarming reject archived IDs. Existing saved embedded Gameplan/Zyon panes show an archive placeholder without changing their stored content/settings.

No implementations, route files, API handlers, account data, chats, journals or preferences were deleted. Existing chart level calculations and ordinary Journal/Options/Kwanty/Kwant Bot remain intact. Restore by removing the relevant ID from the registry and updating its archive test expectation. This archive is a UI availability boundary, not an API authentication/security boundary.

Validation: 13 focused archive/retirement/persistent-navigation tests pass, including actual React server rendering of both primary-nav orientations. Production build/TypeScript pass. Scoped lint has zero errors and two pre-existing AppSidebar image warnings; the monolithic workspace is covered by the build and focused source contracts, not claimed lint-clean. Logs are in the local workspace-archive files. No new data polling, provider changes or gateway restarts. Single scoped main release only; unrelated dirty work is excluded.
