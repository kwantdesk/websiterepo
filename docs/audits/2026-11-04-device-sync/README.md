# Laptop and phone account workspace sync

Owner request: the same signed-in account must restore charts and charting on a fresh phone and propagate edits in both directions without restarting market data.

## Confirmed source defects and corrections

- Workspace persistence commonly used `writeProtectedItem` without notifying the same document's account sync listener. Browser storage events do not fire in the writing document. Successful writes to account-owned keys now emit one batched microtask notification. Cache writes and writes into other Storage objects do not emit it.
- The trailing 300 ms sync timer restarted on every event. Continuous live events could indefinitely postpone a genuine workspace edit. The first event now retains a bounded deadline. Fingerprint comparison still suppresses unchanged writes. Failed cloud attempts retry with the existing bounded exponential backoff.
- Candle visibility, per-pane candle styles, crosshair links and the actual v2 layout lock key were absent from the sync allowlist. They are now tracked. Incoming visibility/style/link changes also update Workspace React state.
- Initial layout/tree/pane/watchlist/chart-appearance persistence could execute before account hydration. These writes now wait for preferencesReady. Charts, Gamma and Algo storage scopes remain separate.

The existing authenticated per-owner CAS storage, merge rules, drawing clear barriers and paper-trade protection merge remain in use. No market prices are broadcast as preference state, and quote-only paper marks remain excluded from the meaningful account fingerprint.

## Verification

- 30 focused controller, account merge, request deadline, frame isolation, storage notification and replay-drawing tests pass.
- Additional drawing-race suite: 6/7 pass. The remaining pre-existing source-extraction harness fails because Chart's `onUpdate` references `updateSvgDrawing`, which the harness does not declare. Chart.tsx is unchanged in this task. This is not reported as a passing suite.
- Scoped ESLint passes; TypeScript check passes. Full Next.js production build passes.
- `scripts/audits/device-sync-browser.cjs` runs the actual React Workspace, chart, account hydration, sync controller, storage writer, drawing store and paper engine in two independent Chromium contexts. Desktop is 1440x980; phone is 390x844 with touch/mobile behavior. Only authenticated database CAS and realtime hints are replaced by isolated HTTP/SSE transport; external requests are blocked.
- Eight browser checks pass with zero page errors: automatic layout upload; fresh-phone two-pane restore with one full-width visible chart; desktop drawing transfer; reverse phone edit; demo account/open position transfer; phone stop edit retained on laptop; desktop close transferred to phone; no save starvation during 40 ms event bursts.
- Captured fixture latency: drawing 755 ms, reverse preference edit 689 ms, account/open trade 984 ms. These are local integration measurements, not guaranteed production network latency. See result.json and phone.png.

## Scope and limits

No VPS/feed/terminal restart, subscription reset, production test trade, account deletion or live trading-tab refresh. This is account-state synchronization, not pixel streaming: both devices render their own charts using shared account settings. Suspended/offline phones cannot receive updates continuously; existing focus/online recovery catches up when active. Physical-phone and real Supabase multi-device delivery were not impersonated as tested; existing production RLS/realtime availability and device connectivity still apply.

Release: one scoped main push through the existing production Git integration; verify the exact production commit after deployment.

