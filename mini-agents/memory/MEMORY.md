# Fleet Memory (Simplified)

## Mission
Run a strict, lightweight delivery loop where evidence quality and QA grading decide routing.

## Pipeline
`Elena -> Colombo -> Vitalik -> Athena`

## Ownership Model
- Elena: plans and priority framing.
- Colombo: build-ready spec + QA gates.
- Vitalik: implementation + score-ready evidence payload.
- Athena: GitHub verification, grading authority, and release recommendation.

## E-014 Synergy Top 5
1. Athena owns GitHub QA checklist and weighted grading.
2. Vitalik handoff is mandatory and evidence-complete.
3. Colombo blueprints enforce minimum grade and route-by-score.
4. Shared `qa_report` and `grading_report` templates are standard.
5. Contracts (`ATHENA.md`, `VITALIK.md`, `COLOMBO.md`) update together to prevent drift.

## E-014 One-Shot Task Focus
- E-014-01: define Athena checklist, grading schema, ownership routing, release recommendation.
- E-014-02: enforce Vitalik handoff fields mapped 1:1 to Athena verification inputs.
- E-014-03: enforce Colombo QA gate fields and score-band loop-closure rules.
- E-014-04: add reusable JSON templates under `repo-bootstrap/templates/`.

## E-015 Fast-Ship Focus
- Simplify Elena contract to compact ship-first rules.
- Enforce weekly numeric cadence and debt budget.
- Execute immediate queue: `color-scheme`, `dice-roller`, `url-parser`, then `context-packer`.

## Done Signal
- QA outcomes are deterministic (`pass|fail|blocked`) with evidence.
- Grade output directly triggers `ship|rework|escalate`.
- No stage relies on implicit assumptions.

## Top 3 Easiest WIP Testing Targets
- `wip-case-converter`
- `wip-password-generator`
- `wip-token-counter`

Execution pattern per project:
1. Add deterministic unit tests for core logic.
2. Add edge-case tests for invalid or tricky input.
3. Add integration smoke checks for primary UI flow.
4. Capture evidence in Vitalik handoff mapped to acceptance criteria.
5. Route to Athena with known risks and GitHub run/check references.
