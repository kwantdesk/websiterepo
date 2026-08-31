# KwantDesk agent instructions

Read `CLAUDE.md` completely before changing this repository. It is the canonical engineering handoff and applies to Codex and every repository-aware coding agent, despite its filename.

Before changing anything under `native/`, also read
`native/PROFESSIONAL_REBUILD_CHARTER.md` completely. It is the controlling
product, parity, quality, distribution, and release contract for the native
KwantDesk rebuild. A native change is not complete unless it satisfies that
charter's step-by-step workflow and acceptance gate.

The release target is one shared Windows/macOS/Linux .NET/Avalonia/Skia
workstation. Read `native/CROSS_PLATFORM_DESKTOP_ARCHITECTURE.md` completely
before native UI, rendering, platform-integration, packaging, or update work.
WPF is a temporary migration reference only and is not a release target.

## Production deployment and cost safety

**Emergency deployment hold (2026-08-25): do not push `main` or invoke any Vercel deployment.** GitHub deployment records prove that this repository is connected to two Vercel projects: `websiterepo-yfmi` (the linked live project) and the stale duplicate `websiterepo` (the failing deployment). This hold supersedes every older instruction in this repository that says completed work should be pushed or deployed. Keep working and testing locally. The hold may be removed only after the owner confirms that the duplicate `websiterepo` Git connection has been disconnected in Vercel and explicitly asks to resume production deployment.

The owner wants KwantDesk to remain live. Do not delete, pause, unlink, or redeploy `websiterepo-yfmi` while resolving the duplicate integration.

- Production branch: `main`.
- Only `main` may trigger Vercel. Preserve this policy in `vercel.json`:

  ```json
  "git": {
    "deploymentEnabled": {
      "*": false,
      "main": true
    }
  }
  ```

- Never enable Vercel deployments for all branches, preview branches, or every commit without explicit owner approval.
- Work and test locally. Local commits are allowed, but `main` pushes are blocked by `.git/hooks/pre-push` while the emergency hold is active.
- Do not bypass the pre-push guard, run `vercel deploy`, or create another deployment path unless the owner explicitly confirms the duplicate Vercel integration is gone and asks to resume deployment.
- Do not route continuous market-data streams, per-tick polling, replay generation, or vendor fan-out through Vercel. Those belong on the always-on VPS gateway described in `CLAUDE.md`.
- Main-only deployments prevent preview-build churn, but do not guarantee zero Vercel runtime, transfer, Fluid, function, or observability charges.

## Repository safety

- Preserve the dirty worktree and unrelated user changes.
- Never touch, stage, delete, or reformat `ALGO/` unless explicitly asked.
- Keep changes scoped, diagnose root causes, and never fake or silently downgrade market data.
- Stage only files belonging to the current task. Verify before committing and report exactly what was tested.
