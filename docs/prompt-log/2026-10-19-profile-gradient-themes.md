# Daily Volume Profile colour schemes as themes — 2026-10-19

Owner supplied the gradient-scheme picker and requested all those colours as
website themes. Reuse its actual source catalogue, not colours sampled from PNG.

All12 schemes available in Settings → Theme & Colors:
Chromey Mono (retained), Pink → Blue, Yellow → Blue, Orange → Green,
Red → Yellow, Black → White, Pink → Purple, Cyan → Magenta, Lime → Teal,
Violet → Amber, Crimson → Indigo, Red → Lime. Off is not a colour scheme.

Implementation:
-11 new presets derived directly from VOLUME_PROFILE_GRADIENTS. Retained
  Chromey Mono receives preview metadata without changing any colours.
- Shared-source gradient strips in theme cards. Theme chrome uses subtle dark
  tints of each pair. Raw candleUp=to/candleDown=from stay exact; darker endpoint
  UI text is minimally lifted via existing contrast helper to4.5:1. Candle
  outlines meet3:1; black-on-dark gets an outline instead of invisible candles.
- Existing apply/save/chart/custom-setting semantics unchanged. No forced
  selection change or rewriting user profile gradient choices. No animations,
  feed changes, provider traffic, paid resources or new polling.

Verification:
-29 focused theme tests pass, including all12 source mappings, exact endpoints,
  no duplicate Chromey Mono/Off, complete token sets,75 total themes, readable
  UI/directional outlines, Liquidity Map, existing20 diversity and theme sync.
- Compared prior64 named colour objects to HEAD: unchanged.
- Scoped ESLint and full84-page production build pass. Release verification pending.
- All12 local token previews inspected together in background browser; tab and
  temporary server closed. Not a signed-in Settings save/roundtrip proof.
- The previously recorded workspace source-pattern test failure, history gaps,
  stable-streaming/footprint UI soak and weekly completeness remain open.

Release: pending single scoped main push and exact public SHA verification.
