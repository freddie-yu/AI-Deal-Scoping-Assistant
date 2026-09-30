# Phase 2 implementation plan and ledger

Goal: implement the user's connected-deliverables specification using the approved canonical ArtifactSection model, AWS only and MOCK only.

Authority: challenge-requirements.md, scoring-to-feature-matrix.md, design.md, data-model.md, deterministic-estimation-rules.md, and the supplied Phase 2 implementation brief.

## Execution

- [x] Read specifications and inspect repository; existing Vitest baseline 58/58.
- [x] Extend strict payload/provider schemas and add operation-specific tests.
- [x] Add parameterized seed generators, AWS catalog, compatibility, reference validation, coverage and deterministic diagrams.
- [x] Add application commands, atomic operational persistence and section-safe acceptance with captured-snapshot concurrency checks.
- [x] Add review workspaces and canonical grounding/source drill-down.
- [x] Add seed semantic positive/negative tests and browser reviewer flows.
- [x] Update README, independently review implementation, and run typecheck/test/build/test/Playwright in order.

Files: domain/artifacts.ts and session.ts own contracts; generators/* owns MOCK templates; validation/deliverables.ts owns structural relationships; traceability/coverage.ts owns scope coverage; architecture/* owns catalogs/compatibility/diagram; application/deliverables.ts owns generation/review; persistence repository owns atomic writes; UI features own read/review views. Tests cover each boundary, not exact prose.

Review focus: concurrent generation and partial acceptance; obsolete inputs after scope edits; rejected dependencies; provider-injected IDs/numeric estimates; diagram label injection; assumption-only justification versus requirement coverage.

## Rulings

- Existing source is entirely untracked in this checkout. Work in place and preserve it; do not create a worktree that would omit the baseline or commit unrelated user files.
- Use existing operation names prd-scope, architecture, strategies and delivery. Strategies includes coordinated data/integration and AI operation-specific payloads.
- Workstream suggestions are explicitly advisory fields (scope, roles, complexity); canonical membership/roles from estimation units remain Phase 3.
- Generation-run bookkeeping uses a serialized operational update without advancing the domain revision. Section acceptance advances the domain revision and permits only the remaining proposals of that same run to advance with it. Unrelated edits make the run obsolete.
- Follow the user's already-approved contracts and implementation order without restarting design approval.

## Review and verification ledger

- Initial domain tests exposed static-asset S3 incorrectly classified as a database choice; corrected its technology role. All four seed acceptance flows passed.
- Independent review identified a rejected-component diagram retaining obsolete SVG/losing its fallback and a missing transitive input-eligibility guard. Both were corrected, with browser fallback and upstream eligibility regression tests. The reviewer then hit an account usage limit; remaining review was performed locally.
- Strict schemas also reject unknown references, provider-owned IDs, unsupported clouds/services and authoritative numeric delivery fields. Runtime acceptance checks captured revisions and current dependency eligibility; no reverse impact traversal is implemented.
- Mermaid is pinned to 11.17.2 with compatible patched lodash-es; npm reported zero vulnerabilities. The renderer is lazy-loaded; its optional diagram chunks cause a non-blocking Vite chunk-size warning.
- Final exact command results are recorded in phase-2-validation.md.
