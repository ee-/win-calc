---
name: Work order
about: Durable contract for one unit of delivered work
title: "<task>-WO<n> <short scope>"
labels: []
assignees: []
---

<!-- Copy this file into the project's .github/ISSUE_TEMPLATE/ when the project
     switches to forge mode. The body below is the contract; it is frozen once
     execution begins and is never rewritten (see the amendment rules at the end).

     An owner decision is recorded only with the owner's own words quoted and the
     person who relayed them named. A statement of approval with no quoted source
     is not an approval, no matter who wrote it. -->

## Objective

## Background

<!-- Anything here that is a reconstruction rather than something read from a
     source must be marked `[INFERENCE]`. An unmarked guess in a contract is
     indistinguishable from a requirement: the Coder builds against it, and
     unwinding the contradiction costs an escalation. The marker is what lets a
     Coder check the claim instead of implementing it. -->

## In Scope

## Out of Scope

## Constraints

- CON-001

## Acceptance Criteria

- AC-001

## Required Evidence

One line per criterion: the observed result that settles it. A criterion with no
mapped evidence is a criterion that cannot be closed.

- AC-001:

## Required Validation

```
```

## Security / Authority Envelope

Name every unusual permission this work needs: secrets, network egress,
deployment or publication, destructive or irreversible actions, privileged
execution, dependency installers, spend. **Silence grants none of them.**

- authorized:
- not authorized:
- third-party source: read for behaviour only | <what may be derived, and the
  licence obligation it carries>. Reading an implementation to pin behaviour and
  copying it are different acts — the first is research, the second is a
  derivative work. Say which one this order allows. A project with no licence of
  its own cannot coherently accept derived code.
- owner gate required when:
- governance-sensitive, needs independent review before it takes effect:
  changes to `AGENTS.md`, the pipeline skills, security policy, CI workflows,
  CODEOWNERS, rulesets, permissions, or credentials

## Escalation Conditions

## Metadata

- Task / work order:
- Complexity: L0 / L1 / L2 / L3
- Architecture effort: none / standard / high
- Repository / target branch:
- Base commit:
- Executor: <tool **and session surface** — "OMP in a Herdr pane (agent …, pane …)"
  or "OMP headless one-shot". When a human is meant to watch the work, the
  surface is part of the contract, not a dispatch detail; a run that happens on a
  different surface is a finding, not a wording difference.>

---

## Contract Changes After Execution Begins

The body above is the contract snapshot and is **not rewritten**. Later changes
are recorded as comments, one of:

- `DECISION` — clarification; no material requirement change
- `AMENDMENT` — material change inside the same objective
- `REDIRECT` — changed objective; normally a new work order

## Routing

Next actor: CODER
