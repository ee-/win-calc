# Receipt — T001 WO-1 (engine, formatting, Standard mode, shell)

Date: 2026-09-10 · Working branch: main · Base commit: 8d5f2d4
Commit: `HEAD` of `main` — `T001 WO-1: engine, formatting, Standard mode and the UI shell`

## Commands executed

| Command | Purpose | Result |
|---|---|---|
| `node --version` | host runtime | `v24.21.0` |
| `node --test tests/format.test.js` | format module only | 6 pass, 0 fail |
| `node --test tests/engine.test.js` | engine semantics | 20 pass, 0 fail |
| `node --test` (repo root) | **required validation** | **42 pass, 0 fail, exit 0** |
| `node -e '...'` | overflow depth probe (9²⁹ = Infinity) | confirms the overflow test count |
| headless Chromium on `file:///home/hermes/projects/win-calc/index.html` | AC-009 / CON-001, real surface | app runs, no console/page errors, no failed requests |
| browser DOM audit (`getComputedStyle`, `getBoundingClientRect`) | Win11 geometry and colour roles | 24 keys, 6×4 grid, 82×48 keys, 2px gaps, 4px radius, 8px window radius, 340px window |

## Files changed

```
?? engine.js
?? format.js
?? index.html
?? modes/
?? styles.css
?? tests/
?? ui.js
```

All new (greenfield). `.wo1-prompt.txt` is pre-existing and left untracked.

| File | Lines | Role |
|---|---|---|
| `format.js` | 116 | grouping, 16-significant-digit switch to scientific, `-0`, input cap |
| `engine.js` | 324 | pending-operation state machine, unary ops, errors, memory, history |
| `modes/standard.js` | 106 | Standard keypad geometry + Windows 11 keyboard map |
| `ui.js` | 286 | shell: display, keypad, memory row, history, mode switcher |
| `index.html` | 64 | classic `<script>` tags, file://-safe |
| `styles.css` | 322 | Windows 11 dark (default) and light palettes |
| `tests/*.test.js` | 609 | 42 tests across format, engine, standard, shell |

## Verification

```
$ node --test
ℹ tests 42
ℹ suites 0
ℹ pass 42
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 112.85
EXIT=0
```

Coverage against the work order:

- **AC-001** — left-to-right (no precedence), repeated `=`, operator replacement,
  CE vs C vs Backspace, `+/- % 1/x x² √`, divide-by-zero / undefined / invalid
  input / overflow, and recovery from each.
- **AC-002** — memory (MS M+ M− MR MC, with MC/MR inert until something is
  stored), history panel (record, recall, clear), keyboard map (digits,
  operators, `Enter`, `Escape`, `Delete`, `Backspace`, `F9`, `%`, `r`, `q`, `@`,
  `Ctrl+L/R/P/Q/M`, `Ctrl+H`, `Alt+1..6`).
- **AC-009** — asserted mechanically: no `type="module"`, local-only assets, no
  remote URLs, no `fetch`/`XHR`/`WebSocket`, no `package.json`, no `node_modules`,
  no non-relative `require`, every file carries the `module.exports` guard and
  attaches to the same `WinCalc` namespace. Confirmed live over `file://`.
- **AC-010** — `node --test` exits 0.

Browser evidence (headless Chromium, `file://`):

- `1 2 3 . 5 × 7 =` → `8,641.5`; history shows `1,234.5 × 7 =` / `8,641.5`.
- keyboard `7 * 8 Enter` → `56`; `Escape` clears, `Delete` clears entry.
- `6 ÷ 0 =` → `Cannot divide by zero`; then `4` → `4`, `+ 6 =` → `10`.
- `50 + 10 % =` → `55`, `9 x²` → `81`, `8 ¹/x` → `0.125`, `9 ²√x` → `3`,
  `123 ⌫` → `12`, `7 ±` → `-7`.
- memory: `5 MS`, `C`, `MR` → `5`; MC/MR disabled until a value is stored.
- mode switcher lists all six modes; Scientific/Programmer show the placeholder
  panel and hide the keypad; Standard restores 24 keys.
- console: no page errors, no console errors, no failed requests.

Two defects were found by looking at the rendered app and fixed:

1. `buildKey` set a speculative `style.gridArea = "k" + index`; the named areas
   do not exist, so all 24 keys collapsed onto one grid cell (keypad 50px tall).
   Removed — the keys auto-place in the 4-column grid.
2. Long results and error messages overflowed the 320px display
   (`9,999,999,999,999,999` measured 521px, `Cannot divide by zero` 492px) and
   were clipped. Added `ui.js fitDisplay()`: one measurement at 40px, then the
   font shrinks proportionally (floor to even px, min 18px), matching the real
   app. Verified: 16-digit values render at 24px and fit; short values stay 40px.

## Boundary check

- Writes outside the repository: only `/tmp/omp-sshots-*.webp` browser
  screenshots produced by the verification tooling. Nothing else.
- Network: none. The app requests only same-directory files; the browser loaded
  `file://` only and reported no failed requests. No `http(s)` URL exists in any
  shipped file.
- Credentials: none contacted or stored. No environment variables read.
- Dependencies: none added. No `package.json`, no `node_modules`, no lockfile.
- Destructive commands: none. No `git` state was reset or discarded.

## Residual risks

- **Scientific-notation edge formatting.** Windows prints a mantissa that always
  keeps its decimal point (`1.e+16`, `2.e+16`); implemented and tested, but the
  exact round-half-away-from-zero behaviour of the real app at the 16th
  significant digit is inferred from `toExponential(15)`, not observed
  side-by-side with the real application.
- **Input cap rule.** The cap is 16 *significant* digits (leading zeros do not
  count), so `0.` plus 16 fraction digits is accepted. The real app's exact
  entry-length rule for long fractional inputs may differ by a digit.
- **Percent semantics** follow `Windows: a % b` for `+`/`−` (percentage of the
  first operand); other pending operators take a plain `/100`. Not verified
  against the real app for the multiply/divide cases.
- **Visual fidelity is judgment**, not testable. Geometry, colour roles and
  accent match the real app's measurements; the owner settles the rest at G6.
- **Approximation marker:** the memory row is disabled-state driven by a single
  `hasMemory` flag, not the real app's per-value memory list (the real one keeps
  multiple stored values). WO-1 only requires MS/M+/M−/MR/MC semantics; a
  multi-value memory list would need a new work order.

## Not done (out of WO-1 scope)

- WO-2 Scientific, WO-3 Programmer, WO-4 Date Calculation, WO-5 Converter,
  WO-6 Graphing. Their slots exist: `ui.js MODES` lists all six, the five
  unimplemented ones render a placeholder panel.
- WO-7 visual polish and the per-mode screenshots for the owner.
- No `README` and no `serve.js`: neither is required to satisfy CON-001, since
  classic scripts run straight from `file://`.
