# Independent Review — T001

## Metadata

- Reviewer `actor_id`: reviewer-g3-t001
- Model: deepseek-flash (delegate session, inherited from dispatcher)
- Base commit: 8d5f2d4
- Head commit: bc84a80 (bc84a80238b33c4aebe1068e2c20e3edec5da615)
- Diff range: 8d5f2d4..bc84a80
- Session: fresh delegate session, no implementer context inherited; started 2026-09-10T16:00:56Z

## Preliminary Verdict

<!-- Recorded BEFORE the full pass and before any further checks were run.
     No reconciliatory material was released for this review, and none exists. -->
<!-- A verdict written after reading the implementer's explanation is not
     preliminary and does not count. -->

- Preliminary result: CHANGES_REQUIRED
- Time recorded: 2026-09-10T16:04:37Z
- Basis: first read of the six inputs — task.md; work-orders.md; the commit pair (8d5f2d4 → bc84a80); the complete bundled diff and the head tree; the G2 verification record with its raw log; tests-added.txt. On first read the delivery is coherent, the recorded run is green (42/42, exit 0, node v24.21.0, tree clean at the verified head), the tests read as substantive, and the diff draws only on WO-1 scope plus the stage-4 receipt. One required-evidence item is not settled by anything in the input set: AC-009's live check ("no console or page errors over `file://`", tagged [WO-1]) appears in no recorded capture — the verification record documents `node --test` only. Fail-closed reading: an unsettled criterion is a finding; a required-evidence gap forces CHANGES_REQUIRED, pending the full pass.

## Final Verdict

**CHANGES_REQUIRED** — bound to head commit `bc84a80238b33c4aebe1068e2c20e3edec5da615`
(1×P1 blocking; 1×P2 and 2×P3 non-blocking). Any material change to the head
requires a fresh review.

The delivery itself reproduces cleanly (42/42, exit 0, same check set) and the
diff stays in scope; the block is evidence, not behavior: AC-009's [WO-1] live
check has no recorded capture, so the criterion cannot be marked met.

## Acceptance Criteria Assessment

| AC | Criterion | Met? | Evidence |
|----|-----------|------|----------|
| AC-001 | Engine: left-to-right, repeated `=`, operator replacement, CE/C/Backspace, unary ops, error states shown and recoverable | MET | Engine suite checks all pass (g2-node-test-output.txt:16-35; tests/engine.test.js:1-269). Each required behavior has a named check; reviewer re-run reproduced the same 20 checks (see Evidence Integrity). |
| AC-002 | Standard: memory (MC MR M+ M− MS), history panel, keyboard map | MET | Memory and history checks pass (g2-node-test-output.txt:30-31); keyboard map checks incl. negative cases and end-to-end pass (g2-node-test-output.txt:53-57; tests/standard.test.js:1-117); shell controls present (tests/shell.test.js:91-103). |
| AC-003 | Scientific mode | NOT IN THIS DELIVERY | WO-2, not yet delivered (work-orders.md:10; scope note). Out of the reviewed work order — not a finding. |
| AC-004 | Programmer mode | NOT IN THIS DELIVERY | WO-3 (work-orders.md:11). |
| AC-005 | Date Calculation | NOT IN THIS DELIVERY | WO-4 (work-orders.md:12). |
| AC-006 | Converter | NOT IN THIS DELIVERY | WO-5 (work-orders.md:13). |
| AC-007 | Graphing | NOT IN THIS DELIVERY | WO-6 (work-orders.md:14). |
| AC-008 | Shell: mode switcher, memory row, history, Windows 11 look, light and dark themes | MET at WO-1 scope; final settlement assigned to the owner at G6 | Shell suite checks pass (g2-node-test-output.txt:42-49; tests/shell.test.js). Screenshots and the owner's visual verdict are assigned to G6 by the contract itself (task.md:86-87) — recorded as owner-assigned settlement, not a finding. |
| AC-009 | No runtime dependencies, no build step (CON-001); no console or page errors over `file://` | PARTIAL — mechanical half MET; live check UNSETTLED → finding F-1 | Mechanical assertions pass (g2-node-test-output.txt:42-45; tests/shell.test.js:20-56). The live check required at [WO-1] (task.md:88-90) has no recorded capture among the review inputs; the verification record documents only `node --test` (g2-verification.md:7-19; g2-node-test-output.txt:15-66). |
| AC-010 | Recorded `node --test` run with exit code 0 at the verified head | MET | g2-verification.md:15-19; g2-node-test-output.txt:58-66 (42 pass, fail 0, EXIT_CODE=0 at bc84a80); reviewer re-run reproduced identically. |

## Blocking Findings

### P0 — Critical

- None.

### P1 — Blocking

- **F-1 — AC-009's [WO-1] live check is not settled by any recorded evidence; the criterion cannot be marked met.** The frozen contract requires "live check: no console or page errors over `file://`" as part of AC-009, tagged [WO-1], with actual runs "recorded in the verification record and under `tasks/T001/evidence/`" (task.md:88-90). What is recorded is `node --test` only: g2-verification.md:10-19 (command, exit code 0, result 42/42) and g2-node-test-output.txt:15-66 (the raw run). No capture of a `file://` browser session — console/page errors, failed requests — appears anywhere in the review inputs, and `node --test` cannot settle it (no browser is involved). The mechanical half of AC-009 is settled by the shell suite (g2-node-test-output.txt:42-45; tests/shell.test.js:20-56); the live half is not. This is not waived by the G6 carve-out: that carve-out covers AC-008's screenshots and the owner's visual verdict (task.md:86-87); nothing in the inputs assigns AC-009's live check to the owner or to a later gate. (work-orders.md:9 states WO-1's acceptance method as `node --test` alone; the reviewer judges against the frozen contract, which adds the live check at [WO-1].) Fail-closed: a required evidence item absent from the record blocks → CHANGES_REQUIRED at bc84a80. The reviewer did not run the check itself: replacing deterministic verification is outside the reviewer's role.

## Non-Blocking Findings

### P2 — Non-blocking

- **F-2 — The UI layer (`ui.js`) has no behavioral automated coverage; the shell suite is static.** Every check in `tests/shell.test.js` is a source-text assertion (regexes over file contents, `fs.existsSync`, id cross-checks) or a load-time export-identity check; the UI entry point is only checked for being a function (tests/shell.test.js:76). No test invokes `NS.ui.start()` or simulates DOM events: a search over `tests/` for `document.` / `dispatchEvent` / `new Event` returns no matches, and "start" matches only the typeof check (tests/shell.test.js:76) plus an unrelated test title (tests/engine.test.js:255). Keypad click wiring, memory enable/disable, history render/recall, mode switching and `fitDisplay` are therefore untested by `node --test`; defects in that wiring would not be caught by the recorded verification. Non-blocking: engine semantics are covered, the DOM/id contract is cross-checked statically, and the owner's G6 verdict covers the visual surface. Recommended to be picked up as the mode work orders add UI surface.

### P3 — Advisory

- **F-3 — `%` under a pending `×`/`÷` is implemented but untested.** The percent check covers pending `+`, pending `−`, and bare entry only (tests/engine.test.js:121-130); the branch at engine.js:190-194 (`x / 100` for any non-add/sub pending operator) has no case. Code read suggests correct fraction semantics; a test would pin it.
- **F-4 — Stale comment in `tests/helper.js:25`.** It describes `press(calc, "1+2=")` and `"d5"`; the helper's actual grammar is comma-separated actions (`"1,op:add,2,equals"`, digits as `digit:N`), and `"d5"` appears nowhere. Clarity only.

## Test Quality

All 42 checks assert real behavior — concrete expected displays, error strings,
history and expression contents — and the reviewer's independent re-run produced
the identical check set. No test was weakened or removed: the range adds only
new files, and 20 engine + 6 format + 8 shell + 8 standard = 42, matching both
runs. Edge-case coverage is thorough for a first work order: operator
replacement with no operand, `=` with nothing to repeat, negative zero,
partial-entry grouping, every error state and every recovery path, and negative
keyboard-map cases. The shell suite is static-analysis in style; its checks are
genuine invariants (no module scripts, no remote URLs, no dependency manifests,
loadability under both browser and Node) rather than vacuous assertions. Gaps:
F-2 (no behavioral coverage of `ui.js`) and F-3 (`%` under `×`/`÷`).

## Scope Compliance

The diff adds exactly 12 files, all new, all inside WO-1: `format.js`,
`engine.js`, `modes/standard.js`, `ui.js`, `index.html`, `styles.css`, five test
files, and `tasks/T001/receipt.md` (the stage-4 receipt — an expected pipeline
artifact). The base commit contains no product code (base tree: `.gitignore`,
`tasks/T001/state.md`, `tasks/T001/task.md`), so nothing outside WO-1 could
have been altered. No unrelated files; no unexplained additions; no behavior
outside scope modified. The receipt is narrative by nature — noted, not relied
on (see Evidence Integrity).

## Evidence Integrity

- Recorded verification matches the reviewed head: g2-verification.md:8 and
  g2-node-test-output.txt:13 both name `bc84a80238b3…`; commit time
  2026-09-10T14:54:54Z precedes the run 2026-09-10T15:58:01Z; the log's status
  line records a clean tree (g2-node-test-output.txt:14).
- The bundled diff is authentic: byte-identical to a regenerated
  `git diff 8d5f2d4..bc84a80` (sha256 `8f178d58…e0024` both).
- The reviewed head is the product state: `git diff --quiet bc84a80 HEAD -- '*.js' '*.html' '*.css' tests`
  → exit 0; the later commits (f578645, e5b449c) change only `tasks/` documents
  and evidence.
- Independent re-run: `node --test` (node v24.21.0, `$HOME/.local/bin`) →
  42 pass, 0 fail, exit 0; the check-name list is identical to the recorded
  log's (diff → `NAMES_IDENTICAL`).
- Working tree at review: clean; the only untracked file is this review
  (`tasks/T001/review.md`), written by the reviewer for the dispatcher to
  commit. No repository state was modified by this review.
- The diff contains `tasks/T001/receipt.md` (the implementer's own account,
  committed as the stage-4 artifact). It was treated as narrative, not
  evidence; nothing in this review rests on it.

## Residual Risks

- Fidelity items not falsifiable from the six inputs: scientific-notation
  rendering at ≥1e16 (the mantissa-with-point convention), rounding at the 16th
  significant digit, the entry-length rule for long fractional inputs, and `%`
  under pending `×`/`÷` (F-3). Accepted on purpose at this stage: the contract
  settles these via the suite, no contrary evidence was found, and the owner
  sees the visual surface at G6.
- Visual fidelity is ultimately the owner's judgment at G6 (task.md:86-87,
  109); the reviewer did not render the app — out of the reviewer's role and
  rules of engagement.
- Single-value memory is contract-authorized (deferred by A-001 / out of
  scope), not drift.
- The reviewer exercised no browser and no network; if stronger assurance of
  the `file://` surface is wanted, that is exactly what F-1 asks be recorded.

## Required Next Action

Return with findings (evidence step) — F-1 is not an implementation change
unless the check fails: produce and record the AC-009 live check over `file://`
under `tasks/T001/evidence/` (evidence work is authorized: task.md:113-114),
then re-issue G3 against the same head commit. F-2..F-4 are non-blocking and do
not gate finalization; F-2 is recommended for a later mode work order. If the
Captain concludes the live check should be deferred or re-scoped, that is a
contract change to be recorded in `task.md` — the reviewer cannot waive it.
