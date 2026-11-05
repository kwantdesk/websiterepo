# Per-chart drawing lock

Owner request: a lock button immediately after Trade and before Link on each chart, protecting all chart drawing tools while panning/zooming, including on phones.

Added a separately persisted `drawingsLocked` pane setting and button in docked and floating chart headers. It does not use the layout/pane pin. The shared Chart forwards read-only state to SVG and precision layers, cancels active drafts/selections, disables native drawing interactions and guards delayed geometry mutations and editing shortcuts. Unlock restores drawing interaction without rewriting individually locked native drawings. Actual order execution and SL/TP controls are unchanged.

Touch regression testing exposed a cancelled SVG line drag retaining window listeners. Its cancellation now removes those listeners, preventing a subsequent pointer movement from relocating the drawing before the lock button is pressed.

Validation: 207 focused drawing tests pass. Isolated actual Chart browser fixtures pass desktop mouse and mobile touch checks: unlocked line moves; pressing lock itself preserves geometry; locked gestures pan the chart without changing anchors; the other pane is unchanged; unlocking restores editing; zero browser errors. Every SVG drawing-tool fixture retains its visible geometry with no editable hit surface while locked. Native manager tests cover cancellation and preservation of individual locks; actual workspace handlers cover per-pane toggling and normalization/persistence. The test fixtures use synthetic candles and isolated local browser contexts, with no provider requests or owner workspace interaction.

Reproduce unit checks:

```
node --experimental-strip-types --import ./scripts/alias-hook.mjs --test tests/chart-drawing-lock.test.mjs tests/drawing-painted-hit.test.mjs tests/chart-drawing-clipboard.test.mjs tests/drawing-edit-history.test.mjs
```

Browser runner: `scripts/audits/chart-drawing-lock-browser.cjs`, fixture `tests/fixtures/chart-lock-qa.tsx`. Set `KWANTDESK_PLAYWRIGHT_MODULE` to an installed playwright-core module if the local tmp installation is absent. Results/screenshots are local under `tmp/chart-lock-*`. Mobile verification is Chrome touch emulation, not a physical phone. Saved lock roundtrip between authenticated devices is not independently verified by this fixture.

Scoped lint and the full isolated webpack production build passed, including TypeScript and all 86 static pages. Release uses one scoped main Git-integration deployment with public commit verification. No gateway restart, subscriptions, account, order, infrastructure or paid-service changes.
