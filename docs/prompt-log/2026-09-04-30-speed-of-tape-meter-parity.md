# Prompt 30 — Speed of Tape levels and bar parity

## Requested

Keep the working Speed of Tape calculation, but investigate why its internal
bars and levels do not look like Deep Charts and make the stock presentation
and settings match.

## Diagnosed

- The installed Deep Charts 16.0.9 assembly confirms the stock contract:
  Volume, filter minimum 1, filter maximum 0, Total, 10 seconds, three bars,
  scale minimum 0, line width 1 and plot reversed off. KWANTDESK already used
  those defaults.
- Deep Charts also exposes text enabled, size and colour properties which the
  KWANTDESK settings record did not contain.
- KWANTDESK positioned its SD levels against the full rail while its columns
  used a shorter area above the footer. They therefore did not share a scale.
- The auto scale forced the largest reference—normally SD+2—to the very top;
  Deep Charts visibly preserves meter headroom. KWANTDESK labels were also
  undersized relative to the supplied reference capture.

## Fixed

- Levels and bars now share exactly one plot rectangle.
- The footer is a fixed 16-pixel strip and disappears cleanly when text is off.
- A stable ten-percent top margin reproduces Deep Charts' meter headroom.
- Three bars retain equal widths with two-pixel gutters, a two-pixel minimum
  visible height and border widths calculated inside their geometry.
- SD labels and the `S-T(10) V` footer use configurable text size/colour;
  text-enabled, text-size and text-colour settings now save with the indicator.
- Theme mode keeps the footer readable and uses the resolved visible positive
  colour for SD references. The unsampled instant Rithmic execution path and
  calculation are unchanged.

## Outcome

The stock settings continue to match Deep Charts while the rail's bars,
references, spacing, headroom and labels now follow the supplied reference
geometry. Calculator and advanced Tape Speed regressions, lint, TypeScript and
the production build are the release gates for this change.
