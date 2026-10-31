# Daily Volume Profile: separate Globex and Asia

The owner reported that the 08:00 Brisbane opening profile was labelled Asia, while Asia should begin at 10:00. They want to keep Globex and New York independently of Asia/London.

## Cause and correction

The shared profile resolver deliberately used an older three-window contract: its Asia range began at 17:00 Chicago and contained both the Globex-opening tape and the later Asia tape. The profile controls offered only Asia/London/New York, and the daily workspace's enabled-session set omitted Globex. This disagreed with the desk clock's separate opening session.

The named split now resolves four independently selectable profiles:

| Profile | Start | End |
| --- | --- | --- |
| Globex | 17:00 America/Chicago | 09:00 Asia/Tokyo |
| Asia | 09:00 Asia/Tokyo | 02:00 America/Chicago on the trading date |
| London | 02:00 America/Chicago | 10:00 America/Chicago |
| New York | 08:30 America/Chicago | 15:00 America/Chicago |

Asia's start is fixed at 00:00 UTC / 10:00 Brisbane. Globex opens at 08:00 Brisbane during US daylight time and 09:00 during US standard time. The previous clock's winter Asia handover is corrected too. London/New York's pre-existing overlap is preserved. Explicit RTH, Overnight and custom filters retain their meanings.

The persisted `triple` mode name remains for compatibility. `sessionGlobexEnabled` now reaches defaults, normalization, the settings dialog's shared session list, requested-session identities, the daily workspace's range filter and its effect dependencies. Explicit saved Globex/New York choices survive. For older settings with no Globex flag, it inherits the old merged Asia flag; this preserves prior coverage rather than guessing which half of that old combined window the trader intended. No remote user preference/account records were overwritten.

Session endpoints are converted from calendar clocks with the exchange timezone instead of adding fixed elapsed hours to midnight. A bounded shared cache avoids repeated conversions across panes. This prevents one-hour displacement in history ranges that cross US daylight-saving changes. Named split windows that would open Friday/Saturday evening are excluded, preventing closed-weekend windows from folding onto Friday via the last-trading-date helper.

The same resolver is consumed by daily profiles, session-profile variants and the existing server-side filter adapter. Live/replay profiles use the same exact start/end ranges. No price data or source recordings are edited, and there is no gateway restart or provider-subscription change.

## Verification

- `node scripts/test-volume-profile-globex.mjs`: 14 passing behavioural regressions, including volume assignment immediately before/at the handover, both US clock changes, Friday/Monday ownership, a multi-day historical request across autumn DST, exchange midnight, saved selections, legacy migration, idempotence and variant request/cache boundaries. The actual daily workspace planner is extracted from its TypeScript AST and executed for three dates with both end-session toggle values.
- Ten existing profile/session suites pass: sessions, selection, toggle, filter adapter, split identity, desk clock, settings-live, data/grouping, composite and replay profiles.
- Existing test guards were maintained: the split-identity guard now names the current trading-date helper; schema bookkeeping excludes `weeklyWindowSettingsVersion`; chart-wiring guards select the actual `/Chart.tsx` rather than the newer `AlgoChart.tsx`; grouping checks exercise the existing extracted render helper instead of obsolete inline source text. No grouping/rendering behaviour was changed for this task.
- Eight isolated headless Chrome settings scenarios pass against the actual `ChartIndicatorsControl`: correct restored selection, independent Globex/Asia changes, final-session guard, restored Globex/New York selection and actual callback/result state. No page errors; auth/preferences/network isolated from production. Temporary evidence remains in ignored `tmp/`.
- Scoped ESLint and full Next production compilation, TypeScript and prerender checks pass. Giant chart/workspace components are covered by the production build rather than memory-heavy standalone compiler lint.

Release: stage only this task's source/tests/log and its own handoff notes; push main once through the existing production integration and verify deployment success plus the actual live commit. No new infrastructure or paid services.
