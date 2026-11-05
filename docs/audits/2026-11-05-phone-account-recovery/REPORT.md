# Phone account restoration: unavailable service and recovery safety

## Live observations

An isolated signed-in KwantDesk Settings tab returned the auth recovery shell and exhausted its bounded automatic retries. No owner trading tabs were refreshed. The configured public Supabase signing-key endpoint exceeded9000ms from the laptop and12002ms from the VPS, with no response body in the latter probe. A public, zero-row preferences schema query also exceeded9000ms; health returned200 in4673ms. These are dependency-reachability observations, not a successful authenticated preference read or proof of a global provider outage.

The Supabase administration dashboard is signed out in connected Chrome. No project metrics, database logs or actual owner cloud snapshot were available. Therefore the phone's real account identity, last acknowledged save, current cloud snapshot and end-to-end restoration remain unverified. No database restart, spend increase, account/order/workspace reset, private credential disclosure or saved-data edit was performed.

## Confirmed code defects and repairs

Initial preference loading returned null after transport errors. A fresh browser could treat this as an empty account and publish its defaults if a subsequent CAS read recovered. A primary-store outage could also fall through to an older legacy store, creating a divergent writable authority. Finally, the sync loop treated its initial browser capture as an acknowledged baseline when hydration had failed.

- Initial reads now distinguish unavailable/corrupt data from confirmed absence, failing without writing or changing local storage.
- Legacy fallback is allowed for explicit absent-schema errors only. Transport, authorization, corrupt-state and write failures preserve local edits and stop the attempt instead of choosing another writable store.
- A sync loop without an acknowledged account snapshot performs a read-only first exchange. It restores the real account revision before permitting later uploads, retains edits made during the exchange and uses the existing bounded retry/focus recovery.
- Existing acknowledged desktop/offline edits continue through the existing three-way merge and CAS path. No polling frequency was increased.

## Verification

50 targeted tests pass, covering failed first hydration without default publication/storage mutation, read-only fresh-phone recovery, valid legacy-schema migration, primary outage/corruption, unavailable legacy reads, existing account merges, themes, custom themes, save deadlines and stop/target reconciliation. The deadline test now requires one failed store read rather than attempting a second store after timeout. Scoped ESLint passes. The isolated full production build and exact production deployment receipt are recorded alongside this report.

This repair does not restore a stalled Supabase project and does not establish a physical-phone roundtrip. Project administration access and a successful real two-device receipt remain necessary to close the reported mismatch.
