# G2 — Verification Record: T001 / WO-1 rework 1

Tester record for rework cycle 1, against the exact product head commit.
Deterministic captures; no interpretation added.

Scope of this record: the AC-009 `file://` live check (the live half of the
criterion) and the re-run of the required validation after the rework change
set. The mechanical half of AC-009 is covered by the existing shell-suite
captures; nothing about it changed in this cycle.

## Run 1 — AC-009 live check over `file://`

```text
commit:            5c2d5c886675474d8e86f93212c171a60d4f8843
working directory: /home/hermes/projects/win-calc
command:           export PATH="$HOME/.local/bin:$PATH"
                   node tasks/T001/evidence/ac009-live-check.mjs
environment:       host hermes-agent-2 · Linux 6.8.0-139-generic x86_64 · user hermes
                   node v24.21.0 — /home/hermes/.local/bin/node
                   Chromium: Google Chrome for Testing 151.0.7922.34 (Playwright cache),
                   headless; sandbox fallback flags printed in the capture
                   working tree clean at run (the capture's own `git status: clean`)
started at:        2026-09-10T16:26:10Z
finished at:       2026-09-10T16:26:12Z
exit code:         0
result:            PASS
                   console errors 0 · page errors 0 · failed requests 0 · browser-log errors 0
                   app booted: title="Calculator" · #calc present · #value "0" · keypad keys 24
                   requests: 6/6 local assets loaded — index.html, styles.css, format.js,
                   engine.js, modes/standard.js, ui.js
log path:          tasks/T001/evidence/ac009-live-check-output.txt
```

What it checked: the app loaded over `file://` in a real (headless) browser
reached `readyState complete` at the file's URL with zero console errors, zero
page (uncaught-exception) errors, zero failed requests, and zero browser-log
errors, and the app boot marker was present (the calculator shell rendered and
every local asset resolved). The criterion's live half is settled by this run.

Negative control — the check was shown capable of failing: the same command
against a scratch copy of the app with `styles.css` absent exited 1 and named
the failure (`file:///tmp/ac009-negative/styles.css — net::ERR_FILE_NOT_FOUND`;
1 failed request, 1 browser-log error). Capture:
`tasks/T001/evidence/ac009-live-check-negative-control.txt`. The capture for
the app itself cannot be produced by a check that can only pass.

## Run 2 — Required validation (`node --test`)

```text
commit:            5c2d5c886675474d8e86f93212c171a60d4f8843
working directory: /home/hermes/projects/win-calc
command:           export PATH="$HOME/.local/bin:$PATH"
                   node --test
environment:       host hermes-agent-2 · Linux 6.8.0-139-generic x86_64 · user hermes
                   node v24.21.0 — /home/hermes/.local/bin/node (symlink to /home/hermes/.hermes/node/bin/node)
                   working tree clean at run
started at:        2026-09-10T16:26:15Z
finished at:       2026-09-10T16:26:15Z
exit code:         0
result:            tests 43 · pass 43 · fail 0 · cancelled 0 · skipped 0 · todo 0
log path:          tasks/T001/evidence/g2-rework1-node-test-output.txt
```

## Reproducibility notes

- `node` is provided by `$HOME/.local/bin` (symlink to `~/.hermes/node/bin/node`,
  v24.21.0) and is added to PATH only by login or interactive shells
  (`~/.profile`, `~/.bashrc`); export the PATH line above first. Demonstrated
  earlier: `PATH=/usr/bin:/bin node --version` → `node: command not found`
  (exit 127) — `tasks/T001/evidence/g2-node-path-demo.txt`.
- The live check needs a Chromium binary. On this host it resolves the
  Playwright cache (`~/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`);
  `CHROME_BIN` overrides. The container's default sandbox aborts on launch, so
  the script falls back to `--no-sandbox --disable-setuid-sandbox`; the flag set
  actually used is printed in the capture. The check writes only under `/tmp`
  (a throwaway browser profile, removed at exit).
- The live check's full command: `node tasks/T001/evidence/ac009-live-check.mjs`
  (script committed in the product head 5c2d5c8).

## Actor

Runs executed by the rework session as the Tester step, on the owner's
instruction (2026-09-10). The independent reviewer is a distinct session. The
captured output in the log files is the commands' own output, unchanged.

## Product state

Product head: `5c2d5c8` (rework change set). The artifact commit that carries
this record and the captures changes only `tasks/T001/evidence/`; the product
state under review is the head above.
