# Prompt — finish every Pending indicator using DeepCharts evidence

## Request

Continue engineering each pending indicator from real DeepCharts documentation
and the licensed local DLL instead of leaving catalogue placeholders.

## Fix

Implemented Gap Detector from its public behavior and exact read-only DLL
settings contract: Day begin/Always, Tick/Percentual thresholds, whole-bar or
first-touch retirement, opacity, up/down colours, templates and theme linking.
Added an efficient calculation engine and a chart-attached canvas renderer.

## Outcome

Gap Detector moves from Pending to Add after seven focused tests, TypeScript,
lint and synthetic browser QA of both bullish and bearish zones plus the real
settings pages. The evidence and explicit limits are in
`docs/deepcharts-gap-detector-audit.md`; 26 entries remain Pending.
