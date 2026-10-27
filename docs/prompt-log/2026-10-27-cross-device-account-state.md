# Cross-device account and workspace state — 2026-10-27

Request: same Google login on phone and computer must restore the same workspace and active demo trade state.

## Diagnosed faults

The sync hook only uploaded snapshots and did not receive revisions from another open device. Unconditional whole-row upserts allowed stale devices to replace unrelated new state. Saves could fail without rejecting. Selected paper account, global favourites, chart links and professional drawing keys were missing. Mounted charts/drawing layers did not consume later restored values. Home and Accounts lacked the workspace/settings shell's preference lifecycle. Same-owner theme preservation could pin an older device theme over a newer account theme.

## Implementation

- Existing authenticated/RLS-scoped stores remain the backend. Each mutation reads current state, rebases changed keys and compares the database updated_at revision before updating. Conflicting writes retry; malformed/error responses do not clear valid local work. Failed saves retain the last acknowledged base for retry and offline restart rebasing.
- Realtime channels carry EMPTY change hints only, never preferences or trade data. A recipient fetches its own authenticated row. Focus/online and a 30-second visible-tab recovery read supplement hints. It does not require publishing the preferences table to database change streams. Writes debounce at 300 ms; no Vercel market polling or tick stream is added.
- Quote marks/watermarks/unrealised excursion tracking do not dirty the cloud ledger. Stop/target edits, orders, fills and account changes do. Acknowledged cloud state stays distinct from edits arriving during a request.
- Three-way demo reconciliation preserves independent trades, closed positions, target fills and durable journal evidence. Shared resting orders and observed exit stages have deterministic position/target/fill identities, preventing duplicate economic fills from two observers. Existing records retain their IDs.
- Workspace, drawing and selected-account consumers restore received changes in place. Home/Accounts participate, newly tracked same-owner settings migrate, and newer account themes win over older local themes. Receiving a trade does not remount GEX DATA/Kwanty or clear their caches.
- No owner account, order, position or journal was created/reset/closed for verification. No provider configuration or VPS restart.

## Verification and limits

115 focused checks pass (113 account/trading/theme/journal/precision checks plus two actual frame-handler isolation tests). They exercise two-client CAS races, receiving peer changes, no echo loop, 100 unchanged events without additional requests, missed-notification focus recovery, duplicate partial targets, stable resting-order identities, closed-position finality, concurrent resets, unsent desktop edits with newer phone settings, ownership isolation and failed saves. TypeScript, scoped library/component lint and full production build pass. The five source-text failures in paper-trading-integration reproduce against HEAD (16/21 legacy assertions pass); those tests were not weakened.

A physical phone/independent Google-auth browser session has not been operated. Same-origin tabs share browser storage and are not claimed as an independent-device proof. Reload both devices once after deployment so neither retains the old unconditional writer.

This is account-state replication, not a server-owned simulator. Demo protection/execution remains browser-driven and needs a connected execution workspace. Guaranteed unattended fills with all browsers closed remain an OPEN backend requirement. Mobile suspension and network loss can delay receipt; source timestamps and actual execution facts are preserved rather than invented. Existing provider parity/archive completeness/off-box backup gates remain open.
