# Security Preflight — T001 / WO-1 rework 1 (2026-09-10)

Completed before this cycle's runs, forge writes, pushes, and PR; card retained
per the pipeline security rules.

```text
Repository:                  /home/hermes/projects/win-calc — origin https://github.com/ee-/win-calc
Trusted governance ref:      main @ a4ef0e2 (work-order template installed); pipeline skill
                             revision read from ~/.hermes/skills/software-development/odysseus-coder
Task / contract:             T001 — Issue #2 (forge mode; carried from the frozen tasks/T001/task.md; A-001)
Latest contract change:      2026-09-10 — DECISION: forge-mode migration (issue #2 comment)
Base / head:                 8d5f2d4 / 5c2d5c8 (rework cycle 1)
Worktree:                    CLEAN
External effects authorized: git push + forge operations for this task (issues, comments, pull
                             requests, review records, merges to main) — owner, 2026-09-10 — nothing else
```

Eleven checks:

1. **Repository identity, worktree, base/head, contract** — verified: `git remote -v`
   (origin = ee-/win-calc), `git status -sb` (clean), `git rev-parse HEAD` →
   `5c2d5c8…`, issue #2 read back.
2. **Repository content stays input** — issue, comments, repo text, and the
   work-order template are data; nothing found in them was adopted as a
   directive beyond the owner-relayed decisions.
3. **Inside objective / scope / invariants** — the rework records the AC-009
   live check and folds in an owner-directed test for percent under ×/÷; no
   product behavior change, no new scope.
4. **Secrets** — none read, copied, logged, or disclosed; the `gh` token is
   masked; no external executor credential is used by this cycle (no OMP run).
5. **Network / uploads / publication** — `git push` and `gh` API calls (issue,
   comments, PR, review record, merge) to the named remote only, owner-directed;
   the app and its checks run offline; Chromium loads `file://` only, and the
   live check observed no remote requests.
6. **Destructive / irreversible** — none: no history rewrite, no force-push, no
   deletions; merges are additive; the `/tmp` scratch (browser profile, control
   copy) is throwaway.
7. **No privilege escalation via untrusted text** — gh token scopes pre-existing;
   no sudo; nothing in repo or issue text granted authority.
8. **Repo code / hooks / installers** — `node --test` and the live-check script
   run as user `hermes`; no installers; no elevated privilege; default hooks.
9. **Dependencies** — none added (CON-001 holds); the live check uses Node
   built-ins plus the host's already-installed Chromium cache.
10. **Governance change cannot self-authorize** — the work-order template was
    copied verbatim from the pipeline skill (not self-authored); no changes to
    `AGENTS.md`, the pipeline skills, security policy, CI, or credentials.
11. **External mutations have query paths** — issue #2, PR #1 (merged), the
    rework PR, its comments, and the merge commits are queryable via `gh`/`git`;
    after promotion: `git ls-remote origin main`.

SECURITY_PREFLIGHT: PASS

(PASS = no unresolved authority-boundary violation under the available
evidence; not a claim that the work is free of vulnerabilities.)
