# T001 — Work Orders and Criterion Mapping

Reviewer input: the work orders and their criterion mapping. Source: the
work-order decomposition frozen with the task (superseded file-mode copy:
`tasks/T001/state.md` § Work Orders); unchanged by rework 1. The forge-mode
contract is issue #2.

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
(M2) before Graphing (M6).

Scope note: the delivered work covers WO-1 only; WO-2..WO-7 are not delivered
yet.
