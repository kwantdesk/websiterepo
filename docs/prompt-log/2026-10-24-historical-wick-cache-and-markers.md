# Historical wick integrity: cache writes and minute markers

## Owner report

Historical candle bodies/wicks continue to change, truncate or disappear after
the earlier live-observation protections. Those protections did not repair old
import timestamps or discarded historical cache corrections.

## Demonstrated causes

1. `chartHistoryCache` skipped writes by count/first/last/tail OHLC identity.
   Older high/low and flow corrections were ignored. Three new regressions fail
   on the original source: older wick write, derived3m invalidation and older
   flow update. Durable-adapter test additionally evicts memory and restores
   the corrected high115/low92 from a controlled asynchronous IndexedDB mock.
2. Imported History Plant minute files saved closing markers as opening times.
   The exact-trade validator already subtracts60000, but the minute importer
   and archive reader did not. Real Oct19 NQ root vs NQZ6: zero exact OHLC
   matches/1349 overlaps at unadjusted times;1335/1348 match at-60000. Remaining
   differences are not certified repaired: recorded tape can be partial.
   New gateway regression originally returned3bars instead of2 and gave the
   prior minute's shape to the next candle.3m regression confirms normalization
   occurs before aggregation so a real extreme is not put in the next bucket.

## Repairs

- Cache skip requires exact full-series fields, not only tail identity. Explicit
  field comparison avoids allocations/dynamic property scans:120k rows measured
  0.54–2.57ms in seven local runs (not an end-to-end browser performance claim).
- Memory-derived compatible timeframes are marked and invalidated when their
  symbol source changes. Independently downloaded intervals/other symbols stay.
- Reader normalizes only identified legacy History Plant minute imports; raw
  exact-trade files and explicit bar-open imports are untouched. No prices or
  on-disk recordings rewritten. Importer now writes bar-open markers explicitly
  and normalizes its legacy rows before merging; it was NOT run for backfill.
- Browser clock-history key time-v3, candle-request cache namespace and timed
  durable-route v7 prevent old mis-timed cache data reappearing. Event-bar schema
  remains unchanged. Existing open pages need one ordinary reload after release.

## Verification

-36focused frontend/cache/CME/live/drawing regressions pass; gateway suite503/503
  before final additional3m test; final archive suite25/25. Scoped lint0errors;
  production build/typecheck84static pages pass. No whole-Chart lint attempted.
- Read-only actual candidate module loaded in a separate gateway-container Node
  process:1380/1380source OHLC values land on exact corrected timestamps.
- Active authenticated HTTPS history after rollout returns1380rows in1645ms.
  Normalized `[timestamp,open,high,low,close]` SHA matches source exactly:
  f89a2f815cf6880696eff7d00f7adf832102e3f54a7cd507378004a7dca578b9.
  This is one complete checked session, NOT all symbols/dates accuracy proof.
- Computer-use skill was used read-only on existing chart tabs. They retain
  open demo positions and were not refreshed, traded or edited. No signed-in
  visual before/after acceptance or market-open soak is claimed.

## VPS activation

- Closed market: only gateway recreated at2026-10-24T01:27:19.139061508Z.
  Same image sha256:03e4532583844fbd800c75e61278591cbc7f4e9a8636bde056c58d9c42802198.
- Replaced content of the existing read-only archive override after hash checks;
  compose and all other vendor/book-store override hashes unchanged.
  New archive SHA10eda742a8e1c209793fc82b354e1ca76958b8609ffe7d227fdb8bccce735c1a.
  Rollback: /opt/kwantdesk/runtime-overrides/futures-bar-archive.before-marker-fix-20261024.mjs
  (prior SHA1914db2a93f247542f47af94d44a95df1882a3146e5436c3efa3e43b88736a23).
- Healthy/connected/authenticated; recorder enabled/no error/backlog/drops since
  restart, archive restored. Other containers retain multi-day uptimes. Past
  recorder gaps are not erased by reset counters. No new provider login owner,
  paid resource, cadence increase, full backend image build or broad deployment.
- Future importer correction is in source; no import job/backfill was launched.

## Remaining gates and worktree

Prior raw gaps/partial sessions and wrong old raw-tape bodies are not rebuilt;
this corrects identified import timestamps and prevents valid cache repairs
being discarded. Full rolling-month/each-symbol validation, vendor parity,
backups/restore/capacity and market-open soak remain open. Dirty native/social/
gateway/docs work is preserved and excluded from the scoped main release.
