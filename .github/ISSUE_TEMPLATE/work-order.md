---
name: Work order
about: Durable contract for one unit of delivered work
title: "<task>-WO<n> <short scope>"
labels: []
assignees: []
---

<!-- Copy this file into the project's .github/ISSUE_TEMPLATE/ when the project
     switches to forge mode. The body below is the contract; it is frozen once
     execution begins and is never rewritten (see the amendment rules at the end). -->

## Objective

## Background

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
- Executor:

---

## Contract Changes After Execution Begins

The body above is the contract snapshot and is **not rewritten**. Later changes
are recorded as comments, one of:

- `DECISION` — clarification; no material requirement change
- `AMENDMENT` — material change inside the same objective
- `REDIRECT` — changed objective; normally a new work order

## Routing

Next actor: CODER
