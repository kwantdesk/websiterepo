# Chart drawing emoji picker — 2026-10-28

Request: drawing tool stays Loading emojis for20minutes.

Finding: ChartDrawToolbar used next/dynamic for ChartEmojiPicker, introducing a second chunk fetch after click, despite Chart.tsx already importing the full emoji catalogue. The indefinite message is that dynamic boundary; failed/stalled long-lived-tab chunk delivery cannot produce a usable picker. Kwanty State tools also deferred the picker/catalogue and emoji selection behind imports.

Change: statically link the small picker component into the drawing toolbar and State tools; keep the UI conditionally mounted only while open. State quick-pick loading/selection uses the same already-bundled catalogue helpers synchronously. Search, all categories, skin variants,120-entry pagination and stored quick picks unchanged. No emoji service or market feed needed.

Validation:12existing catalogue/persistence/scale checks pass; scoped lint clean. Memory-capped BelowNormal build pending. No gateway restart performed; its earlier performance fix remains awaiting approval.

Final build/TypeScript passed; scoped lint clean,12tests pass. A leftover asynchronous namespace reference was caught by the initial local TypeScript check and corrected before release.
