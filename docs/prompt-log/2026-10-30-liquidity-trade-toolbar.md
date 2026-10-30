# Liquidity Map Trade placement — 2026-10-30

Moved the map-specific Trade control from the floating price-plot overlay into the existing toolbar immediately before Depth. It inherits the same button dimensions, theme colours, icon styling and narrow-layout treatment as Depth/Signals/Display. The site-wide navigation Trade control remains unchanged.

The iframe sends a ticket-open request to its host, which activates the pane and opens the existing order ticket. Origin, iframe source, instrument and account/instrument scope are checked before handling it. The toolbar button starts hidden and becomes available through the existing trading-host handshake. Trade execution and protection-drag behavior remain in the shared host.

Verification: 13 existing chrome/trading checks pass; scoped ESLint and production build pass. A local headless Chrome fixture loaded the actual map CSS: Trade and Depth share the same row and 28-pixel height, Trade immediately precedes Depth, and the button is hidden before the host handshake. Updated the existing chrome test's stale hardcoded iframe revision assertion to require an explicit dated revision. No gateway activation was needed.
