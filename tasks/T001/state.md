# State — T001 win-calc

Single source of truth for workflow state and design decisions. The Captain
maintains the workflow sections; the Architect maintains the design sections.
Updated at every stage transition.

---

## Workflow State

- Status: IMPLEMENTED — WO-1 in rework cycle 1 (G3 returned: F-1); WO-2..WO-7 pending
- Complexity: L3
- Architecture effort: high
- Rework cycle: 0 completed — 1 open (G3 return on F-1)
- Fallback used: no
- Base branch: main
- Base commit: 8d5f2d4
- Working branch: main
- Head commit (current): `bc84a80` — WO-1; pipeline-artifact commits (contract freeze, evidence, review) follow on main
- Diff range (base → head): `8d5f2d4..bc84a80` (WO-1)
- Working tree: clean at verification time (2026-09-10T15:58Z; no changes in `git status -sb`); artifact commits added after

### Stage Log

- [x] Stage 0 Preflight — repo located, baseline recorded
- [x] Stage 1 Scope — `task.md` frozen 2026-09-10; **G0 approval recorded** (Amendment A-001); the earlier approval entry was corrected — it predated the approval
- [x] Stage 2 Design — below
- [x] Stage 3 Decompose — below
- [ ] Stage 4 Implement — WO-1 delivered (`bc84a80`); WO-2..WO-7 pending
- [ ] Stage 5 Verify — WO-1 verified (G2 record below); WO-2..WO-7 pending
- [ ] Stage 6 Review — WO-1: G3 verdict **CHANGES_REQUIRED** (F-1, blocking) — rework cycle 1 open: record the AC-009 live check, then re-issue G3 at `bc84a80`; see `review.md`; WO-2..WO-7 pending
- [ ] Stage 7 Finalize — **G5**, then owner acceptance **G6**

---

## Architecture

> Captain note (2026-09-10): the CON-001 question raised below was resolved at
> G0 — the implementation ships a classic `<script>`, no modules, no
> `serve.js`; CON-001 holds literally. See Open Questions.

### System Understanding

Greenfield static web app. Windows Calculator is a mode-switched application:
one display, one keypad that changes per mode, a memory row and a history panel
shared across modes. The calculator is not a formula parser in Standard mode —
keystrokes build a pending operation and evaluation is immediate.

### Recommended Design

- **Plain ES modules loaded by `index.html`.** No bundler, no dependencies.
  `type="module"` gives imports without a build step; opening the file over
  `file://` is not enough for module scripts, so the app is served by any static
  server, or opened from a checkout served with `node --test`'s host tools.
  Decision: ship `serve.js` (Node built-ins only) and document one command.

  Correcting the constraint: CON-001 in task.md says opening `index.html` from
  the filesystem runs the app. ES modules over `file://` are blocked by CORS in
  every browser, so either the code is one classic script (no modules) or the
  app needs a one-line static server. Recorded as a G0 clarification request;
  until the owner answers, the implementation uses a classic `<script>` with no
  modules so the constraint holds literally.

- **Layering**: `engine.js` holds the shared decimal/number formatting and the
  pending-operation state machine; each mode adds a keypad definition and its
  own operations. Nothing in the mode layer reaches into the DOM.
- **Formatting** is its own module: grouping, exponent switch-over, `-0`,
  error strings. Windows shows 16 significant digits before switching to
  scientific notation.
- **Tests** drive the engine directly with key sequences, which is how the real
  app's behaviour is specified. One file per area under `tests/`.

### Affected Components

`index.html` · `styles.css` · `engine.js` · `format.js` · `modes/*.js` ·
`ui.js` · `tests/*.test.js` · optional `serve.js`

### Implementation Sequence

1. engine + formatting + tests for Standard semantics
2. Standard keypad and UI shell (memory, history, mode switcher)
3. Scientific
4. Programmer
5. Date Calculation
6. Converter
7. Graphing
8. visual polish, themes, screenshots

### Test Matrix

- engine: key sequences → expected display, incl. repeated `=`, operator
  replacement, CE/C/Backspace, unary ops, error + recovery, overflow
- formatting: grouping, exponent switch, `-0`, very long input, rounding
- per mode: the mode's own operations
- keyboard map: key → action
- converter: factors, round-trip conversion

### Risks

- AC-004 word-size truncation and AC-007 graphing are the two places where a
  plausible-looking implementation is quietly wrong. Both get direct tests.
- Visual fidelity is judgment, not a test; it is settled by the owner at G6.

### Rollback Strategy

The repo is new and local. Reverting to the contract commit discards the
implementation and nothing else.

### Open Questions

- **Resolved (2026-09-10):** CON-001 vs module scripts — the implementation
  uses a classic `<script>` with no modules, so the constraint holds literally
  (no server required; `file://` works). No `serve.js`. No open questions for
  WO-1.
- Open for the rework: nothing decided by design; F-1 is an evidence step.

---

## Work Orders

| # | Scope | Serves | Acceptance method | Depends on |
|---|---|---|---|---|
| WO-1 | engine, formatting, Standard mode, shell (memory/history/mode switcher), tests | AC-001, AC-002, AC-008, AC-009, AC-010 | `node --test` exits 0 | — |
| WO-2 | Scientific mode | AC-003 | `node --test` | WO-1 |
| WO-3 | Programmer mode | AC-004 | `node --test` + word-size cases | WO-1 |
| WO-4 | Date Calculation | AC-005 | `node --test` | WO-1 |
| WO-5 | Converter | AC-006 | `node --test` | WO-1 |
| WO-6 | Graphing | AC-007 | `node --test` (mapping) + screenshot | WO-1 |
| WO-7 | Visual polish, themes, screenshots | AC-008 | screenshots | WO-2..WO-6 |

Milestones (owner, 2026-09-10): M1..M7 in this order — M1 = WO-1; Scientific
(M2) before Graphing (M6). Every criterion is served by at least one work
order; every work order serves at least one criterion.

---

## Verification Record

One block per Tester run:

```text
commit:            bc84a80238b33c4aebe1068e2c20e3edec5da615
working directory: /home/hermes/projects/win-calc
command:           export PATH="$HOME/.local/bin:$PATH"
                   node --test
environment:       host hermes-agent-2 · Linux 6.8.0-139-generic x86_64 · user hermes
                   node v24.21.0 — /home/hermes/.local/bin/node (symlink to /home/hermes/.hermes/node/bin/node)
                   working tree clean at run (git status -sb: `## main...origin/main`, no changes)
started at:        2026-09-10T15:58:01Z
finished at:       2026-09-10T15:58:01Z
exit code:         0
result:            tests 42 · pass 42 · fail 0 · cancelled 0 · skipped 0 · todo 0
log path:          tasks/T001/evidence/g2-node-test-output.txt
```

Full record: `tasks/T001/evidence/g2-verification.md`. The independent reviewer
re-ran the same command at the same head and reproduced 42/42, exit 0.

---

## Handoff Notes

- Executor: OMP on this host, roles from `~/.omp/agent/config.yml`.
- Standing constraints: `~/.omp/agent/RULES.md`.
- Evidence: `tasks/T001/evidence/` (owner decision, 2026-09-10); reviewer inputs in `evidence/g3/`.
- Reproducibility: `node` is provided by `$HOME/.local/bin` (symlink to
  `~/.hermes/node/bin/node`); PATH is set only for login/interactive shells
  (`~/.profile`, `~/.bashrc`). Non-interactive runs must
  `export PATH="$HOME/.local/bin:$PATH"` first. See
  `evidence/g2-node-path-demo.txt`.
- Artifact commits after `bc84a80` are pipeline bookkeeping (contract freeze,
  evidence, review); product code is unchanged since `bc84a80`.
- Open rework (cycle 1): record the AC-009 `file://` live check (command +
  output + exit code) under `evidence/`, then re-issue G3 against `bc84a80`.
  F-2 / F-3 / F-4 are non-blocking — see `review.md`.
