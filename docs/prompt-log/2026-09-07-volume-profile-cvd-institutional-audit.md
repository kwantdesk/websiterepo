# Volume profile and CVD institutional audit

## Prompt

The owner asked for a like-for-like check of Quantdesk volume profiles against
the open Deep Charts installation and its backend, with particular concern
that Quantdesk CVD appeared less accurate.

## What was checked

- Read-only production gateway health, current NQ one-minute executions and
  candles, a seven-calendar-day historical NQ window, and a developing daily
  NQ volume profile.
- Licensed Deep Charts assembly metadata for the CVD input, filter, session
  reset, average/deviation and zero-line controls already mapped in Quantdesk.
- Quantdesk's time-bar and event-bar flow hydration, cumulative calculation,
  gap/reset behavior, live sampling, profile data source, value-area grouping,
  POC/VAH/VAL, session splitting, Composite routing and rendering contracts.
- The native app side-by-side visual pass could not be performed because the
  installed Windows inspection bridge reported that its trusted desktop RPC
  service was not configured. No visual result was invented.

## Fixed

- Preserved aggregated historical flow tuples instead of truncating away their
  ask/bid totals, trade count and `flow` marker.
- Prevented a bounded or aggregated indicator tape from overwriting exact flow
  already baked into range, volume, tick and Renko bars.
- Allowed only exact executions to repair a genuinely missing event-bar flow
  value.
- Added focused regression coverage and refreshed three stale volume-profile
  source-shape checks to follow the current implementation.

## Outcome

- Current NQ one-minute classified flow reconciles exactly: delta is ask minus
  bid for every verified bar.
- The developing daily profile had complete requested coverage and internally
  exact row/total/POC identities.
- The profile calculation, session, structure, grouping, split, delta-bar,
  extension, gradient, docking, zoom and Composite suites pass.
- CVD settings, candle direction, hydration, gap segmentation, continuity,
  session sampling, flow healing and event alignment pass.
- The remaining evidence-backed limitation is old aggressor coverage: the
  sampled seven-day archive classified 79.179% of total NQ volume while the
  current session classified 99.752%. Missing sides remain excluded rather
  than guessed. Exact tick-side historical backfill is still required for
  complete older-session parity.
