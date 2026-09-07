# Prompt — Speed of Tape (Instant) meter-candle parity

## Request

Compare KwantDesk's Speed of Tape (Instant) with the licensed DeepCharts
reference. The KwantDesk rail had no wicks and its candles behaved differently.

## Diagnosis

- The KwantDesk renderer drew one solid rectangle for each speed window. It
  discarded the separate shadow/body visual contract exposed by the reference,
  so a wick could never appear.
- The body used total activity. That made balanced two-way bursts look like
  strong directional candles instead of showing the difference between total
  tape speed and directional participation.
- `Plot reversed` reversed the historical bar order. The reference setting is
  a vertical plot-orientation switch; it must not move the newest bar away from
  the right edge.
- The Windows control service was unavailable during this pass, so the two open
  applications could not be sampled directly. The comparison used the supplied
  screenshots, the vendor's current public documentation and the licensed
  assembly's exposed settings contract. No protected implementation was copied.

## Fix

- Each stock Total meter candle now has a full-activity shadow/wick and an
  absolute execution-delta body, colored by the delta sign.
- The shared scale and SD baselines now use full tape-speed extent, not the
  smaller body.
- Reversed mode now flips the vertical candle and SD orientation while retaining
  chronological left-to-right order.
- Existing direct-execution, live-update and no-OHLC-substitution boundaries are
  unchanged.

## Outcome

The rail now renders the missing wick/body structure and balanced/high-speed
windows no longer look like solid directional totals. Deterministic fixtures
cover wick/body values, chronology and reversed-coordinate wiring.

## Verification

- `npm run test:speed-of-tape-instant`
- `npx tsc --noEmit`
- `npm run build`

