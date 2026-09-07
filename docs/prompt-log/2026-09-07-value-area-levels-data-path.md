# Prompt

> I clicked on, you know, Quantdesk levels and chart indicators, and I clicked value area, and they're not showing up. Nothing's showing up when I press that. We need to fix it.

# Diagnosis

- The Value Area button, per-pane state and chart-level renderer were already connected.
- Production returned no lines because the API could not build both completed
  profiles. It still depended on a retired historical provider for the week.
- The VPS archive builder selected only the first trading-date file for a
  multi-session weekly window.
- Archive GAP records store numeric epoch milliseconds, but the integrity scan
  used `Date.parse`, under-counting interruptions and making a compromised tape
  look cleaner than it was.

# Fix

- Added the licensed Rithmic History Plant volume-profile-minute replay as the
  authoritative completed-profile source. It supplies exact volume at each
  price, including aggressor classifications, without inventing OHLC-derived
  volume distribution.
- Serialized and coalesced replay work on the VPS so concurrent users do not
  open competing account sessions.
- Updated daily and weekly Value Area routing to prefer complete Rithmic
  profiles before the retired compatibility fallback.
- Repaired weekly archive folding across every trading-date file and numeric
  GAP/DROPPED timestamp accounting. A compromised recording remains rejected.

# Verification and outcome

- Unit and TypeScript checks pass.
- Live isolated VPS verification returned 1,379 daily profile minutes and
  6,899 weekly profile minutes for NQU6. The resulting daily and weekly
  VAH/POC/VAL/VWAP profiles were complete with zero integrity gaps.
- After deployment, enabling **KwantDesk Levels → Value Area** draws the prior
  day and prior week levels from Rithmic rather than silently producing an
  empty overlay.
