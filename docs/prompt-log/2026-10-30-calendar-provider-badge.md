# Economic Calendar toolbar — 2026-10-30

Removed the provider/status badge displaying TradingView (or the fallback provider name) from the Economic Calendar toolbar, as requested in the screenshot. Time, timezone and refresh controls remain. This was our React toolbar badge, not an embedded provider logo. Data provenance in event details and feed behavior are unchanged.

Validation: existing calendar-sharing check, scoped ESLint and production build pass. No new tests, backend changes or provider requests were needed for this four-line presentation removal.
