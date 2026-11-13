# Delta Bar and Delta Profile audit

## Reference

- The local Deepchart.dll exposes VolAnalysis.Properties.IndicatorDescriptions.get_Delta_Bar. Its readable CIL consists of a null-returning resource stub. Managed metadata was partial and did not expose a usable study calculation. REA evidence ev_a12df5bac3581754042fa7b44cb596f404671fe19aa1a9cbe7c27d12e644e958. The installed artifact was inspected statically.
- DeepChart documents execution delta and Candlestick, OHLC and CandleBody styles. The screenshot is consistent with Candlestick. Its exact provider-side aggregation and input database cannot be established from the screenshot. [Delta Bar](https://helpdesk.deepcharts.com/portal/en/kb/articles/delta-bar)
- DeepChart documents signed aggressive volume at each price and shared Deep Profile settings, including time windows, tick grouping and developing POC. [Deep Profile](https://helpdesk.deepcharts.com/portal/en/kb/articles/deep-profile-volume-delta-profile)

## KwantDesk

- Delta Bar used a zero-to-close histogram and discarded the recorded intrabar path. It now defaults to a candlestick, with a zero open, an ask-minus-bid close and the validated high/low of that candle's running delta. Body-only and OHLC styles, minimum and maximum absolute final delta, and wick/OHLC width are selectable. The existing side ladder remains a separate mode. Missing or implausible extrema cannot draw wicks.
- Delta Profile requests historical developing POC, value area and VWAP when enabled. Rows can display while those trails are still loading. Profiles use their own settings, including split sessions and count, when projected onto a cash index. Fixed width now respects the 400-bar control, signed rows scale by absolute delta, and the opacity and POC highlight follow the rendered rows.
- Recorded NQZ6 on November 12, 14:30–16:00 UTC returned 444 signed price rows and 90 samples each for developing POC, value area and VWAP before the requested cutoff. A longer window returned the histogram before the trails, then returned 304 samples per trail on repeat. These are gateway checks rather than a matched DeepChart live capture.

## Remaining

- Matched live DeepChart comparison and historical cash-index projection parity remain unverified. The cash projection still uses the existing futures-to-cash price basis.
- Event and clock windows without trustworthy recorded intrabar extrema only draw the net body. This change adds no substitute for DeepChart's aggregate-trade and order-data modes.
- Two pre-existing profile renderer matrix failures reproduced on the baseline. They concern Bid/Ask colour rendering and combined line/solid volume geometry.
