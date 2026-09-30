# Phase 4 validation

Phase 4 implements controlled changes and deterministic validation. AWS-only, MOCK-only, local persistence; no live AI, pricing service or Phase 5 export. The complete pre-change baseline passed **233/233** tests. Required specifications and Phase 1–3 validation records were read before implementation.

## Final verification

Validated locally on 2026-09-29. The final required sequence:

| Command | Result |
|---|---|
| `npm run typecheck` | PASS, exit 0 |
| `npm run test` | 307/307 tests, 29/29 files; 69.78s, exit 0 |
| `npm run build` | PASS: TypeScript, Vite client and server compilation; exit 0 |
| `npm run test` after build | 307/307 tests, 29/29 files; 67.38s, exit 0 |
| `npm run test:e2e`, `PLAYWRIGHT_CHANNEL=msedge` | 11/11 passed; 1.1m, exit 0 |

Phase 4 adds 74 unit/integration tests to the original 233 and three browser flows to the original eight. The existing Mermaid-related bundle-size warning remains; production compilation succeeds. No dependency or external runtime service was added.

## Controlled-change contracts

- `src/traceability/dependencies.ts` derives SUPPORTS / DEPENDS_ON edges from canonical records, InputRefs, grounding, source evidence, design links, scheduling predecessors, unit parameters, calculation ledgers, aggregate/composite membership and resource references. A deterministic reverse index is rebuilt after acceptance. No second dependency database exists.
- `src/impact/diff.ts` records entity, old/new revision, changed FieldPaths and typed before/after values. Revision/review metadata alone does not become a substantive field change. Scalar, nested measures, assumptions, inclusion, lifecycle, configuration and membership are covered.
- Traversal is stable, cycle-safe, deduplicated, and retains edge IDs/reasons/paths. Unknown declarations and dangling references cannot be certified unaffected. Collection watches use the actual numerical inventory, so an unrelated narrative or question does not stale every estimate.
- Only actual direct consumed changes stale content. Transitive paths are potential impacts until accepted upstream output changes. Accepted payloads, IDs, grounding and review stamps remain present. Review-only DRAFT state prevents new use without blanket freshness invalidation.
- Every acceptance rebuilds and traverses the current graph; a changed relationship removes obsolete edges. Still-stale generated and numerical targets survive later unrelated acceptances. Optimistic concurrency prevents an old proposal or recalculation request from committing over newer edits.

## Regression evidence

| Change | Affected | Intentionally preserved |
|---|---|---|
| Modernization users 5,000 → 500,000 | Declared scale NFR/capability, PRD overview/NFR/assumption/traceability consumers, scale/environment/availability narratives and connected estimate confidence inputs | Persona, core order workflow, immutable customer source and undeclared architecture consumers |
| Requirement priority MEDIUM → HIGH | Capability/prioritization consumers, coverage and confidence where declared | Architecture consuming description/existence/inclusion but not priority; REVIEWED + CURRENT and byte-equivalent |
| INT_B MEDIUM → HIGH | INT_B unit/result, nine testing units when shared HIGH predicate changes, schedule/commercial aggregates | INT_A and INT_C EstimateItems byte-equivalent; subsequent HIGH → HIGH flag edit executes no effort routine and preserves testing |
| Engineering rate 800 → 900 USD/day | Matching role commercial rows, contingency on changed bases and ROM aggregates | Effort, exact role effort, schedule, non-E money rows and unrelated designs |
| Contingency 15% → 20% | Contingency, ROM and relevant confidence | All base commercial rows/ledger, effort, role effort, schedule and designs |
| USD → EUR without replacement rates | Commercial availability and confidence | Effort and schedule; no FX, no relabeling USD rates as EUR |

The scale edit creates a provisional planning assumption and converts the edited requirement to ASSUMED/CONTEXT. The original customer quote remains immutable. The seed's runtime component does not consume expected-user volume; it therefore stays unchanged. No concurrency value, cloud operating price, or effort multiplier is invented to force a numerical change. Its connected narratives and confidence checks consume the scale change explicitly.

The rules §9 numerical regressions retain the Phase 3 authoritative outputs: baseline 85–140 person-days, 61–99 working days, USD 80,500–131,502.50; INT_B change 91–151.5 days and USD 85,226.50–140,484; rate-only ROM USD 84,536.50–137,919.50; contingency-only ROM USD 84,000–137,220. Currency without compatible rates makes ROM unavailable. Spies verify actual effort/pricing/schedule routines are skipped for unchanged slices, rather than merely comparing final values. FULL audit mode independently recomputes and detects cached-result/ledger tampering.

## Bounded generation and preservation

Selective requests carry an application-owned target list and projections of declared consumed fields. The broad session context is empty. Missing/extra targets, guessed hidden references, unsupported variants and wrong measure units are rejected. Only existing stale targets are updated by the finite selective fixtures; arbitrary component splitting or free-form generative changes are not supplied by MOCK.

Recorded variants are tested through normal scope editing, review, approved generation and individual acceptance: modernization 500,000 registered users; missing-information 100 concurrent users; AI agent plus supervisor approval. Integration complexity uses the deterministic driver path. Config inputs are projected and require validation for new use without making review status part of freshness.

Tests compare complete serialized unaffected sections, including ID, payload, review stamps, freshness and grounding. Rejection leaves previous accepted stale content untouched. Accepting one target does not overwrite siblings. Structural relationship acceptance causes a new index/traversal. Stale proposals and provider writes outside allowed targets are rejected. Source documents remain byte-equivalent across the scale and recorded-variant flows.

The Phase 4 browser journey sets up reviewed Phase 1–3 state, edits scale in the UI, reviews the requirement/new assumption, inspects affected and unaffected lists, expands a reason path, compares old/proposed sections, accepts each selective proposal, recalculates and reevaluates quality. A second browser flow changes a rate and proves unchanged effort/current architecture plus changed ROM. A third forces Mermaid loading to fail and verifies a persisted blocking finding with the component-table fallback. Screenshots are generated under `test-results/phase4-*.png`; desktop and 390px layouts are inspected for overflow.

## Quality gate

Pure deterministic rules reuse existing scope, grounding, AWS catalog, compatibility, diagram and estimation validators. Findings have stable keys, related references, severity, status, rule/version and evaluation revision. Scope/design/delivery coverage excludes pending/stale content, lists high-priority gaps and exclusions, and returns N/A for an empty denominator. Assumption-only architecture never adds customer coverage.

- PASS: accepted fixture with confirmed assumptions, answered questions, calibrated test configuration, valid inventory and consistent results.
- REVIEW_REQUIRED: uncovered requirements, delivery gaps, unresolved AI controls, questions, provisional assumptions, missing inputs with honest unavailable results, UNKNOWN technology and obsolete pending proposals.
- BLOCKED: unsupported accepted scope, unjustified architecture, MUST technology conflict, stale required content, invalid/dangling references, invalid catalog/diagram, missing/duplicate/inconsistent summary membership, fabricated ROM or irreproducible ledger.

The browser checks actual diagram rendering before gate evaluation; rendering failure produces a blocking `diagram-render` finding. API-only evaluation checks graph structure, and can include the current browser rendering result. The gate is not a guarantee that every external browser can render successfully.

Domain changes discard obsolete gates. Successful proposal generation and rejection also clear gates because pending-proposal findings changed even though the domain revision did not. Gate reads check domain revision and quality-rule version. Evaluation is an operational write and does not advance the domain revision.

## Previous-phase contract correction

Two existing Phase 2 preservation assertions originally required **every ArtifactSection byte** to remain equal after changing a consumed field: FR_01 priority, and a database component's purpose consumed by runtime. This conflicts with design §6 / data-model §7 and Phase 4's explicit requirement to stale actual consumers. The smallest corrections preserve both regressions' payload/ID/grounding/review guarantees and assert only the declared direct consumer's freshness/cause changes. Unrelated sections and potential transitive consumers remain exactly equal. No original test was deleted or skipped. This is documented rather than claiming all 233 assertions were untouched.

A pre-final full verification reported 306/307 passing; the sole failure was the second conflicting freshness assertion above. It was corrected without weakening the accepted-content or input-eligibility checks. The next full run passed 307/307, but its post-build run exposed the existing 5-second test timeout under concurrent filesystem/CPU load (the same indirect-eligibility case passed alone in 3.13 seconds including startup). Vitest is now capped at four workers to bound contention. Original timeouts are unchanged. The complete required command sequence was then restarted.

The workspace was untracked on entry. Baseline files were preserved in place; no blanket staging, commits or worktree replacement was performed.

## Remaining Phase 5 boundary

Integrated scoping package, Markdown rendering/export, export receipt/snapshot integrity, final reviewer-flow polish, complete seed/demo verification, final submission architecture documentation and demo-video preparation remain. The export module stays type-only; no download or final package behavior was added.
