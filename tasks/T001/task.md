# Task — T001 win-calc

> Frozen at **G0** on 2026-09-10, with the owner's approval relayed via the
> owner's proxy (see Amendment A-001). Changing the objective, the acceptance
> criteria, or the authorization boundaries means either a new task or an
> owner-approved scope change recorded at the bottom — never a silent edit.

## Objective

A web app that reproduces the Windows 11 Calculator closely enough that someone
who knows the real one can use it without instructions — every mode.

## Background

Greenfield. No existing code, no build system, no dependencies. Delivered in
work orders because the full scope is six calculator modes, not one.

## In Scope

- Standard, Scientific, Programmer, Date Calculation, Converter, Graphing
- The Windows 11 visual design of the calculator content area, light and dark
- Memory row, history panel, mode switcher (hamburger)
- Keyboard input matching the real application

## Out of Scope

- Localization beyond en-US (UI language is en-US)
- Desktop packaging (Electron/Tauri), installers
- Telemetry, analytics, network calls of any kind — the app stays offline
- Currency conversion (the app stays offline)
- Importing/exporting history
- The multi-value memory list — a single stored value for now; deferred to a
  follow-up task

## Constraints

- CON-001 No runtime dependencies. No build step. Opening `index.html` from the
  filesystem runs the app.
- CON-002 Tests run on the host's Node (v24+) with the built-in `node --test`.
- CON-003 Calculation semantics follow Windows Calculator, not algebraic
  precedence, in Standard mode (left to right).
- CON-004 The converter uses exact factors where the real app does; document any
  factor that is approximate.
- CON-005 The app renders the calculator's content area only — no imitated OS
  title bar, no window chrome.

## Acceptance Criteria

- AC-001 Engine: left-to-right evaluation, repeated `=` repeats the last
  operation, pressing an operator twice replaces it, CE vs C vs Backspace keep
  their distinct meanings, and unary operations (+, -, %, 1/x, x^2, sqrt)
  behave as in the real app. Error states (divide by zero, invalid input,
  overflow) are shown and recoverable.
- AC-002 Standard mode: memory (MC MR M+ M- MS), history panel, keyboard map.
- AC-003 Scientific mode: DEG/RAD/GRAD, trig + inverse, log/ln, exp, powers and
  roots, factorial, absolute value, mod, floor/ceil/round, pi and e,
  parentheses, exponent entry, memory, history.
- AC-004 Programmer mode: HEX/DEC/OCT/BIN, bitwise AND/OR/XOR/NOT, shifts,
  word sizes (QWORD..BYTE) with truncation, A-F keys, and the live
  decimal/hex/oct/bin readout.
- AC-005 Date Calculation: difference between two dates; add/subtract
  days, months, and years.
- AC-006 Converter: length, mass, temperature, area, volume, speed, time, power,
  data, pressure, energy.
- AC-007 Graphing: plot y=f(x), multiple expressions with distinct colours,
  pan and zoom.
- AC-008 Shell: mode switcher, memory row, history, Windows 11 look, light and
  dark themes.
- AC-009 No runtime dependencies and no build step (CON-001 holds).
- AC-010 `node --test` exits 0.

## Required Evidence

One line per criterion — the observed result that settles it. Bracketed labels
name the work order that produces it; actual runs are recorded in the
verification record and under `tasks/T001/evidence/`.

- AC-001: `node --test` pass — engine suite: left-to-right evaluation, repeated
  `=`, operator replacement, CE/C/Backspace, unary ops, error + recovery. [WO-1]
- AC-002: `node --test` pass — memory, history, and keyboard suites. [WO-1]
- AC-003: `node --test` pass — Scientific suite. [WO-2]
- AC-004: `node --test` pass — Programmer suite, word-size truncation included. [WO-3]
- AC-005: `node --test` pass — Date Calculation suite. [WO-4]
- AC-006: `node --test` pass — Converter suite, factor round-trips included. [WO-5]
- AC-007: `node --test` pass — Graphing mapping suite; plus one screenshot. [WO-6]
- AC-008: `node --test` pass — shell suite; plus screenshots and the owner's
  visual verdict at G6. [WO-1, WO-7]
- AC-009: mechanical assertions pass — no module scripts, no `package.json`,
  no `node_modules`, no remote URLs, no network APIs; live check: no console or
  page errors over `file://`. [WO-1]
- AC-010: a recorded `node --test` run with exit code 0 at the verified head;
  log under `tasks/T001/evidence/`.

## Required Validation

```
cd /home/hermes/projects/win-calc
export PATH="$HOME/.local/bin:$PATH"     # node resolves via ~/.local/bin — see note
node --test
```

Environment note (reproducibility): `node` is provided by `$HOME/.local/bin`
(symlink to `~/.hermes/node/bin/node`, v24.21.0), and that directory is added
to PATH only by login or interactive shells (`~/.profile`, `~/.bashrc`). A bare
non-interactive command does not find it — set the PATH line above explicitly.
Demonstrated: `PATH=/usr/bin:/bin node --version` → `node: command not found`
(exit 127); capture: `tasks/T001/evidence/g2-node-path-demo.txt`.

Plus one screenshot per mode for the owner's visual acceptance (G6).

## Security / Authority Envelope

- authorized: local file writes inside the repository; running the test suite
  (`node --test`) and local browsers over `file://` for evidence; `git` commits
  to `main`; `git push` to the public remote `https://github.com/ee-/win-calc`
  (owner-approved, 2026-09-10).
- not authorized: runtime network access of any kind in the app; adding any
  dependency; deployment or publication anywhere beyond the remote above;
  currency or any other network-backed feature; reading, storing, or
  transmitting secrets; history rewrite / force-push.
- owner gate required when: any action outside the authorized list; anything
  beyond `git push` to the named remote; a new dependency; a history rewrite.
- governance-sensitive, needs independent review before it takes effect:
  changes to `AGENTS.md`, the pipeline skills, security policy, CI workflows,
  CODEOWNERS, rulesets, permissions, or credentials.

## Escalation Conditions

Stop and escalate when the contract is ambiguous or self-contradictory; an
assumption is falsified; an invariant conflicts; the work would step outside the
Authority Envelope; the security gate blocks; or routing fails repeatedly.

## Metadata

- Task ID: T001
- Status: IMPLEMENTED — WO-1 delivered (`bc84a80`); WO-2..WO-7 pending; live stage in `state.md`
- Complexity: L3
- Architecture effort: high
- Repository: /home/hermes/projects/win-calc — remote https://github.com/ee-/win-calc
- Base branch: main
- Base commit: 8d5f2d4
- Created: 2026-09-10

---

## Contract Changes After Execution Begins

### A-001 — 2026-09-10 — AMENDMENT (owner-approved, relayed via the owner's proxy)

"The plan is approved as amended." — and: "go — freeze and proceed, with the
defaults proposed."

Record-integrity correction: the previous revision of this file declared a G0
approval before any approval had been given (`state.md` said the same). Both
have been corrected; this amendment is the first recorded G0 approval and
supersedes those entries.

Owner decisions, recorded as given:

- UI language: en-US.
- Window: the app renders the calculator's content area only — no imitated OS
  title bar, no window chrome. (CON-005)
- Currency conversion: excluded — the app stays offline. (Out of Scope)
- Memory: a single stored value for now; the multi-value memory list is
  deferred to a follow-up task. (Out of Scope)
- Process: the executor stays OMP on this host; evidence lives under
  `tasks/T001/evidence/`; the independent reviewer is a distinct actor from the
  coder; milestones run M1..M7 in work-order order — M1 = WO-1, Scientific (M2)
  before Graphing (M6).
