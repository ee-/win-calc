# G2 — Verification Record: T001 / WO-1

Tester record of the declared validation (`task.md` § Required Validation),
run against the exact head commit. Deterministic capture; no interpretation
added.

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

## Reproducibility note

`node` is not on a bare non-interactive PATH. It is provided by
`$HOME/.local/bin`, and that directory is added to PATH only by login or
interactive shells (`~/.profile` lines 25–26; `~/.bashrc` line 120). Export the
PATH line above before running the command. Demonstrated:
`PATH=/usr/bin:/bin node --version` → `node: command not found` (exit 127) —
capture: `tasks/T001/evidence/g2-node-path-demo.txt`.

## Actor

Run executed by the Captain session as the Tester step, on the owner's
instruction (2026-09-10). The implementer (OMP executor) and the independent
reviewer are distinct sessions. The captured output above and in the log file
is the command's own output, unchanged.
