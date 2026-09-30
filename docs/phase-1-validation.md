# Phase 1 validation

Validated locally on 2026-09-22. Phase 0 baseline before changes: 22/22 Vitest tests passed.

## Final commands and results

| Command | Result |
|---|---|
| `npm run typecheck` | Passed, exit 0 |
| `npm run test` | 58/58 tests, 12/12 files, exit 0 |
| `npm run build` | TypeScript, Vite client and server compilation passed, exit 0 |
| `npm run test` after build | 58/58 tests, 12/12 files, exit 0 |
| `npm run test:e2e` with `PLAYWRIGHT_CHANNEL=msedge` | 3/3 passed, exit 0 |

The original 22 unit/integration tests and original browser smoke test remain intact and green. No dependencies or live AI services were added. Production browser tests cover the six-area shell, seed analysis, exact evidence, provenance, assumption/question review, approval, downstream eligibility, edit invalidation and persistence. A third browser test covers custom Markdown, inert HTML source text, honest unsupported-MOCK errors and reload preservation. Desktop and 390px-wide screenshots were inspected; no page overflow was observed.

## Acceptance evidence

- Sources: exact input, CRLF/whitespace/Unicode, UTF-16 offsets, immutable versions, section/quote resolution, corrupt anchors and counter reuse rejection.
- Canonical scope: independent BR/FR/NFR/INT/DATA/SEC/ASM/Q counters, edit identity, type replacement/retirement, no provider-owned canonical IDs.
- Provider boundary: recorded unknown outputs pass shared schema validation, source/reference validation and application canonicalization. Invalid enums/types/evidence/quotes/sections/direct assertions/IDs/offsets/references are rejected. On-disk malformed fixtures produce shared-validator field paths.
- Provenance: direct customer support, contextual inference, explicit assumed scope, structured fact edits requiring reclassification, and rejection of relabeling altered structured claims as customer-stated.
- Assumptions/questions: provisional review differs from factual confirmation; confirmed claim edits cannot inherit old confirmation; UNVALIDATED remains explicit; answers do not mutate requirements.
- Review: drafts block approval, reviewed scope enables approval, open reviewed questions remain warnings, scope edits invalidate approval, unrelated artifact content is retained, stale analysis cannot overwrite newer input.
- Persistence: schema/source/reference validation on save and load, immutable source enforcement, optimistic revision handling and previous-snapshot recovery retained.

## Semantic goldens

All four seed families pass structured mustExtract/mustClassify/mustIdentifyMissing/mustNotInvent assertions. They cover Atlas/order workflows/PostgreSQL compatibility, source-stated Salesforce, support reply drafting/human approval, and missing concurrency/API-readiness/rates. Negative mutations reject HubSpot substitution, incorrect provenance, unrelated requirement links, invented concurrency and missing linked clarification questions. Later capability/recommendation expectations are explicitly deferred to Phase 2.

## Scope and limitations

MOCK analysis intentionally supports exact recorded seed fingerprints only. Arbitrary pasted input is preserved but is not represented as analyzed. CUSTOMER_STATED descriptions use normalized exact direct quotations; unsupported paraphrases require explicit inference/assumption classification. Review is a human interpretation decision, not automated proof of factual truth.

No PRD, capabilities, architecture, strategy, estimation, change-impact traversal, final quality gate or export generation was implemented. Existing downstream schema contracts remain schema-only. No known specification deviations remain.
