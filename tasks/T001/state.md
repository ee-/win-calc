# State — T001 win-calc

## Workflow State

- Status: DESIGNED
- Complexity: L3
- Architecture effort: high
- Rework cycle: 0
- Base branch: main
- Base commit: recorded at the contract commit (this commit)
- Working branch: main
- Working tree: clean

### Stage Log

- [x] Stage 0 Preflight — repo created, base commit recorded
- [x] Stage 1 Scope — task.md written, **G0 approved by owner**
- [x] Stage 2 Design — below
- [x] Stage 3 Decompose — below
- [ ] Stage 4 Implement — WO-1..
- [ ] Stage 5 Verify — **G2**
- [ ] Stage 6 Review — `review.md`, **G3**
- [ ] Stage 7 Finalize — **G5**, **G6**

## Architecture

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

- CON-001 vs module scripts (above) — implementation proceeds with a classic
  script, which satisfies the constraint as written.

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

## Verification Record

(empty — filled at Stage 5)

## Handoff Notes

- Executor: OMP on this host, roles from `~/.omp/agent/config.yml`.
- Standing constraints: `~/.omp/agent/RULES.md`.
