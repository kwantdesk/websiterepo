# Compact GEX Bot toolbar — 2026-10-20

User requested Workspaces / Add Tool / Settings toolbar match other pages.
Actual /gexbot dashboard is GexBoxDashboard, labelled GEX BOX in the menu.
Live baseline: 44px row, 32px buttons, 13px/500 generic site typography;
the three controls also had different letter spacing.

Use the shared 36px shell height and the exact 28px/10px/600 command-control
CSS contract. Compact title replaces oversized badge and subtitle; hide brand
on mobile and retain accessible icon-only Settings below420px.
Workspace apply/save/import/reset, Add Tool and style Settings callbacks intact.
No market-data, workspace layout, palette or saved-panel changes.

Validation: seven focused toolbar/timezone/embedded-height tests pass, scoped
component ESLint passes, workspace tests13/13 and theme tests9/9 pass, dashboard
architecture checks pass. Full production build/typecheck passes,84 pages.
Two old chart-workspace-toolbar-alignment source assertions fail on current
HEAD too (retired three-column shell row and retired two-row CSS layout);
confirmed with git-show baseline, not altered or claimed as passing here.
Release receipt pending.
