# Bounce Levels side labels

The owner requested a switch to hide the wording beside Bounce Levels, with side labels disabled in stock settings.

`showLabels` already defaulted to false, but the chart's linked-map branch replaced that choice with GEX Map's role-label setting. Full view could independently force exposure values on. The new **Show side labels** checkbox in Bounce Levels settings updates the existing per-indicator `showLabels` preference. The chart now obeys that local preference; when it is off, mirrored role/price text and exposure values are both hidden. Turning it on shows the level wording and allows values selected by the existing linked view. The GEX Map page's settings are not changed. Legacy non-mirror value-only behaviour is preserved.

The change affects presentation only. Node values, history, colours, mapping, tooltips and provider requests are unchanged. Explicit saved on/off choices are retained; stock and missing values resolve to off.

Validation:

- Seven focused isolated browser scenarios use the actual Bounce settings component, actual mirror hook and actual canvas primitive. Render flags are extracted from the production Chart TypeScript AST. Stock text is absent, enabling the switch paints text, linked settings remain unchanged, Full-view values are available when on, disabling hides both text forms in Full view, and each preference survives a reload. Canvas text calls are observed on the primitive's own layer. No page errors; all data/auth/storage are isolated fixtures.
- All 34 existing Bounce/GEX Map parity checks pass, including recorded-node parity where the local fixture is available.
- Scoped settings-component ESLint passes. The full production build covers the large Chart component.

Release uses the existing main-only production Git connection, with deployment completion and actual live commit checked before reporting it live. No gateway restart or account/trade changes.
