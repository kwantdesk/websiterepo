# Remove volume-profile help copy

## Prompt

> Remove the long explanatory text about VAH, POC, VAL, line extension,
> visual style and number of profiles from volume-profile settings.

## Fix

- Removed the instructional paragraph beneath the volume-profile plot controls.
- Removed the component import that existed only to interpolate the default
  profile count into that paragraph.
- Kept every volume-profile control and its behaviour unchanged.

## Outcome

The volume-profile settings panel now ends cleanly after its controls and no
long implementation explanation is shown to the trader.
