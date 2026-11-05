# Chart Trade ticket stays open

Owner reported that clicking the chart after opening its Trade ticket closed the ticket. Requested persistent toggle behaviour.

Removed the inline ticket's document-level capture `pointerdown` dismissal effect in `KwantifyWorkspace.tsx`. The existing chart Trade toggle and ticket X remain explicit close controls. Chart clicks, panning and drawing no longer dismiss the ticket. No execution, account, quote, protection or backend logic changed.

Verification: an isolated runtime exercised the actual source JSX handlers and original dismissal effect before/after. Before: first chart pointer press closed the ticket. After: ten chart pointer presses retained the open/expanded state; clicking the same Trade button closed it, with no global dismissal handler registered. This is a source-handler regression check, not a live owner trading-browser test.

Existing paper-trading integration suite:15pass/6fail. All six source-pattern failures reproduced on clean unchanged052a7fb5 in the isolated release checkout; no new failing cases. Full isolated webpack/TypeScript production build and deployment verification are recorded in the local release receipt once complete. No gateway restart or owner trading-tab refresh.
