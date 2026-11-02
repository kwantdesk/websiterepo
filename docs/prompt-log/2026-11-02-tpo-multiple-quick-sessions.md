# Multi-select TPO Quick Sessions

Quick Session buttons independently toggle any combination of RTH, Globex, New York, London, Tokyo and Sydney. The shared preset catalog drives each separate calculation using its own IANA timezone and session boundary. Profiles keep unique session-qualified identities and their own rows/totals; overlapping sessions are not merged. Removing a session removes only its profiles. Clearing the final selection restores the venue default schedule. Selection survives settings/workspace serialization, cache identity and replay; existing single-session presets migrate. Manual clock edits switch back to custom schedule; appearance edits retain selections.

The single-developing-profile cache optimization is bypassed for multi-session schedules, preserving every session history while live profiles update. Weekly/custom-range modes retain existing behavior.

Validation: 23 passing tests in tests/tpo-profile-engine.test.mjs and tests/tpo-quick-sessions.test.mjs. Includes independent toggles, serialization, invalid/duplicate selection cleanup, all six combined profiles matching standalone boundaries/rows/totals over New York DST, unique IDs, removing only the selected session, and custom/default behavior. Full production build required before one main/yfmi release; verify Ready/public SHA. No market-data restart.

Final production build passed. Settings wiring: 6/6 checks passed. An additional legacy default-visuals script has a stale regex expectation for primitive.ts left-edge clamping; primitive.ts is unchanged from HEAD, so that unrelated check was recorded without modifying the renderer.
