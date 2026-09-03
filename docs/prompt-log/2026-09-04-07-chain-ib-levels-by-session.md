# Chain Initial Balance levels by session

Date: 2026-09-04

## Prompt

> ib levels indicator lines also need to function like vp value area ones
> meaning the only ones that should come across the screen is the current one,
> the rest finish in the back of the next session start

## Diagnosis

IBH, IBL and their optional Fibonacci levels were all rendered without an end
time. Consequently every enabled historical session crossed every later
session and continued to the chart's live edge, unlike the volume-profile
value-area chain.

## Fix and outcome

- Added one strict chronological Initial Balance session-boundary resolver.
- Historical IBH and IBL lines now terminate exactly at the next distinct
  enabled session start.
- The newest/current session has no later boundary and is the only IB set that
  continues to the live chart edge.
- Multiple duration sets from the same session do not stop each other because
  15, 30, 45 and 60-minute levels share the same session boundary.
- Optional IB Fibonacci levels use the same boundary as their IBH/IBL pair.
- Historical labels remain attached just inside their terminating boundary;
  the current label remains at the live edge.

## Verification

- IB duration and chain tests pass 8/8.
- Initial Balance calculation, timeframe independence and Globex suites pass.

