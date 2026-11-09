# Profile session controls: regression and restoration

## What happened

Introducing commit: 97b6cfde12c40ccc5d3c0a4c5e3c3e7dde006722, **6 November 2026, 16:58 Brisbane (UTC+10)**. Subject: "Use volume profile session controls for TPO". Vercel marked that deployment complete at **17:00 Brisbane the same day** (07:00 UTC), deployment 8pJXXrkzVCYp2CvqwHjGV6ZP2KYf. See introducing-commit.patch for the exact changes and introducing-deployment.json for the deployment status.

The commit reused Volume Profile's session UI for TPO. It added an outer settings section to the shared block. Volume Profile already owned its own inner tab strip. Its inner Filter / split time tab then rendered controls into a different OUTER section, which was hidden while General remained selected. The obsolete footer remained visible. Daily and Weekly Volume Profile therefore appeared to lose their session buttons despite the controls and stored settings still existing.

TPO separately had two differently spelled outer sections: Filter/split time and Filter / split time. Its controls became split across these nearly identical tabs.

## Attribution and intent

Git author and committer are the configured identity Jacob Olisa <hello@olisalabs.com>. This is not evidence that the owner authored it, nor does it identify the responsible coding chat or agent. No stronger per-chat attribution has been established. The change was a coding regression. The owner authorized TPO session-control parity, not loss of existing controls. The commit's recorded purpose explains the refactor; it does not justify the regression.

The calculation tests exercise the TPO engine; they do not establish that the real settings tab renders its controls. The visibility fault required a browser interaction check.

## Exact affected controls in this commit

| Area | Change | Repair |
| --- | --- | --- |
| Daily, Weekly, Bid/Ask, Delta, Monthly, Composite VP | Shared Filter / split time block hidden by nested sections | Restored in live ea77ba8125dc534d410e8c17ae7266b832b85a36; six variants rechecked |
| TPO daily | Six quick-session buttons removed: RTH, Globex, New York, London, Tokyo, Sydney | Restored with multiple selection and deselection |
| TPO daily/weekly | Old Session action choices removed, including Split two and Split three | Restored for scheduled TPO sessions |
| TPO daily/weekly | ETH/RTH/custom Session filter and custom start/end inputs removed | Restored for scheduled TPO sessions, with themed clock inputs |
| TPO daily/weekly | End-session-as-start-day switch inaccessible to legacy custom sessions | Restored without converting the saved schedule |
| TPO daily/weekly | Old Filter/split time page removed while new spaced section introduced | Consolidated under the existing Filter/split time section |

The commit also added the intended shared session calculation support and adjusted developing-profile refresh. Those calculations remain. This repair changes settings presentation only, not session boundaries, recorded data or saved account preferences. This is an audit of the introducing commit and affected profile controls, not a claim that every historical change anywhere in the platform was audited.

## Verification

- Real isolated headless Chrome: six Volume Profile variants, all four session buttons visible and independently toggled; Globex + New York combination persists across settings tabs.
- Real isolated headless Chrome: Daily and Weekly TPO share one session-settings tab; four shared session buttons change settings; all six daily quick presets selectable, Sydney deselectable; scheduled Split two mode and custom 18:30:00 clock and end-session-as-start-day toggle update the actual component settings.
- Existing quick-session and daily-boundary suites: 5/5 pass, including all six engine profiles compared with their standalone boundaries, rows and totals.
- Broader TPO profile suite: 25/26 pass. The existing failing catalogue assertion still expects TPO Levels, which the owner explicitly requested removed earlier; this repair does not reinstate that removed indicator or change that test.
- Final isolated Next.js webpack production build passed, including TypeScript and page generation (tmp/profile-forensics-build-release.log). Exact production commit verification is retained in the local release receipt after deployment.

No live gateway, terminal or subscription restarted. No accounts, orders, saved workspaces or stored indicator settings rewritten. Only the settings component and this evidence are staged.
