# SPY and QQQ blank when 3M selected

Owner screenshot shows both 1m charts reporting "The requested underlying
history exceeds the available archive window" and a 3M loading hint.

The gateway returns verified recent candles with truncated=true when the
requested history extends beyond its available/bounded range. The website
adapter treated that flag as grounds to throw away every candle. Removed that
all-or-nothing rejection for nonempty validated bars, while still rejecting
empty, wrong-instrument and invalid OHLC responses. Typed coverage metadata
survives the server adapter, API and shared browser fetch; a scoped chart notice
states that only available history is shown. Conditional response identity
includes partial status so an unchanged candle set cannot hide a coverage change.

Gateway startup now skips provider fallback for old dates before the oldest
available archive, leaving those to the checkpointed backfill instead of each
user repeating it. Recent gaps/live-tail fallback and existing request limits
remain. No synthetic candles, larger provider quotas or altered selected period.

Real local 90-day requests against the current archives returned SPY 4,050 and
QQQ 4,052 candles covering Oct5–16, in 15/11ms with zero provider calls. Both
remain explicitly partial. Backend source deployed with graceful single-owner
restart (PID3204); public relay checks performed before frontend release.

Verification: 12 focused history/current-session/provider-isolation/first-paint
tests pass; gateway suite 394/394; scoped lint and final isolated production
build pass. Actual website adapter function against the public backend accepts
4,050 SPY / 4,052 QQQ candles with partial=true instead of throwing.
Authenticated screenshot/interactive verification is
not claimed. One-month history recovery, missing futures sessions, provider
recording access, wider indicator regressions and VPS migration remain open.
