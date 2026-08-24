# KwantDesk agent instructions

Read `CLAUDE.md` completely before changing this repository. It is the canonical engineering handoff and applies to Codex and every repository-aware coding agent, despite its filename.

## Production deployment and cost safety

The owner wants KwantDesk to remain live and wants completed work deployed to production. The owner does not want preview builds or repeated partial deployments consuming Vercel usage.

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
- Work and test locally. Batch a completed task into one scoped commit and one `main` push when practical; do not deploy partial attempts.
- A `main` push is expected to publish the production website. Do not pause or disable production unless the owner explicitly asks.
- Do not route continuous market-data streams, per-tick polling, replay generation, or vendor fan-out through Vercel. Those belong on the always-on VPS gateway described in `CLAUDE.md`.
- Main-only deployments prevent preview-build churn, but do not guarantee zero Vercel runtime, transfer, Fluid, function, or observability charges.

## Repository safety

- Preserve the dirty worktree and unrelated user changes.
- Never touch, stage, delete, or reformat `ALGO/` unless explicitly asked.
- Keep changes scoped, diagnose root causes, and never fake or silently downgrade market data.
- Stage only files belonging to the current task. Verify before committing and report exactly what was tested.
