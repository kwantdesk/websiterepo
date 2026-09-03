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

Pending implementation and production verification.
