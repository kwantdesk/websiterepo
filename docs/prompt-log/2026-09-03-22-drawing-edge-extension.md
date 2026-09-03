# Drawing edge extension

## Prompt

> tool thing, eg if i draw a rectangle then double click for settings i should be able to hit extend right / left / both and then itll go to the end of the page, flush with the edge not infront, behind if anything.....

## Diagnosis

The professional drawing settings correctly stored `extendLeft` and
`extendRight`, but Rectangle used only its two anchor coordinates for painting
and hit testing. The controls therefore changed persisted state without
changing the drawing.

## Fix

- Rectangle fill and border now resolve their horizontal span from the saved
  extension options.
- Extend Left ends at the visible chart pane's left edge; Extend Right ends at
  its right edge; enabling both spans the full pane.
- The underlying time anchors are preserved, so disabling extension restores
  the trader's original rectangle.
- Hit testing uses the identical extended bounds.
- Rendering remains inside the series primitive pane, underneath the price
  scale and application chrome.

## Verification

- Drawing edge regression: 6/6 passed. It covers unchanged bounds, left,
  right, both, the Rectangle class's full-width computed geometry, and hit
  testing inside the extended area.
- Existing drawing anchoring regression: 7/7 passed.
- Existing drawing handle regression: 10/10 passed.
- Focused ESLint: passed with zero warnings or errors.
- TypeScript: passed.
- Production build: passed; all 80 static pages generated.
- Implementation commit `7e719dc7` reached `main`; the signed-in production
  chart loaded successfully from deployment `dpl_FSEU1i2dLhqwZLz2JXfbXYgDGyZs`
  with the Rectangle tool and both edge-extension controls available.

## Outcome

Rectangle no longer has fake extension settings. Left, right, and both now
reach the corresponding visible chart edges exactly, remain below the chart
axis/chrome, and stay selectable across the extended area.
