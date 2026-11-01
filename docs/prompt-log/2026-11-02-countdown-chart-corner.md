# Anchor the candle countdown to the chart corner

Owner screenshot shows the small dash/countdown badge floating above and left of the chart corner. Requests it in the corner of each chart.

Anchor CandleCountdownBadge directly to its chart container's bottom-right corner. Remove the hardcoded56px bottom offset, indicator-pane displacement and dynamic price-axis/right padding, along with the now-unused chartRef/bottom props and rightInset state. Keep the same badge styling with a27px minimum width that grows inward for long labels, visibility, live/closed labels, countdown calculation and1s live cadence. No data, price scale, viewport, indicator, order or drawing changes. The badge occupies the corner beside the time axis instead of floating over the plot; adding lower indicator panes does not move it away from that corner.

Validation: five actual-full-workspace headless Chrome checks with isolated auth/preferences/history—zero measured right/bottom gap at760px and200px pane widths, after adding CVD below, with light-theme badge colours, and long-label fit. Zero page errors/external provider requests; visual chart receipt confirms flush placement. Existing countdown behavioural tests5/5 pass; the sixth pre-existing workspace source guard expects two snapshot activity call sites but unchanged HEAD already contains one. Chart market-activity/countdown logic is untouched, and that unrelated guard is not claimed passing. Full production build passes; no standalone ESLint of the huge Chart file per repository memory guard.

One scoped main-only release to existing websiterepo-yfmi and exact live SHA verification. Preserve unrelated dirty/native work; no ALGO, backend, feed, account or history operations.
