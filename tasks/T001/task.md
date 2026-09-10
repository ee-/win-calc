# Task — T001 win-calc

> Frozen at **G0**. The owner approved this document (2026-09-10). Changing the
> objective, the acceptance criteria, or the authorization boundaries means
> either a new task or an owner-approved scope change recorded at the bottom.

## Objective

A web app that reproduces the Windows 11 Calculator closely enough that someone
who knows the real one can use it without instructions — every mode.

## Background

Greenfield. No existing code, no build system, no dependencies. Delivered in
work orders because the full scope is six calculator modes, not one.

## In Scope

- Standard, Scientific, Programmer, Date Calculation, Converter, Graphing
- The Windows 11 visual design, light and dark
- Memory row, history panel, mode switcher (hamburger)
- Keyboard input matching the real application

## Out of Scope

- Localization beyond en-US
- Desktop packaging (Electron/Tauri), installers
- Telemetry, analytics, network calls of any kind
- Importing/exporting history

## Constraints

- CON-001 No runtime dependencies. No build step. Opening `index.html` from the
  filesystem runs the app.
- CON-002 Tests run on the host's Node (v24+) with the built-in `node --test`.
- CON-003 Calculation semantics follow Windows Calculator, not algebraic
  precedence, in Standard mode (left to right).
- CON-004 The converter uses exact factors where the real app does; document any
  factor that is approximate.

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

## Required Validation

```
node --test
```

Plus one screenshot per mode for the owner's visual acceptance.

## Owner-Approval Boundaries

- adding any dependency
- any network access at runtime
- publishing or deploying anywhere

## Metadata

- Task ID: T001
- Status: SCOPED
- Complexity: L3
- Architecture effort: high
- Repository: /home/hermes/projects/win-calc
- Base branch: main
- Base commit: (recorded at the contract commit)
- Created: 2026-09-10
