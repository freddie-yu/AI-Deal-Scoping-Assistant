# Phase 2 validation

Validated locally on 2026-09-22. Pre-implementation baseline: 58/58 Vitest tests passed, including the original 22 Phase 0 tests.

## Final command sequence

| Command | Result |
|---|---|
| `npm run typecheck` | Passed, exit 0 |
| `npm run test` | 94/94 tests, 16/16 files, exit 0 |
| `npm run build` | TypeScript, Vite client and server compilation passed, exit 0 |
| `npm run test` after build | 94/94 tests, 16/16 files, exit 0 |
| `npm run test:e2e` with `PLAYWRIGHT_CHANNEL=msedge` | 6/6 passed, exit 0 |

The original 22 Phase 0 tests remain green. All 58 existing Phase 0/1 unit/integration behaviors remain green. The earlier browser assertion that PRD generation was disabled was updated to expect the now-implemented gated action; the rest of the source/review/edit-invalidation journey remains intact.

## Connected deliverables

All four seeds generate schema-validated proposals through MockAIProvider and shared validation. PRD covers all fourteen required topics; capabilities expose classification, priority, inclusion, grouping and grounding. Coverage separates accepted/covered, uncovered and excluded scope and uses N/A for an empty denominator. Assumption-only architecture contributes no requirement coverage.

AWS components use an application-owned catalog, structured connections, rationale, trade-offs, security and applicability. Mermaid source derives deterministically from these components and edges, never provider-authored diagram code. Rendering uses a local lazy-loaded Mermaid dependency, strict security, non-HTML labels and removal of links/active SVG content. Equivalent component/connection tables survive render failure or a rejected dependency.

DataDomain policies represent sources, ownership, ingestion, storage, quality, metadata/governance, retention, privacy/security, analytics and recovery. Integrations reference both architecture adapters and data domains and retain reviewed requirement grounding. AIUseCase sections expose deterministic alternatives, mandatory human decisions, approved-article retrieval, structured output validation, evaluation, privacy, safety and framework/service rationale. Non-AI seeds explicitly retain deterministic processing.

Workstream phases, predecessors, milestones, risks and exclusions persist, together with explicitly advisory scope, roles, complexity and drivers. No canonical EstimationUnit or numerical result is generated.

## Boundary and regression evidence

- Mandatory current scope approval for all four commands, including negative API/browser tests after scope edits.
- Unknown structured provider output, strict operation schemas, application-owned IDs, invalid/broken references and catalog/cloud rejection.
- Requirement-grounded capabilities/integrations/AI; architecture accepts reviewed-assumption-only grounding without synthetic requirements.
- COMPATIBLE PostgreSQL/RDS, CONFLICT JVM/Python, UNKNOWN unmodeled product/version; mandatory conflicts cannot be accepted. Read-only compatibility results include constraint/choice/catalog input references.
- Pending enhancements do not count as accepted coverage; excluded scope requires a reason. Unsupported additions and uncovered requirements remain distinguishable.
- Generation preserves domain revision; operational compare-and-save prevents lost runs. Acceptance advances only its own run cursor. Scope edits, stale snapshots and conflicting entity revisions block obsolete acceptance.
- Per-section accept/reject preserves other accepted records and stable IDs. Dependencies must be accepted and eligible, including consumed upstream inputs. Eligibility checks preserve historical payload/review/freshness and do not implement change-impact traversal.
- Rejected diagram dependencies clear the old SVG and preserve the fallback inventory; direct structured component/edge generation is deterministic and label injection is inert.
- Delivery schemas reject authoritative effort, person-days, timeline, ROM and confidence fields, including injections into otherwise valid proposals.
- Every seed completes generation, individual acceptance and JSON persistence through the delivery foundation.

## Semantic acceptance

Seed manifests now contain capability and recommendation expectations, plus must-have capabilities, required coverage, unsupported-addition checks, expected/forbidden architecture and AI, and named integrations. Structured negative mutations reject:

1. Missing expected capability.
2. Unsupported extra capability.
3. Salesforce replaced with an unrelated integration.
4. PostgreSQL compatibility violated.
5. Mandatory AI human review omitted.
6. AI recommendation grounded in an unrelated existing requirement.
7. Unsupported specific concurrency asserted.

Tests compare structured facts, links and control predicates, not exact generated prose. They are finite seed acceptance checks, not a general semantic truth detector.

## Browser and visual evidence

Production browser journeys cover original shell/session reload, Phase 1 source review and approval invalidation, custom inert Markdown, Phase 2 capability-to-exact-source navigation, individual proposal acceptance, rendered AWS diagram, Salesforce adapter rationale, retry/reconciliation controls, delivery persistence, invalidated-approval rejection and rejected-component fallback. Desktop and 390px screenshots were inspected; no horizontal page overflow was observed. The mobile diagram scrolls within its panel and retains a readable table.

## Review and boundaries

An independent reviewer identified the diagram fallback and transitive eligibility issues; both were fixed and regression-tested. The reviewer then exhausted its account usage allowance, so remaining review was performed locally. The execution ledger records these findings.

Mermaid 11.17.2 and the compatible patched lodash-es dependency are locked. The installation audit reports zero vulnerabilities. Vite reports a non-blocking size warning for an optional Mermaid chunk; Mermaid is loaded only when a diagram is needed.

AWS-only, MOCK-only, human acceptance and canonical structured sections are preserved. No live AI/model dependency, numeric estimation calculation, reverse change-impact traversal, selective regeneration engine, final quality gate, final package assembly or export was added. The estimation/impact/quality/export module entry points remain type-only boundaries. No known Phase 2 specification deviations remain.
