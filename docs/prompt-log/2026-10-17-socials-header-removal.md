# Remove the redundant Socials banner

Owner screenshot requests removal of the complete Socials top identity row:
icon/status dot, Socials / Working title, tagline and right-hand avatar/handle.
Removed that row, not just its text; no empty 64px spacer remains. The existing
Socials view navigation, profile tab, global account navigation and all content
remain unchanged. No data, persistence or backend behaviour changed.

Regression checks the actual JSX header has only WorkspaceSubnav and retains its
existing tab/navigation wiring. All 23 focused profile/header regressions pass;
scoped lint has zero errors (two existing img warnings). The isolated production
build, including TypeScript and 80 pages, passed. Signed-in visual QA is unverified.
Standing open history/VPS/live-soak/capacity items remain in IMPORTANT-NOTES.md.
