# Phase 5 validation

Validation date: 2026-10-13 (Asia/Shanghai). Runtime: Node 24.21.0, npm 11.19.0; Windows, installed Microsoft Edge through PLAYWRIGHT_CHANNEL=msedge.

## Baseline preserved

Before product edits: typecheck PASS; Vitest 307/307 (29 files); production build PASS; post-build Vitest 307/307; Playwright 11/11. Logs: .phase5-baseline-*.log. Existing tests were neither deleted nor skipped.

## Final reviewer-style clean setup

The repository was entirely untracked on entry. To avoid inventing a committed baseline, a fresh source copy was made at .verification/phase5-clean containing src, tests, seeds, docs and checked-in configuration/lockfile, with no pre-existing node_modules, dist or .data. This is a clean setup verification, not a claim of cloning a published commit.

Commands from that directory:

```powershell
npm ci
npm run typecheck
npm run test
npm run build
npm run test
$env:PLAYWRIGHT_CHANNEL='msedge'
npm run test:e2e
```

| Command | Verified result |
|---|---|
| npm ci | PASS; 287 packages installed from final lockfile |
| npm run typecheck | PASS |
| npm run test | PASS; 333/333, 32 files, 191.31 s |
| npm run build | PASS; Vite production assets and server TypeScript output |
| npm run test after build | PASS; 333/333, 32 files, 133.73 s |
| npm run test:e2e | PASS; 15/15, 2.0 min, Microsoft Edge, two workers |

The working-tree production build also passed. A separate `npm start` smoke check with DATA_DIR=.verification/start-smoke returned HTTP 200 for / and a healthy Phase 5 MOCK /api/health response; the verification server was then stopped. The browser global setup launches the built server with Node directly, verifies /api/health and serves the app/API on localhost:3001. Tests use their own .data/smoke store and teardown their server. No global npm package, provider credential, model download or AWS account is required. An installed browser is needed for browser tests, or use the documented Playwright Chromium installation.

## Package and export evidence

- Fixed 23-section reference composition; no second editable package or AI final rewrite.
- Preview and download share renderPackage. Exact UTF-8 SHA-256 is verified against the HTTP response and actual Playwright download, then compared with persisted ExportReceipt.
- PASS works without acknowledgment. REVIEW_REQUIRED requires explicit confirmed:true for the current revision/findings; warnings remain visible. BLOCKED and stale gate/revision/token/rules are rejected.
- Same-domain-revision proposal changes invalidate the gate. Export reruns existing quality checks within serialized operational persistence; a recorded browser diagram failure cannot silently disappear in API export.
- Receipt history is append-only evidence and survives later domain edits. Mutation/removal of a historical receipt is rejected. The latest-receipt shortcut is not authorization.
- Exact disclaimer regression; template/disclaimer/rules versions; section IDs/revisions; repeated-export content equality; deterministic map-order equivalence; filename sanitation; no client-controlled path.
- Current effort/person-weeks/timeline/roles/ROM/currency/contingency, missing inputs and limitations derive from the canonical ledger. Numerical sections use the Phase 3/4 validation contract, not the different Phase 2 generation fingerprint.
- Traceability includes requirement source/excerpt/origin, capability, architecture/data/integration/AI, canonical estimation units/workstreams, assumptions and stage coverage. Exclusions remain labeled; unsupported/stale accepted content cannot become an exportable current recommendation.
- Mermaid source has component, external-endpoint and connection fallbacks. Customer Markdown/HTML is escaped; preview uses React text nodes only.

## Four seeded journeys

All four seeds pass semantic goldens after estimate preparation and package assembly, reach a legitimate initial package, perform an important controlled change, selectively update/recalculate and export current content. Sources remain immutable; no seed is manipulated to force PASS.

| Seed | Change evidence | Appropriate final state |
|---|---|---|
| Modernization | 5,000 → 500,000 registered-user planning assumption; unrelated persona/workflow preserved; connected content updated | REVIEW_REQUIRED |
| Integration-heavy | One interface reconciliation/transformation driver changed; other interface estimate records preserved; Salesforce remains source-grounded | REVIEW_REQUIRED |
| AI-enabled | Agent plus supervisor approval variant; deterministic alternative, structured output, evaluation/privacy/safety and mandatory human decisions retained | REVIEW_REQUIRED |
| Missing information | Concurrency 100 supplied as reviewed assumption; missing engineering rate initially leaves ROM unavailable; later supplied rate restores pricing while other questions remain | REVIEW_REQUIRED / LOW confidence |

One flagship Playwright test starts at input, inspects exact sources, approves scope, individually accepts all connected proposals, calculates, inspects traceability, makes the scale change, inspects affected/unaffected, selectively accepts updates, reruns quality, previews and downloads. Three focused API-to-browser seed journeys verify the remaining packages/downloads.

## Review findings and repairs

Independent read-only review confirmed the export authorization, hashing, receipt and safe-preview boundaries and found one P2 issue: human canonical-unit changes were omitted from the retained change summary. A failing exclusion regression was added, then HUMAN unit/boundary edits were captured. The existing reconciliation routine also overwrote explicit exclusion reasons; the smallest fix preserves them for manually controlled boundaries/security units.

Additional consistency verification found that Phase 2 generation eligibility rejected Phase 3 fingerprint formats, dropping numerical detail rows. A failing regression now requires every current numerical section and unit-to-workstream trace; assembly uses existing acceptedCurrent checks and the gate's full ledger reproduction. A canonical-map reversal test then found trace reference ordering; explicit stable sorting fixed byte determinism.

Phase 2 golden helpers now apply their unsupported-recommendation assertion to Phase 2 payloads rather than incorrectly classifying the numerical EstimateSummary as an unsupported recommendation. All original Phase 2 expectations remain active. No new domain consistency engine was introduced. During the first final concurrent run, three new multi-operation export tests exceeded the default 5-second limit (330 tests passed, three timed out). The new export test files now allow 30 seconds per test; no assertion or existing regression was removed. The full clean sequence was restarted and both 333-test runs passed. The first full browser run with four workers then exceeded an existing five-second expectation and an existing 60-second test deadline while the flagship export passed. Browser concurrency is capped at two workers to reduce contention on the local server; all original test assertions and deadlines remain unchanged. The entire browser suite was rerun and passed 15/15. Source/tests/seeds and all build configurations and lockfiles were compared with the working tree; browser worker configuration was synced before the final rerun.

## Responsive and browser evidence

Desktop 1280×900 and narrow 390×844 checks cover package section navigation, warning acknowledgment, export, receipt/disclaimer and Markdown source. Assertions enforce no page-level horizontal overflow. Wide tables scroll inside their containers; Mermaid source and fallback inventories remain accessible.

Generated screenshots in test-results (and the clean run's equivalent directory): phase5-package-desktop.png, phase5-package-mobile.png, phase5-findings-mobile.png. The desktop/390px views were visually inspected. The first auxiliary browser run exposed a new test helper waiting for POST during read-only session loading; the helper was corrected and all four new browser journeys passed on rerun.

## Security and dependency checks

No provider URL, credential, active HTML/SVG, client export path or default customer-text logging was introduced. The application remains loopback-only and uses the existing Host/Origin, ID/schema and request-size guards. .data and downloads are plaintext local customer data; README explains protection and deletion.

A clean install initially reported 6 vulnerabilities (2 critical, 1 high, 3 low). Compatible patches updated concurrently 10.0.5 → 10.0.6, shell-quote to 1.12.0, DOMPurify to 3.4.17 and source-map-js to 1.2.2. No dependency was added. Final audit reports **2 low, 0 moderate/high/critical**: KaTeX advisory GHSA-238p-pmpm-9mq7 and its Mermaid dependency path. The advisory involves pre-existing prototype pollution bypassing math trust restrictions. No claim of zero vulnerabilities is made. npm audit's suggested Mermaid downgrade is intentionally not applied; Mermaid remains 11.17.2 and lazy-loaded.

npm also warns that esbuild's install script is not covered by npm's allowScripts setting. Installation/build behavior is recorded rather than silently changing machine-wide policy. The existing optional Mermaid chunk-size warning remains non-blocking.

## Submission materials and limitations

README covers purpose/setup/tests/MOCK/processing/review/traceability/connected artifacts/estimation/change/quality/export/security/architecture/limitations. docs/submission-architecture.md distinguishes the local assistant from generated customer AWS architectures. docs/demo-script.md provides the 3–5 minute main flow, viewport, navigation sequence and backup evidence.

MOCK supports exact seeded analysis and recorded/parameterized variants; arbitrary analysis is preserved and honestly rejected. Demo estimation assumptions are not calibrated market benchmarks, and human stakeholder validation remains required. No live AI, authentication, multi-user database, PDF/DOCX, cloud cost/FX service or scope expansion was introduced. A narrated demo-video file has not been recorded; the script and browser evidence are prepared for that final submission action.

No blanket staging, commit, push, deployment or modification of user customer sessions was performed. Test data and clean verification outputs remain in ignored directories.







