# Remove the snapshot banner everywhere — 2026-10-20

Owner supplied the actual-snapshot/no-full-session-history/no-invented-curve
banner and requested removal anywhere it appears. Repository search found one
generator shared by Classic, State, Orderflow and embedded KWANTY grid tools.
Prior work hid its DOM node, but retained the message generation. This change
deletes both the node and generator. Startup removes a legacy node if an older
cached shell is paired with the new app. App and both host shell versions bumped.

No retention, snapshots, history availability checks, request cadence, source
timestamps, account preferences or market data changed. No extra requests.

21 focused quiet-notice/integration/preferences/dropdown tests pass, including
health updates without a banner element and regression checks against the old
message. Node syntax passes; scoped ESLint has zero errors and one existing
effect-cleanup ref warning in OptionsFlowToolPanel.tsx. Full production build
and TypeScript pass (84 pages). Release verification follows the scoped push.
