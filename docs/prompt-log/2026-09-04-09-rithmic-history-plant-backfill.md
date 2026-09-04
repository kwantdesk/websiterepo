# Prompt

Import trustworthy historical candles for every enabled futures instrument from
the start of 2025 now, using Rithmic History Plant rather than waiting for the
live recorder to accumulate them.

# Work completed

- Confirmed the production credential can log in to Rithmic History Plant
  (`rp_code 0`) without competing with the live Ticker Plant session.
- Added the licensed replay protocol messages and their documented wire IDs:
  time bars 202/203, tick bars 206/207 and volume-profile minute bars 208/209.
- Built a standalone, sequential History Plant client with heartbeat, bounded
  request timeout and one in-flight replay at a time.
- Built an atomic, checkpointed minute-bar importer. It rejects structurally
  invalid OHLC, merges idempotently with existing session files and records
  rows, invalid rows, sessions and response bytes in its state ledger.
- Enforced a 36 GiB internal weekly safety ceiling below Rithmic's published
  40 GB allowance.
- Verified that historical continuous data must be requested by product root
  (`NQ`), not an expired contract (`NQH5`). A January 2, 2025 NQ pilot returned
  1,380 genuine minute bars with zero invalid rows.
- Added chart-history fallback from today's exact contract file to the same
  product's History Plant root file on older sessions. Exact recorded contract
  data always wins, and micros never fall back to minis.
- Added a restart-safe queue for all 53 enabled CME, CBOT, NYMEX and COMEX
  product roots, ordered with the main equity-index contracts first.
- The provider rejected a single 20-month replay with code 12 (`output
  inhibited`). The importer therefore requests seven-day windows and commits
  each independently; the same NQ week then completed with 5,581 valid bars.
- Added a boot-enabled systemd unit which requires both Docker and the
  dedicated recordings mount. It resumes unfinished checkpoint windows after
  VPS maintenance and catches up newer dates without re-downloading completed
  windows.

# Outcome

Historical minute candles can now be imported from January 1, 2025 and served
through the existing chart-history route at every time interval of one minute
or greater. The live raw recorder remains the authority for future L3/MBO.
Historical individual trades and volume-at-price minute bars are the next
budgeted phase for sub-minute, range, volume, tick and Footprint replay; minute
OHLC is not misrepresented as those data types.

# Verification

- History Plant production login: accepted.
- January 2, 2025 `CME:NQ` pilot: 1,380 rows, 0 invalid, 202,849 bytes.
- Current-session `CME:NQU6` control: 1,380 rows, 0 invalid, 205,372 bytes.
- January 1-7 bounded `CME:NQ` window: 5,581 rows, 0 invalid, 818,737 bytes.
- Gateway focused tests: 15/15 passed.
