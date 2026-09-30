# Phase 4 implementation plan and execution record

**Goal:** controlled, field-specific updates and deterministic quality validation on the existing canonical session.
**Spec:** challenge-requirements.md > scoring-to-feature-matrix.md > design.md > data-model.md > deterministic-estimation-rules.md; Phase 4 user request.
**Architecture:** derive graph from canonical relationships; compare substantive fields; use bounded proposals and existing engine; persist only current operational snapshots. AWS/MOCK only, no export.

## Tasks

- [x] Read all required specifications and inspect existing boundaries; baseline `npm run test`: 233/233.
- [x] Graph/diff/traversal: `src/traceability/dependencies.ts`, `src/impact/`; typed extensions to existing operational contracts. Test direct/transitive paths, cycles, dangling/unknown inputs, collections/resources, and exact field membership.
- [x] Estimator: extend existing `src/estimation/engine.ts` to skip unchanged numerical slices; preserve exact ledger/results; regress rate/contingency/currency/INT_B and predicate boundaries.
- [x] Regeneration: narrow application-owned manifests/context; bounded target plan and provider response validation; old/proposed acceptance; structural acceptance triggers fresh diff/index/traversal; concurrency tests.
- [x] Quality: `src/quality/`, stage-aware coverage, existing validators and authoritative calculation checks; fourteen rule fixtures, deterministic statuses and revision/version binding.
- [x] Application/API/UI: wire edits, acceptance and config into impact snapshots; add impact and quality workspace, causes/paths, before/after review and selective actions.
- [x] Browser flows: expected-user change and rate-only preservation, narrow viewport checks.
- [x] README and phase-4-validation; final typecheck/test/build/test/e2e in that order. Final: typecheck PASS, 307/307, build PASS, 307/307 post-build, 11/11 Playwright (Edge). See phase-4-validation.md for assertion corrections and bounded test parallelism.

Each implementation task adds failing behavior tests first, then implementation and targeted verification. Independent quality and numerical-engine tasks may run in parallel under the dispatching-parallel-agents skill; shared contracts are coordinated by the primary worker.

## Contract decisions

- Design §6 and data-model §7 require transitive nodes to be reported as potential impacts while waiting for actual upstream outputs. Only changed consumed substantive values stale content; review withdrawal alone does not. Re-traverse after each acceptance.
- Existing Phase 2 whole-scope manifests must be narrowed for newly generated sections and selective context. Never claim legacy undeclared consumption is unaffected.
- Preserve the existing untracked workspace in place; no worktree or blanket staging of pre-existing user files.
- Preserve Phase 3 automatic config recalculation behavior while attaching an exact change-impact report and making the underlying execution selective.

## Review focus

Multi-edit stale queues, self/collection cycles, rejected proposals, obsolete acceptance cursors, and malformed relationships must be tested alongside happy paths. No provider may expand a target boundary; no gate may stay current after a domain edit.
