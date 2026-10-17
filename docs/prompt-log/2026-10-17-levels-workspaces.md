# Levels workspaces and toolbar

Requested: Levels should operate more like GEX VUE, with familiar toolbar,
linking/moving/saving workspaces, while retaining the level-family dropdown.

Implemented a compact themed workspace shell with single, side-by-side,
stacked, quad and columns layouts; add/duplicate/close/maximize panels; layout
lock; grip drag/drop swaps and keyboard movement; bounded column divider;
matching instrument/timeframe viewport links through the existing Chart path.
Family/instrument/timeframe selections, panel order, split, link/lock and rail
state are saved in named Save As/Quick Save workspaces. Named snapshots remain
separate from the automatically restored working desk; delete requires confirm.

New state key is registered in existing account preferences. Hydration and
cross-tab restore are supported; old local layout migrates only once to avoid
reimporting one trader's legacy state into another account. Failed local writes
cannot falsely report a successful named save. Saved input is validated and
bounded to eight panels/fifty presets; no provider/backend or level-math changes.

Tests: four deterministic normalization/control/persistence cases cover layout
choices, move/drop identity, link, lock, divider, duplicate/close, Save As/Quick
Save, reload and failed save/account hydration. Existing preference hydration
suite and GEX quad template regressions are checked, plus scoped lint and an
isolated production build. These are component-handler tests with chart slots,
not an authenticated browser visual or cross-device Supabase roundtrip test.

Still open platform-wide: full rolling-month history and disconnected provider/
missing execution-session recovery, authenticated chart/indicator soak and
multi-user launch validation remain unresolved; this workspace UI does not
repair or conceal those data gaps.
