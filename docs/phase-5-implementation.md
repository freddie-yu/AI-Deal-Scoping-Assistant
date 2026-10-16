# Phase 5 implementation plan

Goal: finish the evaluator journey with deterministic Markdown, snapshot authorization, immutable export evidence and four-seed verification.

Authority: challenge-requirements.md > scoring-to-feature-matrix.md > design.md / data-model.md / deterministic-estimation-rules.md. User supplied approved scope and execution order; no redesign.

- [x] Baseline: typecheck, tests, build, post-build tests and browser suite.
- [x] Write failing package and export-policy regressions.
- [x] src/export/package.ts: reference-only composition; markdown.ts: deterministic safe rendering; versioned constants/disclaimer. Bind revision, gate/rules/findings, section revisions, estimation rules and templates.
- [x] src/application/export.ts: serialized preview/acknowledgment/download; rerun existing gate inside export; reject stale snapshots; SHA-256 exact UTF-8; append-only operational receipts.
- [x] API + FinalPackage UI: shared server rendering, section navigation, warnings, disclaimer, sanitized browser download and receipt.
- [x] Preserve latest human controlled-change evidence across selective updates; no duplicate mutable package records.
- [x] Unit/API checks: ordering, exact disclaimer, all gate states, stale authorization, hash/bytes equality, escaping, ledger values, traceability and change summary.
- [x] Four-seed semantic and change/export journeys; one flagship UI journey; desktop/390px inspection.
- [x] Final README, submission architecture, demo script and validation record.
- [x] Clean locked install and final full verification.

Review focus: same-revision operational changes; persisted browser-render failure; Unicode/Markdown injection; receipt history after edits; unsupported/stale output; current authoritative totals.

Execution: inline in existing workspace. Existing baseline is entirely untracked; preserve it without blanket staging or creating an empty checkout. The user's explicit implementation authorization takes precedence over skill approval handoffs. Keep final independent review and verification.

Baseline commands write .phase5-baseline-*.log. Product edits start only after the full baseline sequence.



