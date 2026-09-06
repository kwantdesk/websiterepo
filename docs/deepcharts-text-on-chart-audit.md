# DeepCharts Text on Chart audit — 2026-09-07

Official reference: https://helpdesk.deepcharts.com/portal/en/kb/articles/text-on-chart

- Public help and the licensed DLL expose exactly four settings: Font Size,
  Text Color, Back Color and Text. The screenshot shows a `30.00` default font;
  DLL metadata confirms a maximum of 50.
- The official chart screenshot places the note at the chart viewport's upper
  left, independent of candle time and price.
- KwantDesk now renders a fixed, multiline upper-left note with the same four
  controls, a 2,000-character/20-line safety bound, shared sliders/templates,
  theme/custom colours and stored-setting normalization.
- The hidden carrier series is excluded from autoscale, so a note cannot move
  the price axis or invent chart history.
- Five focused tests, TypeScript and isolated browser QA pass. Browser QA
  edited and saved a two-line note and verified its fixed placement. Native
  font rasterization/padding parity is not claimed.
